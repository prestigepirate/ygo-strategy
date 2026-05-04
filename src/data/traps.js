// Trap card definitions
export const TRAPS = {
  "bottomless-trap-hole": {
    id: "bottomless-trap-hole",
    name: "Bottomless Trap Hole",
    description: "When an enemy creature enters this region, banish it.",
    trigger: "onEnter",
    effect: "banish",
    targetMode: "single",
    icon: "🕳️",
    color: "#8844cc",
  },
  "mirror-force": {
    id: "mirror-force",
    name: "Mirror Force",
    description: "When an enemy creature enters this region, destroy ALL enemy creatures here.",
    trigger: "onEnter",
    effect: "destroyAll",
    targetMode: "allEnemies",
    icon: "🪞",
    color: "#ff4444",
  },
  "trap-hole": {
    id: "trap-hole",
    name: "Trap Hole",
    description: "When an enemy creature with 1000+ ATK enters, destroy it.",
    trigger: "onEnter",
    effect: "destroyIfAtkAbove",
    threshold: 1000,
    targetMode: "single",
    icon: "🕳️",
    color: "#9966cc",
  },
  "magic-cylinder": {
    id: "magic-cylinder",
    name: "Magic Cylinder",
    description: "Negate an entering creature's attack and deal damage equal to its ATK to its controller.",
    trigger: "onEnter",
    effect: "reflect",
    targetMode: "single",
    icon: "🪄",
    color: "#44cc44",
  },
  "widespread-ruin": {
    id: "widespread-ruin",
    name: "Widespread Ruin",
    description: "When enemy creatures enter, destroy the one with the highest ATK.",
    trigger: "onEnter",
    effect: "destroyHighestAtk",
    targetMode: "single",
    icon: "💥",
    color: "#cc4444",
  },
  "dust-tornado": {
    id: "dust-tornado",
    name: "Dust Tornado",
    description: "Return the entering creature to its owner's hand.",
    trigger: "onEnter",
    effect: "bounce",
    targetMode: "single",
    icon: "🌪️",
    color: "#88cc44",
  },
};

// Resolve a trap effect against incoming creatures.
// Returns { destroyed: [creatureIds], survivors: [creatureIds], trapName, trapId }
export function resolveTrap(trapId, incomingCreatures) {
  const trap = TRAPS[trapId];
  if (!trap) return { destroyed: [], survivors: incomingCreatures.map((c) => c.id), trapName: "Unknown", trapId };

  switch (trap.effect) {
    case "banish":
      // Destroy the first creature
      return {
        destroyed: [incomingCreatures[0].id],
        survivors: incomingCreatures.slice(1).map((c) => c.id),
        trapName: trap.name,
        trapId,
      };

    case "destroyAll":
      // Destroy ALL incoming creatures
      return {
        destroyed: incomingCreatures.map((c) => c.id),
        survivors: [],
        trapName: trap.name,
        trapId,
      };

    case "destroyIfAtkAbove":
      const threshold = trap.threshold || 1000;
      const destroyed = [];
      const survivors = [];
      for (const c of incomingCreatures) {
        if (c.atk >= threshold) destroyed.push(c.id);
        else survivors.push(c.id);
      }
      return { destroyed, survivors, trapName: trap.name, trapId };

    case "reflect":
      // Negate attack, deal ATK damage to controller
      return {
        destroyed: [],
        survivors: incomingCreatures.map((c) => c.id),
        trapName: trap.name,
        trapId,
        reflectDamage: incomingCreatures.reduce((sum, c) => sum + (c.atk || 0), 0),
      };

    case "destroyHighestAtk":
      let highest = null;
      let highestIdx = -1;
      for (let i = 0; i < incomingCreatures.length; i++) {
        if (!highest || incomingCreatures[i].atk > highest.atk) {
          highest = incomingCreatures[i];
          highestIdx = i;
        }
      }
      return {
        destroyed: highest ? [highest.id] : [],
        survivors: incomingCreatures.filter((_, i) => i !== highestIdx).map((c) => c.id),
        trapName: trap.name,
        trapId,
      };

    case "bounce":
      return {
        destroyed: [],
        survivors: [],
        bounced: incomingCreatures.map((c) => c.id),
        trapName: trap.name,
        trapId,
      };

    default:
      return { destroyed: [], survivors: incomingCreatures.map((c) => c.id), trapName: trap.name, trapId };
  }
}

// Get all trap IDs currently set on a region
export function getRegionTrapIds(state, regionId) {
  return state.trapsSet[regionId] || [];
}
