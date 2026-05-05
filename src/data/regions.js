// Region map: axial hex coords + terrain + names
// Axial coords: q (column), r (row)
// World conversion: x = size * (3/2 * q), z = size * (sqrt(3)/2 * q + sqrt(3) * r)

import { BATTLEFIELD_REGIONS, BATTLEFIELD_META } from "./battlefieldMap";

export const HEX_SIZE = 1.6;

// ── 61 shared region IDs (radius-4 hexagon) ──────────────────
const REGION_IDS = [
  "ashen-gate",   "black-bog",    "bleakmoor",    "blightwood",
  "bloodfen",     "bonefield",    "brimstone",    "charnel",
  "cinder-crest", "cinder-moor",  "corpse-mire",  "darkwater",
  "deadwood",     "deep-water",   "doomcrest",    "dragons-perch",
  "dreadmarsh",   "dreadpeak",    "duskwood",     "emberfall",
  "fire-hearth",  "forge-gate",   "frostpeak",    "gloomfen",
  "gloomwood",    "gravecrest",   "grey-marches", "grimhearth",
  "grimstone",    "high-plains",  "iron-peak",    "ironmaw",
  "ironwood",     "nightwood",    "obsidian-marsh","ravenwood",
  "rotwood",      "rustfield",    "shadowfen",    "shadowmoor",
  "silver-prairie","skyreach",    "sorrowfield",  "soulmere",
  "stillwater",   "stonewail",    "storm-bay",    "stormcrest",
  "sunken-hollow","the-spire",    "thornwood",    "twin-peaks",
  "voidmarsh",    "wastefield",   "widowwood",    "wildergrove",
  "wind-shear",   "witherfield",  "wolfs-wood",   "wraithpeak",
  "rustmaw",
];

function nameToLabel(id) {
  return id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// Terrain height ranges
const H = { plains: [0.3,0.7], forest: [0.5,1.1], mountain: [1.2,2.2], swamp: [0.2,0.5], water: [0.1,0.3], volcanic: [1.0,2.6] };

function h(terrain, rand) {
  const [lo, hi] = H[terrain];
  return Math.round((lo + rand() * (hi - lo)) * 100) / 100;
}

// ── Map 1: Ashen Wastes ──────────────────────────────────────
function ashenWastes(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  const absQ = Math.abs(q);
  // Central volcanic spine
  if (absQ <= 1 && Math.abs(r) <= 2) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Mountain ridges flanking center
  if ((absQ === 2 && Math.abs(r) <= 2) || (absQ === 3 && Math.abs(r) <= 1)) return { terrain: "mountain", height: h("mountain", rand) };
  // Swamp pockets in corners
  if (dist > 3.5 && rand() > 0.5) return { terrain: "swamp", height: h("swamp", rand) };
  // Forest on mid-edges
  if (dist > 2.8 && absQ >= 2) return { terrain: "forest", height: h("forest", rand) };
  // Water features
  if (((q === -3 && r === 3) || (q === 3 && r === -3) || (q === -3 && r === -2) || (q === 3 && r === 2))) return { terrain: "water", height: h("water", rand) };
  // Plains elsewhere
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 2: Shadow Marshes ────────────────────────────────────
function shadowMarshes(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  // Central swamp basin
  if (dist < 2.5) return { terrain: "swamp", height: h("swamp", rand) };
  // Water ring at mid-distance creating chokepoints
  if (dist > 2.3 && dist < 3.3 && (Math.abs(q) < 2 || Math.abs(r) < 2)) return { terrain: "water", height: h("water", rand) };
  // Forest on outer ring
  if (dist > 2.8) return { terrain: "forest", height: h("forest", rand) };
  // Volcanic pockets
  if ((Math.abs(q) === 3 && r === 0) || (q === 0 && Math.abs(r) === 3)) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Mountain corners
  if (dist > 3.5) return { terrain: "mountain", height: h("mountain", rand) };
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 3: Iron Ridges ───────────────────────────────────────
function ironRidges(q, r, rand) {
  const absQ = Math.abs(q);
  // Three mountain lanes creating corridors
  if (absQ === 3 && Math.abs(r) <= 2) return { terrain: "mountain", height: h("mountain", rand) };
  if (absQ === 1 && Math.abs(r) <= 3 && Math.abs(r) >= 1) return { terrain: "mountain", height: h("mountain", rand) };
  // Volcanic center
  if (absQ <= 1 && Math.abs(r) <= 1) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Water in low valleys
  if ((q === -2 && r === -1) || (q === 2 && r === 1) || (q === 0 && r === -3) || (q === 0 && r === 3)) return { terrain: "water", height: h("water", rand) };
  // Swamp in depressions
  if ((q === -2 && r === 2) || (q === 2 && r === -2)) return { terrain: "swamp", height: h("swamp", rand) };
  // Forest on edge positions
  if (Math.abs(r) >= 3) return { terrain: "forest", height: h("forest", rand) };
  // Plains corridors between mountains
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 4: Blightwood ────────────────────────────────────────
function blightwood(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  // Dense forest everywhere
  if (dist > 1.2) return { terrain: "forest", height: h("forest", rand) };
  // Central blighted volcanic clearing
  if (dist < 0.8) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Scattered swamp clearings
  if ((Math.abs(q) === 2 && Math.abs(r) === 2) || (q === 3 && r === -1) || (q === -3 && r === 1)) return { terrain: "swamp", height: h("swamp", rand) };
  // Water features
  if ((q === 1 && r === -3) || (q === -1 && r === 3) || (q === -2 && r === -3)) return { terrain: "water", height: h("water", rand) };
  // A few mountain peaks rising above the canopy
  if ((Math.abs(q) === 3 && r === 0) || (q === 0 && Math.abs(r) === 3)) return { terrain: "mountain", height: h("mountain", rand) };
  return { terrain: "plains", height: h("plains", rand) };
}

// ── Map 5: Cinder Plains ─────────────────────────────────────
function cinderPlains(q, r, rand) {
  const dist = Math.sqrt(q*q + r*r);
  // Mostly open plains
  if (dist < 3.5 && rand() > 0.3) return { terrain: "plains", height: h("plains", rand) };
  // Scattered volcanic pockets
  if (rand() > 0.6) return { terrain: "volcanic", height: h("volcanic", rand) };
  // Mountain rim
  if (dist > 3.2) return { terrain: "mountain", height: h("mountain", rand) };
  // Water oases
  if ((Math.abs(q) === 3 && r === 0) || (q === 0 && Math.abs(r) === 3) || (q === 2 && r === -3) || (q === -2 && r === 3)) return { terrain: "water", height: h("water", rand) };
  // Forest patches
  if (dist > 2 && dist < 3 && rand() > 0.5) return { terrain: "forest", height: h("forest", rand) };
  return { terrain: "swamp", height: h("swamp", rand) };
}

// ── Build all maps ───────────────────────────────────────────
const MAP_GENERATORS = {
  "ashen-wastes":      { name: "Ashen Wastes",      desc: "Volcanic spine flanked by mountain ridges. Control the high ground.",        fn: ashenWastes },
  "shadow-marshes":    { name: "Shadow Marshes",    desc: "A sunken swamp basin ringed by water. Chokepoints define the battle.",      fn: shadowMarshes },
  "iron-ridges":       { name: "Iron Ridges",       desc: "Parallel mountain ranges form three corridors. Lane control is everything.", fn: ironRidges },
  "blightwood":        { name: "Blightwood",        desc: "Dense dark forest with a blighted volcanic heart. Close-quarters combat.",  fn: blightwood },
  "cinder-plains":     { name: "Cinder Plains",     desc: "Open plains dotted with volcanic pockets. Mobility is key.",                 fn: cinderPlains },
};

const MAP_POOL = {};

for (const [mapId, def] of Object.entries(MAP_GENERATORS)) {
  const rand = rng(mapId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const regions = [];
  let idx = 0;
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) > 4) continue;
      const { terrain, height } = def.fn(q, r, rand);
      regions.push({
        id: REGION_IDS[idx],
        q, r, terrain,
        name: nameToLabel(REGION_IDS[idx]),
        height,
      });
      idx++;
    }
  }
  MAP_POOL[mapId] = { name: def.name, description: def.desc, regions };
}

// ── Map 6: Shattered Realm (battlefield map — currently the ONLY active map) ──
MAP_POOL["shattered-realm"] = {
  name: BATTLEFIELD_META.name,
  description: BATTLEFIELD_META.description,
  regions: BATTLEFIELD_REGIONS,
};

// All map IDs
export const MAP_IDS = Object.keys(MAP_POOL);

// Currently active map
let activeMapId = "shattered-realm"; // Force battlefield map only for now

export function getActiveMapId() {
  return activeMapId;
}

export function pickRandomMap() {
  // TEMP: always use Shattered Realm (battlefield map)
  // When re-enabling other maps, change to:
  //   const id = MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
  const id = "shattered-realm";
  activeMapId = id;
  _coordSet = buildCoordSet();
  return id;
}

export function getActiveMap() {
  return MAP_POOL[activeMapId] || MAP_POOL[MAP_IDS[0]];
}

export function getRegions() {
  return getActiveMap().regions;
}

// ── Terrain colors (lighter for battlefield map visibility) ──
export const TERRAIN_COLORS = {
  plains:   "#7a6a4a",
  forest:   "#2a4a1e",
  mountain: "#5a5a6a",
  swamp:    "#4a3a5a",
  water:    "#2a4666",
  volcanic: "#6a2a1a",
};

// Convert axial hex coords to world position
export function hexToWorld(q, r, size = HEX_SIZE) {
  const x = size * (3 / 2 * q);
  const z = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, 0, z];
}

// Get neighbors of a hex
export function getNeighbors(q, r) {
  const directions = [
    [1, 0], [1, -1], [0, -1],
    [-1, 0], [-1, 1], [0, 1],
  ];
  return directions.map(([dq, dr]) => [q + dq, r + dr]);
}

function buildCoordSet() {
  const set = new Set();
  for (const r of getRegions()) {
    set.add(`${r.q},${r.r}`);
  }
  return set;
}

let _coordSet = buildCoordSet();

export function getAdjacentRegions(region) {
  return getNeighbors(region.q, region.r)
    .filter(([q, r]) => _coordSet.has(`${q},${r}`))
    .map(([q, r]) => getRegions().find((rgn) => rgn.q === q && rgn.r === r))
    .filter(Boolean);
}

// ── Movement range (mirrors Yu-Gi-Oh tribute levels) ──────────
export function getMovementRange(level) {
  if (level <= 4) return 1;   // normal summon — 1 step
  if (level <= 6) return 3;   // 1 tribute — 3 steps
  return 5;                    // 2+ tributes — 5 steps
}

// BFS from a hex, returning all reachable regions within maxSteps
export function getReachableHexes(fromQ, fromR, maxSteps) {
  const result = [];
  const visited = new Set([`${fromQ},${fromR}`]);
  let frontier = [[fromQ, fromR]];

  for (let step = 1; step <= maxSteps; step++) {
    const nextFrontier = [];
    for (const [q, r] of frontier) {
      for (const [nq, nr] of getNeighbors(q, r)) {
        const key = `${nq},${nr}`;
        if (visited.has(key)) continue;
        if (!_coordSet.has(key)) continue;
        visited.add(key);
        const region = getRegions().find((rgn) => rgn.q === nq && rgn.r === nr);
        if (region) {
          // Only plains are passable — creatures stay on flat ground
          if (region.terrain !== "plains") continue;
          result.push({ region, steps: step });
          nextFrontier.push([nq, nr]);
        }
      }
    }
    frontier = nextFrontier;
  }
  return result;
}
