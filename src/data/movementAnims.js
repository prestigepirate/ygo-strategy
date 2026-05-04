// ── Movement animation store ──────────────────────────────────
// Module-level Map shared between gameState (triggers) and
// UnitToken (renders), so both player and AI moves animate.

const movementAnims = new Map();

export function startMovementAnim(creatureId, fromPos, toPos, duration = 600) {
  movementAnims.set(creatureId, {
    fromX: fromPos[0], fromY: fromPos[1], fromZ: fromPos[2],
    toX: toPos[0], toY: toPos[1], toZ: toPos[2],
    startTime: performance.now(),
    duration,
  });
}

export function getMovementAnim(creatureId) {
  return movementAnims.get(creatureId) || null;
}

export function clearMovementAnim(creatureId) {
  movementAnims.delete(creatureId);
}
