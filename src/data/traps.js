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

    default:
      return { destroyed: [], survivors: incomingCreatures.map((c) => c.id), trapName: trap.name, trapId };
  }
}

// Get all trap IDs currently set on a region
export function getRegionTrapIds(state, regionId) {
  return state.trapsSet[regionId] || [];
}
