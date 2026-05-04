import { create } from "zustand";
import { getRegions, getAdjacentRegions, getReachableHexes, getMovementRange, pickRandomMap, getActiveMapId, hexToWorld } from "./regions";
import { CARD_DATABASE } from "./cards";
import { resolveTrap, getRegionTrapIds } from "./traps";
import { getDeckCardIds, DECK_IDS } from "./themedDecks";
import { startMovementAnim } from "./movementAnims";

// ── Card lookups from full database ──────────────────────────
export function getCard(id) {
  return CARD_DATABASE[id] || null;
}

export function getCreature(id) {
  const card = CARD_DATABASE[id];
  if (card && card.type === "creature") return card;
  return null;
}

// ── Terrain bonuses ────────────────────────────────────────
export const TERRAIN_BONUSES = {
  plains:   { name: "Open Ground",   effect: "No movement penalty. Creatures gain +200 ATK." },
  forest:   { name: "Dense Canopy",  effect: "Elf/Beast creatures gain +400 ATK. Traps are harder to detect." },
  mountain: { name: "High Ground",   effect: "Dragon/Winged creatures gain +500 ATK. +300 DEF for all defenders." },
  swamp:    { name: "Miasma",        effect: "Movement halved. Zombie/Fiend creatures gain +400 ATK. Non-undead lose 200 ATK." },
  water:    { name: "Depths",        effect: "Water creatures gain +400 ATK/DEF. Non-water creatures lose 300 ATK." },
  volcanic: { name: "Scorched Earth", effect: "Fire creatures gain +600 ATK. All creatures take 100 damage per turn." },
};

// ── Element bonus lookup from field spells ───────────────────
const FIELD_ELEMENT_BONUS = {
  forest: { kinds: ["beast", "warrior"], atk: 400, def: 400 },
  swamp: { kinds: ["zombie", "fiend"], atk: 400, def: 400 },
  water: { kinds: ["water"], atk: 500, def: 500 },
  mountain: { kinds: ["dragon", "winged-beast"], atk: 500, def: 500 },
  volcanic: { kinds: ["fire"], atk: 600, def: 0 },
};

// ── Store ──────────────────────────────────────────────────
export const useGameStore = create((set, get) => ({
  // ── UI selection state ──────────────────────────────────
  selectedHandCard: null,
  handMode: null, // "deploy" | "trap" | null

  setSelectedHandCard: (card, mode) => set({ selectedHandCard: card, handMode: mode }),
  clearHandSelection: () => set({ selectedHandCard: null, handMode: null }),

  // ── Timer ───────────────────────────────────────────────
  tickTimer: () => {
    const state = get();
    if (!state.timerActive || state.gameTime <= 0) return;
    const newTime = state.gameTime - 1;
    if (newTime <= 120 && !state.apocalypseWave) {
      set({ gameTime: newTime, apocalypseWave: true });
      get().addNotification("⚡ THE APOCALYPSE BEGINS! Shadow creatures pour onto the battlefield!");
    } else if (newTime <= 0) {
      set({ gameTime: 0, timerActive: false });
      // Time's up — higher HP wins
      const p1hp = state.playerHP["player-1"];
      const p2hp = state.playerHP["player-2"];
      if (p1hp > p2hp) {
        set({ playerHP: { ...state.playerHP, "player-2": 0 } });
        get().addNotification("⏰ Time's up! Crimson Dominion wins by LP advantage!");
      } else if (p2hp > p1hp) {
        set({ playerHP: { ...state.playerHP, "player-1": 0 } });
        get().addNotification("⏰ Time's up! Azure Coalition wins by LP advantage!");
      } else {
        set({ playerHP: { "player-1": 0, "player-2": 0 } });
        get().addNotification("⏰ Time's up! It's a draw!");
      }
    } else {
      set({ gameTime: newTime });
    }
  },

  // ── Game flow ───────────────────────────────────────────
  phase: "deploy",
  gameStarted: false,
  activeMap: "ashen-wastes",
  turn: 1,
  currentPlayer: "player-1",

  // ── Timer & apocalypse wave ─────────────────────────────
  gameTime: 900,            // 15 minutes in seconds
  timerActive: false,
  apocalypseWave: false,    // true when gameTime <= 120
  apocalypseCreatures: {},  // { key: { name, art, atk, region, targetTower } }

  // ── King tower positions (world coords) and HP ───────────
  // Silver tower = P1's base (far west), Gold tower = P2's base (far east)
  towerHP: { silver: 8000, gold: 8000 },
  towerMaxHP: { silver: 8000, gold: 8000 },
  // Hex region each tower sits on (axial coords match battlefield map)
  towerRegions: { silver: { q: -7, r: 0 }, gold: { q: 7, r: 0 } },
  // Summoning circles — 2 per player, adjacent to their tower.
  // Creatures can ONLY be deployed to these regions.
  // [{ q, r, owner }]
  summonCircles: [
    { q: -6, r: 0,  owner: "player-1" },
    { q: -7, r: -1, owner: "player-1" },
    { q: 6,  r: 0,  owner: "player-2" },
    { q: 7,  r: -1, owner: "player-2" },
  ],

  // ── Player state ────────────────────────────────────────
  playerDeck: { "player-1": [], "player-2": [] },
  playerHand: { "player-1": [], "player-2": [] },
  playerSP: { "player-1": 7, "player-2": 7 },
  playerHP: { "player-1": 8000, "player-2": 8000 },
  playerGraveyard: { "player-1": [], "player-2": [] },

  // ── Map state ───────────────────────────────────────────

  // 5 control markers per region. Majority = controller. Ties = neutral.
  // Populated dynamically in initGame from the active map's regions.
  regionMarkers: {},

  stationedCreatures: {},

  // 1 summon + 1 move per turn (unless special effects override)
  summonsUsed: { "player-1": 0, "player-2": 0 },
  movesUsed: { "player-1": 0, "player-2": 0 },

  trapsSet: {},

  // Field spells deployed to regions (overrides terrain)
  fieldSpells: {},

  // Temporary ATK buffs — { creatureId: { bonus, turnsLeft } }
  tempBuffs: {},

  // Immobilized creatures — { creatureId: turnsLeft }
  immobilized: {},

  // Creature ownership
  creatureOwners: {},

  // Equipment attached to creatures
  equippedTo: {},

  // ── Notifications ───────────────────────────────────────
  notifications: [],

  addNotification: (message) =>
    set((state) => ({
      notifications: [
        { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, message, time: Date.now() },
        ...state.notifications,
      ].slice(0, 50),
    })),

  clearNotifications: () => set({ notifications: [] }),

  // ── Game initialization ─────────────────────────────────
  initGame: (deck) => {
    const state = get();
    // Pick a random map for this match
    const mapId = pickRandomMap();
    // Shuffle player deck
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    // Draw 5 card opening hand
    const hand = shuffled.splice(0, 5);

    // Generate AI deck — pick a random themed deck
    const aiDeckId = DECK_IDS[Math.floor(Math.random() * DECK_IDS.length)];
    const aiDeckCards = [...getDeckCardIds(aiDeckId)];
    const aiShuffled = aiDeckCards.sort(() => Math.random() - 0.5);
    const aiHand = aiShuffled.splice(0, 4);

    // Generate region markers dynamically from the active map
    const regions = getRegions();
    const newRegionMarkers = {};
    const sortedByQ = [...regions].sort((a, b) => a.q - b.q);
    for (const r of regions) {
      newRegionMarkers[r.id] = { "player-1": 0, "player-2": 0 };
    }
    // P1 gets 5 westernmost (lowest q), P2 gets 5 easternmost (highest q)
    for (let i = 0; i < 5; i++) {
      newRegionMarkers[sortedByQ[i].id] = { "player-1": 5, "player-2": 0 };
    }
    for (let i = sortedByQ.length - 5; i < sortedByQ.length; i++) {
      newRegionMarkers[sortedByQ[i].id] = { "player-1": 0, "player-2": 5 };
    }

    set({
      gameStarted: true,
      phase: "deploy",
      activeMap: mapId,
      turn: 1,
      gameTime: 900,
      timerActive: true,
      apocalypseWave: false,
      apocalypseCreatures: {},
      regionMarkers: newRegionMarkers,
      playerDeck: { ...state.playerDeck, "player-1": shuffled, "player-2": aiShuffled },
      playerHand: { ...state.playerHand, "player-1": hand, "player-2": aiHand },
      playerSP: { ...state.playerSP, "player-1": 7, "player-2": 7 },
      playerHP: { "player-1": 8000, "player-2": 8000 },
      towerHP: { silver: 8000, gold: 8000 },
      summonsUsed: { "player-1": 0, "player-2": 0 },
      movesUsed: { "player-1": 0, "player-2": 0 },
    });
    const p1Regions = Object.keys(newRegionMarkers).filter(
      rid => getRegionController({ regionMarkers: newRegionMarkers }, rid) === "player-1"
    );
    get().addNotification(`Map: ${getActiveMapId()}. Deploy phase — deploy to: ${p1Regions.map(id => getRegions().find(r => r.id === id)?.name || id).join(", ")}`);
  },

  // ── Card drawing ────────────────────────────────────────
  drawCard: (playerId) => {
    const state = get();
    const deck = [...state.playerDeck[playerId]];
    if (deck.length === 0) return null;
    const card = deck.shift();
    set({
      playerDeck: { ...state.playerDeck, [playerId]: deck },
      playerHand: { ...state.playerHand, [playerId]: [...state.playerHand[playerId], card] },
    });
    return card;
  },

  // ── Deploy creature from hand to owned region ────────────
  deployCreature: (playerId, cardId, regionId) => {
    const state = get();
    const card = getCard(cardId);
    if (!card || card.type !== "creature") return false;

    const controller = getRegionController(state, regionId);
    if (controller !== playerId) {
      get().addNotification(`You can only deploy to regions you control (${regionId} is controlled by ${controller || "neutral"}).`);
      return false;
    }

    // Must deploy to a summoning circle belonging to the player
    const region = getRegions().find(r => r.id === regionId);
    if (!region) return false;
    const circle = state.summonCircles.find(
      sc => sc.q === region.q && sc.r === region.r && sc.owner === playerId
    );
    if (!circle) {
      const circleNames = state.summonCircles
        .filter(sc => sc.owner === playerId)
        .map(sc => {
          const rgn = getRegions().find(r => r.q === sc.q && r.r === sc.r);
          return rgn?.name || `(${sc.q},${sc.r})`;
        }).join(", ");
      get().addNotification(`You can only deploy to your summoning circles: ${circleNames}.`);
      return false;
    }

    // 1 normal summon per turn
    if ((state.summonsUsed[playerId] || 0) >= 1) {
      get().addNotification(`You have already summoned a creature this turn.`);
      return false;
    }

    const sp = state.playerSP[playerId];
    if (sp < card.cost) {
      get().addNotification(`Not enough SP. ${card.name} costs ${card.cost} SP.`);
      return false;
    }

    // Remove from hand
    const handIdx = state.playerHand[playerId].indexOf(cardId);
    if (handIdx === -1) return false;
    const newHand = [...state.playerHand[playerId]];
    newHand.splice(handIdx, 1);

    // Add to region
    const current = state.stationedCreatures[regionId] || [];
    const newStationed = { ...state.stationedCreatures, [regionId]: [...current, cardId] };

    set({
      playerHand: { ...state.playerHand, [playerId]: newHand },
      playerSP: { ...state.playerSP, [playerId]: sp - card.cost },
      stationedCreatures: newStationed,
      creatureOwners: { ...state.creatureOwners, [cardId]: playerId },
      summonsUsed: { ...state.summonsUsed, [playerId]: (state.summonsUsed[playerId] || 0) + 1 },
    });

    get().addNotification(`${card.name} deployed to ${getRegions().find(r => r.id === regionId)?.name || regionId}.`);
    return true;
  },

  // ── Set trap from hand ───────────────────────────────────
  setTrapFromHand: (playerId, trapId, regionId) => {
    const state = get();
    const card = getCard(trapId);
    if (!card || card.type !== "trap") return false;

    if (getRegionController(state, regionId) !== playerId) {
      get().addNotification("You can only set traps in regions you control.");
      return false;
    }

    const sp = state.playerSP[playerId];
    if (sp < card.cost) {
      get().addNotification(`Not enough SP. ${card.name} costs ${card.cost} SP.`);
      return false;
    }

    // Remove from hand
    const handIdx = state.playerHand[playerId].indexOf(trapId);
    if (handIdx === -1) return false;
    const newHand = [...state.playerHand[playerId]];
    newHand.splice(handIdx, 1);

    // Add trap
    const current = state.trapsSet[regionId] || [];
    set({
      playerHand: { ...state.playerHand, [playerId]: newHand },
      playerSP: { ...state.playerSP, [playerId]: sp - card.cost },
      trapsSet: { ...state.trapsSet, [regionId]: [...current, trapId] },
    });

    get().addNotification(`${card.name} set face-down in ${getRegions().find(r => r.id === regionId)?.name || regionId}.`);
    return true;
  },

  // ── Equip from hand ──────────────────────────────────────
  equipCreature: (playerId, equipmentId, creatureId) => {
    const state = get();
    const card = getCard(equipmentId);
    if (!card || card.type !== "equipment") return false;

    // Find which region the creature is on
    const regionId = findCreatureRegion(state, creatureId);
    if (!regionId) return false;
    if (getRegionController(state, regionId) !== playerId) return false;

    const sp = state.playerSP[playerId];
    if (sp < card.cost) return false;

    // Remove from hand
    const handIdx = state.playerHand[playerId].indexOf(equipmentId);
    if (handIdx === -1) return false;
    const newHand = [...state.playerHand[playerId]];
    newHand.splice(handIdx, 1);

    set({
      playerHand: { ...state.playerHand, [playerId]: newHand },
      playerSP: { ...state.playerSP, [playerId]: sp - card.cost },
      equippedTo: { ...state.equippedTo, [creatureId]: [...(state.equippedTo[creatureId] || []), equipmentId] },
    });

    get().addNotification(`${card.name} equipped to ${getCard(creatureId)?.name || creatureId}.`);
    return true;
  },

  // ── Cast spell from hand ─────────────────────────────────
  castSpell: (playerId, spellId, targetRegionId, targetCreatureId) => {
    const state = get();
    const card = getCard(spellId);
    if (!card || card.type !== "spell") return false;

    const sp = state.playerSP[playerId];
    if (sp < card.cost) {
      get().addNotification(`Not enough SP. ${card.name} costs ${card.cost} SP.`);
      return false;
    }

    // Remove from hand
    const handIdx = state.playerHand[playerId].indexOf(spellId);
    if (handIdx === -1) return false;
    const newHand = [...state.playerHand[playerId]];
    newHand.splice(handIdx, 1);

    const newSP = sp - card.cost;

    // Resolve spell effect
    switch (card.id) {
      case "dark-hole": {
        if (!targetRegionId) return false;
        const regionCreatures = state.stationedCreatures[targetRegionId] || [];
        const newStationed = { ...state.stationedCreatures, [targetRegionId]: [] };
        // Move destroyed to graveyards
        const newGraves = { ...state.playerGraveyard };
        for (const cid of regionCreatures) {
          const owner = state.creatureOwners[cid] || "neutral";
          newGraves[owner] = [...(newGraves[owner] || []), cid];
        }
        set({
          playerHand: { ...state.playerHand, [playerId]: newHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          stationedCreatures: newStationed,
          playerGraveyard: newGraves,
        });
        get().addNotification(`${card.name} destroyed all creatures in ${getRegions().find(r => r.id === targetRegionId)?.name || targetRegionId}!`);
        return true;
      }

      case "swords-of-revealing-light": {
        if (!targetRegionId) return false;
        // Reveal traps — just notify what's there
        const regionTraps = state.trapsSet[targetRegionId] || [];
        const trapNames = regionTraps.map(tid => getCard(tid)?.name || tid).join(", ") || "none";
        get().addNotification(`${card.name} reveals traps: ${trapNames}`);

        // Immobilize enemy creatures in region for 2 turns
        const regionCreatures = state.stationedCreatures[targetRegionId] || [];
        const newImmobilized = { ...state.immobilized };
        for (const cid of regionCreatures) {
          const cOwner = state.creatureOwners[cid];
          if (cOwner && cOwner !== playerId) {
            newImmobilized[cid] = 2;
          }
        }
        set({
          playerHand: { ...state.playerHand, [playerId]: newHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          immobilized: newImmobilized,
        });
        return true;
      }

      case "monster-reborn": {
        if (!targetRegionId) return false;

        if (getRegionController(state, targetRegionId) !== playerId) {
          get().addNotification("You can only revive creatures to regions you control.");
          return false;
        }

        // Pick the most recently destroyed creature from any graveyard
        let revivedId = null;
        let revivedOwner = null;
        const allGraves = { ...state.playerGraveyard };
        // Check player's graveyard first, then enemy's
        for (const oid of [playerId, playerId === "player-1" ? "player-2" : "player-1"]) {
          const grave = allGraves[oid] || [];
          if (grave.length > 0) {
            revivedId = grave[grave.length - 1];
            revivedOwner = oid;
            break;
          }
        }
        if (!revivedId) {
          get().addNotification("No creatures in any graveyard to revive.");
          return false;
        }

        const newGraves = { ...state.playerGraveyard };
        newGraves[revivedOwner] = newGraves[revivedOwner].filter(id => id !== revivedId);

        const current = state.stationedCreatures[targetRegionId] || [];
        const newStationed = { ...state.stationedCreatures, [targetRegionId]: [...current, revivedId] };
        const newOwners = { ...state.creatureOwners, [revivedId]: playerId };

        set({
          playerHand: { ...state.playerHand, [playerId]: newHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          playerGraveyard: newGraves,
          stationedCreatures: newStationed,
          creatureOwners: newOwners,
        });
        get().addNotification(`${card.name} revived ${getCard(revivedId)?.name || revivedId}!`);
        return true;
      }

      case "mystical-space-typhoon": {
        if (!targetRegionId) return false;
        const regionTraps = state.trapsSet[targetRegionId] || [];
        const regionField = state.fieldSpells[targetRegionId];

        if (regionTraps.length > 0) {
          const destroyed = regionTraps[0];
          const newTraps = { ...state.trapsSet, [targetRegionId]: regionTraps.filter(id => id !== destroyed) };
          set({
            playerHand: { ...state.playerHand, [playerId]: newHand },
            playerSP: { ...state.playerSP, [playerId]: newSP },
            trapsSet: newTraps,
          });
          get().addNotification(`${card.name} destroyed face-down ${getCard(destroyed)?.name || destroyed}!`);
        } else if (regionField) {
          const newFields = { ...state.fieldSpells };
          delete newFields[targetRegionId];
          set({
            playerHand: { ...state.playerHand, [playerId]: newHand },
            playerSP: { ...state.playerSP, [playerId]: newSP },
            fieldSpells: newFields,
          });
          get().addNotification(`${card.name} destroyed field spell in ${getRegions().find(r => r.id === targetRegionId)?.name || targetRegionId}!`);
        } else {
          get().addNotification("No trap or field spell to destroy in that region.");
          return false;
        }
        return true;
      }

      case "pot-of-greed": {
        // Draw 2 cards immediately
        const deck = [...state.playerDeck[playerId]];
        const drawn = deck.splice(0, Math.min(2, deck.length));
        const afterHand = [...newHand, ...drawn];
        set({
          playerHand: { ...state.playerHand, [playerId]: afterHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          playerDeck: { ...state.playerDeck, [playerId]: deck },
        });
        const names = drawn.map(id => getCard(id)?.name || id).join(", ");
        get().addNotification(`${card.name}: Drew ${drawn.length} card(s): ${names}`);
        return true;
      }

      case "rush-recklessly": {
        if (!targetCreatureId) return false;
        set({
          playerHand: { ...state.playerHand, [playerId]: newHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          tempBuffs: { ...state.tempBuffs, [targetCreatureId]: { atk: 700, turnsLeft: 1 } },
        });
        get().addNotification(`${card.name}: ${getCard(targetCreatureId)?.name || targetCreatureId} gains +700 ATK this turn!`);
        return true;
      }

      case "fissure": {
        if (!targetRegionId) return false;
        const regionCreatures = (state.stationedCreatures[targetRegionId] || [])
          .map(id => getCreature(id))
          .filter(Boolean);
        if (regionCreatures.length === 0) return false;

        // Find enemy creature with lowest ATK
        let lowest = null;
        for (const c of regionCreatures) {
          const cOwner = state.creatureOwners[c.id];
          if (cOwner === playerId) continue;
          if (!lowest || c.atk < lowest.atk) lowest = c;
        }
        if (!lowest) {
          get().addNotification("No enemy creatures in that region.");
          return false;
        }

        const newStationed = { ...state.stationedCreatures };
        newStationed[targetRegionId] = (newStationed[targetRegionId] || []).filter(id => id !== lowest.id);
        const newGraves = { ...state.playerGraveyard };
        const lOwner = state.creatureOwners[lowest.id] || "neutral";
        newGraves[lOwner] = [...(newGraves[lOwner] || []), lowest.id];

        set({
          playerHand: { ...state.playerHand, [playerId]: newHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          stationedCreatures: newStationed,
          playerGraveyard: newGraves,
        });
        get().addNotification(`${card.name} destroyed ${lowest.name} (lowest ATK)!`);
        return true;
      }

      case "reinforcements": {
        if (!targetRegionId) return false;
        if (getRegionController(state, targetRegionId) !== playerId) {
          get().addNotification("You can only summon to regions you control.");
          return false;
        }

        // Search deck for a level 4 or lower creature
        const deck = [...state.playerDeck[playerId]];
        const idx = deck.findIndex(cid => {
          const c = getCreature(cid);
          return c && c.level <= 4;
        });
        if (idx === -1) {
          get().addNotification("No level 4 or lower creature in your deck.");
          return false;
        }

        const summonedId = deck.splice(idx, 1)[0];
        const newStationed = { ...state.stationedCreatures };
        newStationed[targetRegionId] = [...(newStationed[targetRegionId] || []), summonedId];
        const newOwners = { ...state.creatureOwners, [summonedId]: playerId };

        set({
          playerHand: { ...state.playerHand, [playerId]: newHand },
          playerSP: { ...state.playerSP, [playerId]: newSP },
          playerDeck: { ...state.playerDeck, [playerId]: deck },
          stationedCreatures: newStationed,
          creatureOwners: newOwners,
        });
        get().addNotification(`${card.name}: Summoned ${getCard(summonedId)?.name || summonedId} to ${getRegions().find(r => r.id === targetRegionId)?.name || targetRegionId}!`);
        return true;
      }

      default:
        get().addNotification(`Spell ${card.name} effect not implemented.`);
        return false;
    }
  },

  // ── Deploy field spell ────────────────────────────────────
  deployFieldSpell: (playerId, fieldId, regionId) => {
    const state = get();
    const card = getCard(fieldId);
    if (!card || card.type !== "field") return false;

    if (getRegionController(state, regionId) !== playerId) {
      get().addNotification("You can only deploy field spells to regions you control.");
      return false;
    }

    const sp = state.playerSP[playerId];
    if (sp < card.cost) {
      get().addNotification(`Not enough SP. ${card.name} costs ${card.cost} SP.`);
      return false;
    }

    // Remove existing field spell on this region
    const existing = state.fieldSpells[regionId];

    const handIdx = state.playerHand[playerId].indexOf(fieldId);
    if (handIdx === -1) return false;
    const newHand = [...state.playerHand[playerId]];
    newHand.splice(handIdx, 1);

    set({
      playerHand: { ...state.playerHand, [playerId]: newHand },
      playerSP: { ...state.playerSP, [playerId]: sp - card.cost },
      fieldSpells: { ...state.fieldSpells, [regionId]: card.id },
    });

    const regionName = getRegions().find(r => r.id === regionId)?.name || regionId;
    if (existing) {
      get().addNotification(`${card.name} replaced ${getCard(existing)?.name || existing} in ${regionName}. Terrain is now ${card.terrain}.`);
    } else {
      get().addNotification(`${card.name} deployed to ${regionName}. Terrain is now ${card.terrain}.`);
    }
    return true;
  },

  // ── Move creature (with trap check) ──────────────────────
  moveCreatureWithTraps: (creatureId, fromRegionId, toRegionId) => {
    const state = get();
    const owner = getRegionController(state, fromRegionId);
    const destOwner = getRegionController(state, toRegionId);

    const trapIds = destOwner !== owner && destOwner !== "neutral"
      ? getRegionTrapIds(state, toRegionId)
      : [];

    const creature = getCreature(creatureId);
    if (!creature) return null;

    // 1 move per turn
    const creatureOwner = state.creatureOwners[creatureId] || "neutral";
    if (creatureOwner !== "neutral" && (state.movesUsed[creatureOwner] || 0) >= 1) {
      get().addNotification(`${creature.name} cannot move — you have already moved a creature this turn.`);
      return null;
    }

    if (trapIds.length === 0) {
      const fromList = (state.stationedCreatures[fromRegionId] || []).filter(id => id !== creatureId);
      const toList = [...(state.stationedCreatures[toRegionId] || []), creatureId];
      set({
        stationedCreatures: {
          ...state.stationedCreatures,
          [fromRegionId]: fromList,
          [toRegionId]: toList,
        },
        movesUsed: creatureOwner !== "neutral"
          ? { ...state.movesUsed, [creatureOwner]: (state.movesUsed[creatureOwner] || 0) + 1 }
          : state.movesUsed,
      });

      // Check for battle trigger
      get().checkBattle(toRegionId);
      get().checkTowerAttack(toRegionId);
      return { triggered: false };
    }

    const trapId = trapIds[0];
    const result = resolveTrap(trapId, [creature]);
    const remainingTraps = (state.trapsSet[toRegionId] || []).filter(id => id !== trapId);

    let message;
    let lpDamage = 0;
    let bouncedCards = [];

    if (result.destroyed.length > 0) {
      message = `⚠ ${result.trapName} triggered! ${creature.name} was destroyed entering ${getRegions().find(r => r.id === toRegionId)?.name || toRegionId}.`;
    } else if (result.reflectDamage) {
      lpDamage = result.reflectDamage;
      message = `⚠ ${result.trapName} triggered! ${creature.name}'s attack was reflected — its controller takes ${lpDamage} LP damage!`;
    } else if (result.bounced && result.bounced.length > 0) {
      bouncedCards = result.bounced;
      message = `⚠ ${result.trapName} triggered! ${creature.name} was returned to its owner's hand!`;
    } else {
      message = `⚠ ${result.trapName} triggered but ${creature.name} survived!`;
    }

    const newStationed = { ...state.stationedCreatures };
    newStationed[fromRegionId] = (newStationed[fromRegionId] || []).filter(id => id !== creatureId);

    for (const destroyedId of result.destroyed) {
      for (const [rid, ids] of Object.entries(newStationed)) {
        newStationed[rid] = ids.filter(id => id !== destroyedId);
      }
    }

    if (result.survivors.length > 0) {
      newStationed[toRegionId] = [...(newStationed[toRegionId] || []), ...result.survivors];
    }

    // Handle bounced cards — return to owner's hand
    let newHand = { ...state.playerHand };
    if (bouncedCards.length > 0) {
      for (const bouncedId of bouncedCards) {
        const bOwner = state.creatureOwners[bouncedId] || creatureOwner;
        newHand[bOwner] = [...(newHand[bOwner] || []), bouncedId];
      }
    }

    // Handle reflect LP damage
    let newHP = { ...state.playerHP };
    if (lpDamage > 0) {
      const victim = creatureOwner !== "neutral" ? creatureOwner : "player-1";
      const enemyId = victim === "player-1" ? "player-2" : "player-1";
      newHP[victim] = Math.max(0, (newHP[victim] || 8000) - lpDamage);
      // Determine actual controller — the one who SET the trap, not the mover
      // Simplification: damage goes to the creature's owner (the one moving into the trap)
    }

    set({
      stationedCreatures: newStationed,
      trapsSet: { ...state.trapsSet, [toRegionId]: remainingTraps },
      playerHand: newHand,
      playerHP: newHP,
      movesUsed: creatureOwner !== "neutral"
        ? { ...state.movesUsed, [creatureOwner]: (state.movesUsed[creatureOwner] || 0) + 1 }
        : state.movesUsed,
      notifications: [
        { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, message, time: Date.now() },
        ...state.notifications,
      ].slice(0, 50),
    });

    // Check for battle trigger if survivors made it
    if (result.survivors.length > 0) {
      get().checkBattle(toRegionId);
      get().checkTowerAttack(toRegionId);
    }

    return { triggered: true, result, message };
  },

  // ── Battle resolution ────────────────────────────────────
  checkBattle: (regionId) => {
    const state = get();
    const creatures = (state.stationedCreatures[regionId] || [])
      .map(id => getCreature(id))
      .filter(Boolean);

    if (creatures.length < 2) return null;

    // Group by owner (use tracked creature ownership, not region owner)
    const groups = {};
    for (const c of creatures) {
      const owner = state.creatureOwners[c.id] || "neutral";
      if (owner === "neutral") continue;
      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(c);
    }

    const owners = Object.keys(groups);
    if (owners.length < 2 || owners.includes("neutral")) return null;

    const region = getRegions().find(r => r.id === regionId);
    const terrain = region?.terrain || "plains";

    const results = [];
    const destroyed = [];

    // Pair off and resolve
    const group1 = [...groups[owners[0]]];
    const group2 = [...groups[owners[1]]];

    while (group1.length > 0 && group2.length > 0) {
      // Sort each group by ATK descending
      group1.sort((a, b) => getEffectiveAtk(b, terrain, regionId) - getEffectiveAtk(a, terrain, regionId));
      group2.sort((a, b) => getEffectiveAtk(b, terrain, regionId) - getEffectiveAtk(a, terrain, regionId));

      const fighter1 = group1.shift();
      const fighter2 = group2.shift();

      const atk1 = getEffectiveAtk(fighter1, terrain, regionId);
      const atk2 = getEffectiveAtk(fighter2, terrain, regionId);

      if (atk1 > atk2) {
        results.push({ winner: fighter1, loser: fighter2 });
        destroyed.push(fighter2.id);
      } else if (atk2 > atk1) {
        results.push({ winner: fighter2, loser: fighter1 });
        destroyed.push(fighter1.id);
      } else {
        // Tie — both destroyed
        destroyed.push(fighter1.id, fighter2.id);
        results.push({ tie: true, creatures: [fighter1, fighter2] });
      }
    }

    // Each pair's ATK difference damages the loser's controller
    let damageToP1 = 0;
    let damageToP2 = 0;
    for (const r of results) {
      if (r.tie) continue;
      const loserOwner = state.creatureOwners[r.loser.id] || "neutral";
      const diff = getEffectiveAtk(r.winner, terrain, regionId) - getEffectiveAtk(r.loser, terrain, regionId);
      if (loserOwner === "player-1") damageToP1 += diff;
      else if (loserOwner === "player-2") damageToP2 += diff;
    }

    // Remove destroyed creatures (survivors remain — no need to re-add)
    const newStationed = { ...state.stationedCreatures };
    newStationed[regionId] = (newStationed[regionId] || []).filter(id => !destroyed.includes(id));

    // Apply damage
    const newHP = { ...state.playerHP };
    const newCreatureOwners = { ...state.creatureOwners };
    for (const id of destroyed) {
      delete newCreatureOwners[id];
    }

    newHP["player-1"] = Math.max(0, newHP["player-1"] - damageToP1);
    newHP["player-2"] = Math.max(0, newHP["player-2"] - damageToP2);

    // Marker capture happens gradually in endTurn — no instant region flip

    let battleMsg = `⚔ Battle at ${region?.name || regionId}! `;
    for (const r of results) {
      if (r.tie) {
        battleMsg += `${r.creatures[0].name} and ${r.creatures[1].name} destroyed each other (tie). `;
      } else {
        const diff = getEffectiveAtk(r.winner, terrain, regionId) - getEffectiveAtk(r.loser, terrain, regionId);
        battleMsg += `${r.winner.name} (${getEffectiveAtk(r.winner, terrain, regionId)}) defeated ${r.loser.name} (${getEffectiveAtk(r.loser, terrain, regionId)}) — ${diff} LP damage. `;
      }
    }
    if (damageToP1 > 0) battleMsg += `${PLAYER_NAMES["player-1"]} takes ${damageToP1} LP damage. `;
    if (damageToP2 > 0) battleMsg += `${PLAYER_NAMES["player-2"]} takes ${damageToP2} LP damage. `;

    set({
      stationedCreatures: newStationed,
      playerHP: newHP,
      creatureOwners: newCreatureOwners,
      notifications: [
        { id: Date.now() + Math.random(), message: battleMsg, time: Date.now() },
        ...state.notifications,
      ].slice(0, 50),
    });

    // Check win condition
    if (newHP["player-1"] <= 0 || newHP["player-2"] <= 0) {
      const winner = newHP["player-1"] <= 0 ? "player-2" : "player-1";
      get().addNotification(`🏆 Game Over! ${PLAYER_NAMES[winner]} wins!`);
    }

    return { results, damageToP1, damageToP2 };
  },

  // ── Tower attack check ───────────────────────────────────
  // Called after movement into a region. If the region is a tower's home
  // hex and the tower owner has no creatures defending, attacker deals
  // ATK damage directly to the tower.
  checkTowerAttack: (regionId) => {
    const state = get();
    const towerRegions = state.towerRegions;
    // Find which tower (if any) owns this region
    let towerId = null;
    let towerOwner = null;
    if (towerRegions.silver && towerRegions.silver.q !== undefined) {
      const rgn = getRegions().find(r => r.id === regionId);
      if (rgn && rgn.q === towerRegions.silver.q && rgn.r === towerRegions.silver.r) {
        towerId = "silver"; towerOwner = "player-1";
      } else if (rgn && rgn.q === towerRegions.gold.q && rgn.r === towerRegions.gold.r) {
        towerId = "gold"; towerOwner = "player-2";
      }
    }
    if (!towerId) return;

    const creatures = (state.stationedCreatures[regionId] || [])
      .map(id => getCreature(id)).filter(Boolean);
    
    // Group by owner
    const friendly = creatures.filter(c => state.creatureOwners[c.id] === towerOwner);
    const enemies = creatures.filter(c => state.creatureOwners[c.id] !== towerOwner);
    
    if (enemies.length === 0) return;
    if (friendly.length > 0) return; // Defenders present — regular battle handles this

    // Deal damage for each enemy creature on the tower
    let totalDmg = 0;
    const region = getRegions().find(r => r.id === regionId);
    const terrain = region?.terrain || "plains";
    let attackerNames = [];
    for (const c of enemies) {
      const atk = getEffectiveAtk(c, terrain, regionId);
      totalDmg += atk;
      attackerNames.push(c.name);
    }
    
    const newTowerHP = { ...state.towerHP };
    newTowerHP[towerId] = Math.max(0, newTowerHP[towerId] - totalDmg);
    
    set({ towerHP: newTowerHP });
    
    const towerName = towerId === "silver" ? "🏰 Silver King Tower" : "👑 Gold King Tower";
    get().addNotification(
      `💥 ${attackerNames.join(", ")} assault${attackerNames.length > 1 ? "" : "s"} ${towerName} for ${totalDmg} damage! (${newTowerHP[towerId]} HP remaining)`
    );
    
    // Check tower destruction → game over
    if (newTowerHP[towerId] <= 0) {
      const loser = towerOwner;
      const winner = towerOwner === "player-1" ? "player-2" : "player-1";
      set({ playerHP: { ...state.playerHP, [loser]: 0 } });
      get().addNotification(`🏆 ${towerName} has fallen! ${PLAYER_NAMES[winner]} wins!`);
    }
  },

  // ── Auto-play mode ───────────────────────────────────────
  autoPlay: false,
  autoPlayTimer: null,

  startAutoPlay: () => {
    const state = get();
    if (state.autoPlay) return;
    set({ autoPlay: true });
    get().addNotification("AI vs AI auto-play started.");
    // Kick off the loop regardless of whose turn it is
    if (state.gameStarted) {
      setTimeout(() => get().endTurn(), 800);
    }
  },

  stopAutoPlay: () => {
    const state = get();
    if (state.autoPlayTimer) clearTimeout(state.autoPlayTimer);
    set({ autoPlay: false, autoPlayTimer: null });
    get().addNotification("Auto-play stopped.");
  },

  // ── End turn / process phase ─────────────────────────────
  endTurn: () => {
    const state = get();
    const player = state.currentPlayer;

    // Draw 1 card
    get().drawCard(player);

    // ── Process marker captures ─────────────────────────────
    const newMarkers = { ...state.regionMarkers };
    for (const regionId of Object.keys(newMarkers)) {
      const creatures = state.stationedCreatures[regionId] || [];
      const p1Count = creatures.filter(cid => state.creatureOwners[cid] === "player-1").length;
      const p2Count = creatures.filter(cid => state.creatureOwners[cid] === "player-2").length;
      if (p1Count === 0 && p2Count === 0) continue;

      const current = newMarkers[regionId];
      let p1 = current["player-1"] || 0;
      let p2 = current["player-2"] || 0;
      const neutral = 5 - p1 - p2;

      // Each creature captures 1 enemy marker (enemy first, then neutral)
      if (p1Count > 0) {
        const capP2 = Math.min(p1Count, p2);
        const capNeutral = Math.min(p1Count - capP2, neutral);
        p1 += capP2 + capNeutral;
        p2 -= capP2;
      }
      if (p2Count > 0) {
        const capP1 = Math.min(p2Count, p1);
        const capNeutral = Math.min(p2Count - capP1, Math.max(0, neutral));
        p2 += capP1 + capNeutral;
        p1 -= capP1;
      }
      p1 = Math.max(0, Math.min(5, p1));
      p2 = Math.max(0, Math.min(5, p2));
      if (p1 + p2 > 5) p2 = 5 - p1;
      newMarkers[regionId] = { "player-1": p1, "player-2": p2 };
    }

    // Gain SP: floor(total markers / 5) + 2 base
    const totalMarkers = Object.values(state.regionMarkers).reduce(
      (sum, m) => sum + (m[player] || 0), 0
    );
    const spGain = Math.floor(totalMarkers / 5) + 2;

    // Decay temp buffs
    const newBuffs = { ...state.tempBuffs };
    for (const [cid, buff] of Object.entries(newBuffs)) {
      buff.turnsLeft -= 1;
      if (buff.turnsLeft <= 0) delete newBuffs[cid];
    }

    // Decay immobilize
    const newImmob = { ...state.immobilized };
    for (const [cid, turns] of Object.entries(newImmob)) {
      if (turns <= 1) delete newImmob[cid];
      else newImmob[cid] = turns - 1;
    }

    // ── Apocalypse wave: spawn + move ───────────────────────
    let newApoc = { ...state.apocalypseCreatures };
    const newHP = { ...state.playerHP };
    const newStationed = { ...state.stationedCreatures };
    const newGraves = { ...state.playerGraveyard };

    if (state.apocalypseWave) {
      // Find player capitals (region with most markers for each player)
      const dataMarkers = state.regionMarkers;
      let p1Capital = null, p2Capital = null;
      let p1Max = 0, p2Max = 0;
      for (const [rid, m] of Object.entries(dataMarkers)) {
        if ((m["player-1"] || 0) > p1Max) { p1Max = m["player-1"] || 0; p1Capital = rid; }
        if ((m["player-2"] || 0) > p2Max) { p2Max = m["player-2"] || 0; p2Capital = rid; }
      }

      // Spawn new wave creatures every turn during apocalypse
      const edgeRegions = getRegions().filter(r => {
        return r.q <= -2 || r.q >= 3 || r.r <= -2 || r.r >= 2;
      }).map(r => r.id);
      const templates = [
        { art: "🐉", name: "Shadow Wyrm", atk: 2800 },
        { art: "👁", name: "Void Stalker", atk: 2400 },
        { art: "💀", name: "Blight Titan", atk: 3000 },
        { art: "🦅", name: "Harbinger", atk: 2200 },
        { art: "🗿", name: "Dread Colossus", atk: 2600 },
      ];
      const spawnCount = state.turn % 2 === 0 ? 3 : 1;
      let waveIdx = Object.keys(newApoc).length;
      const spawns = [...edgeRegions].sort(() => Math.random() - 0.5).slice(0, spawnCount);
      for (const regionId of spawns) {
        const tmpl = templates[Math.floor(Math.random() * templates.length)];
        const rgn = getRegions().find(r => r.id === regionId);
        const p1CapRegion = p1Capital ? getRegions().find(r => r.id === p1Capital) : null;
        const p2CapRegion = p2Capital ? getRegions().find(r => r.id === p2Capital) : null;
        const distToP1 = (rgn && p1CapRegion) ? hexDist(rgn.q, rgn.r, p1CapRegion.q, p1CapRegion.r) : 0;
        const distToP2 = (rgn && p2CapRegion) ? hexDist(rgn.q, rgn.r, p2CapRegion.q, p2CapRegion.r) : 0;
        const targetCapital = p1Capital && p2Capital
          ? (distToP1 > distToP2 ? p1Capital : p2Capital)
          : (p1Capital || p2Capital || regionId);
        newApoc[`w${waveIdx}`] = { ...tmpl, region: regionId, targetTower: targetCapital };
        waveIdx++;
        get().addNotification(`⚡ ${tmpl.art} ${tmpl.name} emerges at ${rgn?.name || regionId}!`);
      }

      // Move each wave creature toward its target
      for (const [key, wc] of Object.entries({ ...newApoc })) {
        const fromRgn = getRegions().find(r => r.id === wc.region);
        const targetRgn = getRegions().find(r => r.id === wc.targetTower);
        if (!fromRgn || !targetRgn) continue;

        // Already at target capital — deal direct damage
        if (wc.region === wc.targetTower) {
          const towerOwner = wc.targetTower === p1Capital ? "player-1" : "player-2";
          newHP[towerOwner] = Math.max(0, newHP[towerOwner] - wc.atk);
          get().addNotification(`💥 ${wc.name} smashes ${targetRgn.name} for ${wc.atk} LP damage!`);
          delete newApoc[key];
          continue;
        }

        // Find adjacent region closest to target
        const adjacent = getAdjacentRegions(fromRgn);
        let best = null;
        let bestDist = Infinity;
        for (const adj of adjacent) {
          const d = hexDist(adj.q, adj.r, targetRgn.q, targetRgn.r);
          if (d < bestDist) { bestDist = d; best = adj; }
        }
        if (!best) continue;

        const destId = best.id;
        newApoc[key] = { ...wc, region: destId };

        // Fight player creatures at destination
        const destCreatures = (newStationed[destId] || []).map(cid => getCreature(cid)).filter(Boolean);
        if (destCreatures.length > 0) {
          let strongest = destCreatures[0];
          let strongestAtk = getEffectiveAtk(strongest, best.terrain, destId);
          for (const c of destCreatures) {
            const cAtk = getEffectiveAtk(c, best.terrain, destId);
            if (cAtk > strongestAtk) { strongestAtk = cAtk; strongest = c; }
          }
          if (wc.atk > strongestAtk) {
            const diff = wc.atk - strongestAtk;
            const owner = state.creatureOwners[strongest.id] || "neutral";
            newStationed[destId] = (newStationed[destId] || []).filter(cid => cid !== strongest.id);
            newGraves[owner] = [...(newGraves[owner] || []), strongest.id];
            if (owner === "player-1" || owner === "player-2") {
              newHP[owner] = Math.max(0, newHP[owner] - diff);
            }
            get().addNotification(`💀 ${wc.name} destroyed ${strongest.name} at ${best.name} (${diff} LP)!`);
          } else {
            delete newApoc[key];
            get().addNotification(`⚔ ${strongest.name} vanquished ${wc.name} at ${best.name}!`);
          }
        } else if (destId === wc.targetTower) {
          // Reached capital region with no defenders — smite it
          const towerOwner = wc.targetTower === p1Capital ? "player-1" : "player-2";
          newHP[towerOwner] = Math.max(0, newHP[towerOwner] - wc.atk);
          get().addNotification(`💥 ${wc.name} reaches ${best.name} and smashes the tower for ${wc.atk} LP!`);
          delete newApoc[key];
        }
      }
    }

    const nextPlayer = player === "player-1" ? "player-2" : "player-1";
    set({
      playerSP: { ...state.playerSP, [player]: state.playerSP[player] + spGain },
      turn: state.turn + 1,
      currentPlayer: nextPlayer,
      regionMarkers: newMarkers,
      tempBuffs: newBuffs,
      immobilized: newImmob,
      apocalypseCreatures: newApoc,
      playerHP: newHP,
      stationedCreatures: newStationed,
      playerGraveyard: newGraves,
      summonsUsed: { "player-1": 0, "player-2": 0 },
      movesUsed: { "player-1": 0, "player-2": 0 },
    });

    get().addNotification(`Turn ${state.turn} ended. ${player === "player-1" ? "Crimson Dominion" : "Azure Coalition"} gained ${spGain} SP.`);

    // Process AI turn for the next player
    setTimeout(() => get().processAITurn(nextPlayer), 500);
  },

  // ── AI turn (parameterized for any player) ────────────────
  processAITurn: (playerId) => {
    const state = get();
    const enemyId = playerId === "player-1" ? "player-2" : "player-1";
    const playerName = playerId === "player-1" ? "Crimson Dominion" : "Azure Coalition";

    get().addNotification(`${playerName} is taking their turn...`);

    // AI draws a card
    get().drawCard(playerId);

    // AI gains SP
    const aiTotalMarkers = Object.values(state.regionMarkers).reduce(
      (sum, m) => sum + (m[playerId] || 0), 0
    );
    const aiSPGain = Math.floor(aiTotalMarkers / 5) + 2;
    set({
      playerSP: { ...state.playerSP, [playerId]: state.playerSP[playerId] + aiSPGain },
    });

    const aiHand = [...state.playerHand[playerId]];
    const aiSP = state.playerSP[playerId] + aiSPGain;
    let remainingSP = aiSP;

    const aiOwnedRegions = Object.keys(state.regionMarkers).filter(
      rid => getRegionController(state, rid) === playerId
    );

    // Debug: log AI's owned region count
    if (aiOwnedRegions.length === 0) {
      get().addNotification(`⚠ ${playerName} controls NO regions — cannot deploy or move.`);
    }

    const newHand = [...aiHand];
    const newStationed = { ...state.stationedCreatures };
    const newTraps = { ...state.trapsSet };
    const newCreatureOwners = { ...state.creatureOwners };
    const newEquipped = { ...state.equippedTo };
    const newFieldSpells = { ...state.fieldSpells };
    const newTempBuffs = { ...state.tempBuffs };
    const newImmobilized = { ...state.immobilized };
    let spSpent = 0;

    // Deploy at most 1 creature per turn to summoning circles
    const summonCircleIds = state.summonCircles
      .filter(sc => sc.owner === playerId)
      .map(sc => {
        const rgn = getRegions().find(r => r.q === sc.q && r.r === sc.r);
        return rgn?.id;
      })
      .filter(Boolean);
    let aiSummons = 0;
    for (const regionId of summonCircleIds) {
      if (remainingSP <= 0 || aiSummons >= 1) break;
      // Also verify the summoning circle is actually controlled by the AI
      if (getRegionController(state, regionId) !== playerId) continue;
      const cardIdx = newHand.findIndex((cid) => {
        const card = getCard(cid);
        return card && card.type === "creature" && card.cost <= remainingSP;
      });
      if (cardIdx === -1) break;

      const cardId = newHand.splice(cardIdx, 1)[0];
      const card = getCard(cardId);
      remainingSP -= card.cost;
      spSpent += card.cost;
      aiSummons++;

      const current = newStationed[regionId] || [];
      newStationed[regionId] = [...current, cardId];
      newCreatureOwners[cardId] = playerId;
    }

    // AI sets traps in some regions
    for (const regionId of aiOwnedRegions) {
      if (remainingSP <= 0) break;
      const trapIdx = newHand.findIndex((cid) => {
        const card = getCard(cid);
        return card && card.type === "trap" && card.cost <= remainingSP;
      });
      if (trapIdx === -1) break;

      const trapId = newHand.splice(trapIdx, 1)[0];
      const card = getCard(trapId);
      remainingSP -= card.cost;
      spSpent += card.cost;

      const current = newTraps[regionId] || [];
      newTraps[regionId] = [...current, trapId];
    }

    // AI equips creatures with equipment cards
    for (const [regionId, creatureIds] of Object.entries({ ...state.stationedCreatures })) {
      if (remainingSP <= 0) break;
      if (getRegionController(state, regionId) !== playerId) continue;

      const eqIdx = newHand.findIndex((cid) => {
        const card = getCard(cid);
        return card && card.type === "equipment" && card.cost <= remainingSP;
      });
      if (eqIdx === -1) continue;

      const eqId = newHand.splice(eqIdx, 1)[0];
      const eqCard = getCard(eqId);
      remainingSP -= eqCard.cost;
      spSpent += eqCard.cost;

      const cid = creatureIds[0];
      if (cid) {
        const currentEq = newEquipped[cid] || [];
        newEquipped[cid] = [...currentEq, eqId];
        get().addNotification(`${playerName} equipped ${eqCard.name} to ${getCard(cid)?.name || cid}.`);
      }
    }

    // AI deploys field spells on its regions
    for (const regionId of aiOwnedRegions) {
      if (remainingSP <= 1) break;
      const fieldIdx = newHand.findIndex((cid) => {
        const card = getCard(cid);
        return card && card.type === "field" && card.cost <= remainingSP;
      });
      if (fieldIdx === -1) break;

      const fieldId = newHand.splice(fieldIdx, 1)[0];
      const fieldCard = getCard(fieldId);
      remainingSP -= fieldCard.cost;
      spSpent += fieldCard.cost;

      newFieldSpells[regionId] = fieldId;
    }

    // AI casts offensive spells on enemy regions
    const enemyRegions = Object.keys(state.regionMarkers).filter(
      rid => getRegionController(state, rid) === enemyId
    );

    if (enemyRegions.length > 0) {
      for (let i = newHand.length - 1; i >= 0; i--) {
        if (remainingSP <= 0) break;
        const cid = newHand[i];
        const card = getCard(cid);
        if (!card || card.type !== "spell") continue;
        if (card.target === "self" || card.target === "creature") continue;
        if (card.cost > remainingSP) continue;

        const targetId = enemyRegions[Math.floor(Math.random() * enemyRegions.length)];
        remainingSP -= card.cost;
        spSpent += card.cost;
        newHand.splice(i, 1);

        if (card.id === "dark-hole") {
          const regionCreatures = (newStationed[targetId] || []);
          if (regionCreatures.length > 0) {
            const graves = { ...state.playerGraveyard };
            for (const cid2 of regionCreatures) {
              const cOwner = state.creatureOwners[cid2] || "neutral";
              graves[cOwner] = [...(graves[cOwner] || []), cid2];
            }
            newStationed[targetId] = [];
          }
        } else if (card.id === "mystical-space-typhoon") {
          const regionTraps = (newTraps[targetId] || []);
          if (regionTraps.length > 0) {
            const destroyed = regionTraps[regionTraps.length - 1];
            newTraps[targetId] = regionTraps.filter(id => id !== destroyed);
          } else if (newFieldSpells[targetId]) {
            delete newFieldSpells[targetId];
          }
        } else if (card.id === "fissure") {
          const regionCreatures = (newStationed[targetId] || [])
            .map(cid2 => getCreature(cid2)).filter(Boolean);
          if (regionCreatures.length > 0) {
            let lowest = regionCreatures[0];
            for (const c of regionCreatures) {
              if (c.atk < lowest.atk) lowest = c;
            }
            newStationed[targetId] = (newStationed[targetId] || []).filter(id => id !== lowest.id);
          }
        } else if (card.id === "swords-of-revealing-light") {
          const enemyCreatures = newStationed[targetId] || [];
          for (const ecid of enemyCreatures) {
            const cOwner = state.creatureOwners[ecid];
            if (cOwner === enemyId) newImmobilized[ecid] = 2;
          }
        }
      }
    }

    // AI casts self/deck spells
    for (let i = newHand.length - 1; i >= 0; i--) {
      if (remainingSP <= 0) break;
      const cid = newHand[i];
      const card = getCard(cid);
      if (!card || card.type !== "spell") continue;
      if (card.target !== "self" && card.target !== "deck") continue;
      if (card.cost > remainingSP) continue;

      remainingSP -= card.cost;
      spSpent += card.cost;
      newHand.splice(i, 1);

      if (card.id === "pot-of-greed") {
        const deck = [...state.playerDeck[playerId]];
        const drawn = deck.splice(0, Math.min(2, deck.length));
        newHand.push(...drawn);
        set({ playerDeck: { ...state.playerDeck, [playerId]: deck } });
      } else if (card.id === "reinforcements") {
        const deck = [...state.playerDeck[playerId]];
        const idx = deck.findIndex(cid2 => {
          const c = getCreature(cid2);
          return c && c.level <= 4;
        });
        if (idx !== -1) {
          const summonedId = deck.splice(idx, 1)[0];
          const rear = aiOwnedRegions[aiOwnedRegions.length - 1];
          newStationed[rear] = [...(newStationed[rear] || []), summonedId];
          newCreatureOwners[summonedId] = playerId;
          set({ playerDeck: { ...state.playerDeck, [playerId]: deck } });
        }
      }
    }

    // AI casts creature-buff spells on its forward creatures
    for (let i = newHand.length - 1; i >= 0; i--) {
      if (remainingSP <= 0) break;
      const cid = newHand[i];
      const card = getCard(cid);
      if (!card || card.type !== "spell" || card.target !== "creature") continue;
      if (card.cost > remainingSP) continue;

      let targetCreature = null;
      for (const [rid, cids] of Object.entries({ ...newStationed })) {
        if (getRegionController(state, rid) !== playerId) continue;
        const region = getRegions().find(r => r.id === rid);
        const adj = region ? getAdjacentRegions(region).map(r => r.id) : [];
        const isForward = adj.some(aid => {
          const ctrl = getRegionController(state, aid);
          return ctrl === enemyId || ctrl === "neutral";
        });
        if (isForward && cids.length > 0) {
          targetCreature = cids[0];
          break;
        }
      }
      if (!targetCreature) {
        for (const cids of Object.values({ ...newStationed })) {
          if (cids.length > 0) { targetCreature = cids[0]; break; }
        }
      }
      if (!targetCreature) continue;

      remainingSP -= card.cost;
      spSpent += card.cost;
      newHand.splice(i, 1);

      if (card.id === "rush-recklessly") {
        newTempBuffs[targetCreature] = { atk: 700, turnsLeft: 1 };
      }
    }

    // AI moves 1 creature toward enemy territory
    let movedNotifications = [];
    let battleRegions = new Set();
    let aiMoves = 0;

    for (const [regionId, creatureIds] of Object.entries({ ...state.stationedCreatures })) {
      if (aiMoves >= 1) break;
      if (getRegionController(state, regionId) !== playerId) continue;
      if (creatureIds.length === 0) continue;

      const region = getRegions().find((r) => r.id === regionId);
      if (!region) continue;

      // Pick a movable creature and find reachable targets within its movement range
      const movableCreatureId = creatureIds.find(cid => !state.immobilized[cid]) || creatureIds[0];
      const movableCreature = getCreature(movableCreatureId);
      const maxSteps = getMovementRange(movableCreature?.level || 4);
      const reachable = getReachableHexes(region.q, region.r, maxSteps);
      const targets = reachable
        .map(({ region: r }) => r.id)
        .filter((adjId) => {
          const ctrl = getRegionController(state, adjId);
          return ctrl === enemyId || ctrl === "neutral";
        });

      if (targets.length === 0) continue;

      const creatureId = movableCreatureId;
      const targetId = targets[Math.floor(Math.random() * targets.length)];

      const destCtrl = getRegionController(state, targetId);
      const trapIds = destCtrl === enemyId
        ? getRegionTrapIds(state, targetId)
        : [];

      const creature = getCreature(creatureId);
      let survived = true;

      if (trapIds.length > 0) {
        const trapId = trapIds[0];
        const result = resolveTrap(trapId, [creature]);
        const remainingTraps = (newTraps[targetId] || []).filter((id) => id !== trapId);
        newTraps[targetId] = remainingTraps;

        if (result.destroyed.includes(creatureId)) {
          survived = false;
          const fromList = (newStationed[regionId] || []).filter((id) => id !== creatureId);
          newStationed[regionId] = fromList;
          movedNotifications.push(`${playerName}'s ${creature?.name || creatureId} was destroyed by ${result.trapName}!`);
        }
      }

      if (survived) {
        const fromList = (newStationed[regionId] || []).filter((id) => id !== creatureId);
        newStationed[regionId] = fromList;
        newStationed[targetId] = [...(newStationed[targetId] || []), creatureId];
        aiMoves++;
        movedNotifications.push(`${playerName} moved ${creature?.name || creatureId} (Lv${creature?.level || "?"}, ${maxSteps} step range) to ${getRegions().find((r) => r.id === targetId)?.name || targetId}.`);
        // Animate the AI move
        const fromRgn = getRegions().find(r => r.id === regionId);
        const toRgn = getRegions().find(r => r.id === targetId);
        if (fromRgn && toRgn) {
          const [fx, , fz] = hexToWorld(fromRgn.q, fromRgn.r);
          const [tx, , tz] = hexToWorld(toRgn.q, toRgn.r);
          startMovementAnim(creatureId, [fx, fromRgn.height + 0.02, fz], [tx, toRgn.height + 0.02, tz], 600);
        }
        if (destCtrl === enemyId) {
          battleRegions.add(targetId);
        }
      }
    }

    // Apply accumulated state FIRST (before any early return)
    set({
      playerHand: { ...state.playerHand, [playerId]: newHand },
      playerSP: { ...state.playerSP, [playerId]: remainingSP },
      stationedCreatures: newStationed,
      trapsSet: newTraps,
      creatureOwners: newCreatureOwners,
      equippedTo: newEquipped,
      fieldSpells: newFieldSpells,
      tempBuffs: newTempBuffs,
      immobilized: newImmobilized,
    });

    // Generate deck if empty
    if (state.playerDeck[playerId].length === 0 && newHand.length === 0) {
      const deckId = DECK_IDS[Math.floor(Math.random() * DECK_IDS.length)];
      const cards = [...getDeckCardIds(deckId)];
      const shuffled = cards.sort(() => Math.random() - 0.5);
      const draw = shuffled.splice(0, 4);
      set({
        playerDeck: { ...state.playerDeck, [playerId]: shuffled },
        playerHand: { ...state.playerHand, [playerId]: [...newHand, ...draw] },
      });
      get().addNotification(`${playerName} has prepared their forces.`);
      // In auto-play, schedule next endTurn
      if (get().autoPlay) {
        const timer = setTimeout(() => get().endTurn(), 1000);
        set({ autoPlayTimer: timer });
      }
      return;
    }

    for (const msg of movedNotifications) {
      get().addNotification(msg);
    }

    const deployedCount = Object.values(newStationed).reduce((sum, cids) => {
      return sum + cids.filter(cid => newCreatureOwners[cid] === playerId).length;
    }, 0);
    const deployedCountBefore = Object.values(state.stationedCreatures).reduce((sum, cids) => {
      return sum + cids.filter(cid => state.creatureOwners[cid] === playerId).length;
    }, 0);

    if (spSpent > 0) {
      get().addNotification(`${playerName} deployed forces (spent ${spSpent} SP). ${deployedCount} creatures on board. (Normal summons limited to 1/turn; special summons via spells are additional.)`);
    }

    if (movedNotifications.length > 0) {
      get().addNotification(`${playerName} moved ${movedNotifications.length} creature(s).`);
    } else if (deployedCount > 0) {
      get().addNotification(`${playerName} did NOT move — no reachable enemy/neutral targets.`);
    }

    // Resolve battles where AI moved into enemy regions
    for (const regionId of battleRegions) {
      get().checkBattle(regionId);
    }

    // In auto-play mode, schedule next endTurn
    if (get().autoPlay) {
      const timer = setTimeout(() => get().endTurn(), 1200);
      set({ autoPlayTimer: timer });
    }
  },

  // ── Direct state setters (for move, station, traps) ──────
  setRegionMarkers: (regionId, p1, p2) =>
    set((state) => ({
      regionMarkers: { ...state.regionMarkers, [regionId]: { "player-1": p1, "player-2": p2 } },
    })),

  stationCreature: (regionId, creatureId) =>
    set((state) => {
      const current = state.stationedCreatures[regionId] || [];
      const cleaned = {};
      for (const [rid, ids] of Object.entries(state.stationedCreatures)) {
        if (rid !== regionId) cleaned[rid] = ids.filter(id => id !== creatureId);
      }
      return {
        stationedCreatures: { ...cleaned, [regionId]: [...current, creatureId] },
      };
    }),

  moveCreature: (creatureId, fromRegionId, toRegionId) =>
    set((state) => {
      const fromList = (state.stationedCreatures[fromRegionId] || []).filter(id => id !== creatureId);
      const toList = [...(state.stationedCreatures[toRegionId] || []), creatureId];
      return {
        stationedCreatures: {
          ...state.stationedCreatures,
          [fromRegionId]: fromList,
          [toRegionId]: toList,
        },
      };
    }),

  setTrap: (regionId, trapId) =>
    set((state) => {
      const current = state.trapsSet[regionId] || [];
      return { trapsSet: { ...state.trapsSet, [regionId]: [...current, trapId] } };
    }),
}));

// ── Helpers ────────────────────────────────────────────────
function getEffectiveAtk(creature, terrain, regionId) {
  let atk = creature.atk || 0;
  const state = useGameStore.getState();

  // Check for terrain override from field spell
  let effectiveTerrain = terrain;
  if (regionId && state.fieldSpells[regionId]) {
    const fieldCard = getCard(state.fieldSpells[regionId]);
    if (fieldCard && fieldCard.terrain) {
      effectiveTerrain = fieldCard.terrain;
    }
  }

  const bonus = FIELD_ELEMENT_BONUS[effectiveTerrain];
  if (bonus && bonus.kinds.includes(creature.kind)) {
    atk += bonus.atk;
  }
  // Equipment bonuses
  const equippedIds = state.equippedTo[creature.id] || [];
  for (const eqId of equippedIds) {
    const eq = getCard(eqId);
    if (eq && eq.bonus) {
      atk += eq.bonus.atk || 0;
    }
  }
  // Temp buffs
  const buff = state.tempBuffs[creature.id];
  if (buff && buff.atk) {
    atk += buff.atk;
  }
  return atk;
}

export function findCreatureRegion(state, creatureId) {
  for (const [regionId, ids] of Object.entries(state.stationedCreatures)) {
    if (ids.includes(creatureId)) return regionId;
  }
  return null;
}

export function getRegionController(state, regionId) {
  const markers = state.regionMarkers[regionId];
  if (!markers) return "neutral";
  const p1 = markers["player-1"] || 0;
  const p2 = markers["player-2"] || 0;
  if (p1 > p2) return "player-1";
  if (p2 > p1) return "player-2";
  return "neutral";
}

export function getRegionOwner(state, regionId) {
  return getRegionController(state, regionId);
}

function hexDist(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function getRegionCreatures(state, regionId) {
  return (state.stationedCreatures[regionId] || []).map(getCreature).filter(Boolean);
}

export function getRegionTraps(state, regionId) {
  return state.trapsSet[regionId] || [];
}

// ── Player display data ────────────────────────────────────
export const PLAYER_COLORS = {
  "player-1": "#e63946",
  "player-2": "#457b9d",
  "neutral": "#888888",
};

export const PLAYER_NAMES = {
  "player-1": "Crimson Dominion",
  "player-2": "Azure Coalition",
  "neutral": "Unclaimed",
};
