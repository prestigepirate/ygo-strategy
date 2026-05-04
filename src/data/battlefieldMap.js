// Battlefield Map — organic oval hex battlefield with strategic zones
// ~175-195 hexes, axial coords (q, r), compatible with existing pathfinding

export const HEX_SIZE = 1.6;

// ── Seeded RNG ─────────────────────────────────────────────────
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function hashCoord(q, r, seed) {
  let h = seed + q * 374761393 + r * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) / 2147483647 + 0.5) % 1;
}

const MAP_SEED = 42;
const rand = rng(MAP_SEED);

// ── Organic oval boundary ──────────────────────────────────────
function isInOrganicBoundary(q, r) {
  // Elliptical mask: (q/a)² + (r/b)² ≤ 1
  const a = 9.5, b = 7.0;
  const ellipse = (q * q) / (a * a) + (r * r) / (b * b);
  if (ellipse > 1.0) return false;
  // Edge noise — probabilistically exclude near-boundary hexes
  if (ellipse > 0.6) {
    const noise = hashCoord(q, r, MAP_SEED + 100);
    const cutoff = 0.05 + (ellipse - 0.6) * 2.2;
    if (noise < cutoff) return false;
  }
  return true;
}

// ── Neighbor lookup ────────────────────────────────────────────
export function getNeighbors(q, r) {
  return [
    [q + 1, r], [q + 1, r - 1], [q, r - 1],
    [q - 1, r], [q - 1, r + 1], [q, r + 1],
  ];
}

// Cube distance
function hexDist(q1, r1, q2, r2) {
  const dq = q1 - q2, dr = r1 - r2, ds = (-q1 - r1) - (-q2 - r2);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

// ── World conversion (matches regions.js) ──────────────────────
export function hexToWorld(q, r, size = HEX_SIZE) {
  const x = size * (3 / 2 * q);
  const z = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, 0, z];
}

// ── Map generation ─────────────────────────────────────────────
function generateCoordSet() {
  const set = new Set();
  // Scan the bounding box of the ellipse
  for (let q = -10; q <= 10; q++) {
    for (let r = -8; r <= 8; r++) {
      if (isInOrganicBoundary(q, r)) {
        set.add(`${q},${r}`);
      }
    }
  }
  // Flood fill from (0,0) to ensure connectivity
  if (!set.has("0,0")) {
    set.add("0,0");
  }
  const visited = new Set();
  const queue = [[0, 0]];
  visited.add("0,0");
  while (queue.length > 0) {
    const [q, r] = queue.shift();
    for (const [nq, nr] of getNeighbors(q, r)) {
      const key = `${nq},${nr}`;
      if (visited.has(key)) continue;
      if (!set.has(key)) continue;
      visited.add(key);
      queue.push([nq, nr]);
    }
  }
  return visited; // only connected hexes
}

const COORD_SET = generateCoordSet();

// ── Zone classification ────────────────────────────────────────
function classifyZone(q, r) {
  const dist = Math.sqrt(q * q + r * r);
  const absQ = Math.abs(q);

  if (q <= -7) return "P1_HOME";
  if (q >= 7) return "P2_HOME";
  if (q <= -5 && Math.abs(r) <= 5) return "P1_HOME_BORDER";
  if (q >= 5 && Math.abs(r) <= 5) return "P2_HOME_BORDER";
  if (absQ <= 6 && r <= -2.5) return "NORTH_FLANK";
  if (absQ <= 6 && r >= 2.5) return "SOUTH_FLANK";
  if (dist <= 3.5) return "CENTRAL_ARENA";
  return "MIDFIELD";
}

// ── Terrain assignment ─────────────────────────────────────────
const TERRAIN_IDS = ["plains", "forest", "mountain", "swamp", "water", "volcanic"];

function assignTerrain(q, r, zone) {
  const dist = Math.sqrt(q * q + r * r);
  const h = hashCoord(q, r, MAP_SEED + 200);

  // Landmarks override
  const landmark = LANDMARK_BY_COORD[`${q},${r}`];
  if (landmark) return { terrain: landmark.terrain, heightRange: landmark.heightRange };

  switch (zone) {
    case "P1_HOME":
    case "P2_HOME":
      return { terrain: "plains", heightRange: [0.8, 1.2] };

    case "P1_HOME_BORDER":
    case "P2_HOME_BORDER":
      if (dist > 6) return { terrain: "mountain", heightRange: [1.5, 2.2] };
      return { terrain: "plains", heightRange: [0.6, 1.0] };

    case "CENTRAL_ARENA":
      if (dist < 1.8) return { terrain: "volcanic", heightRange: [0.4, 0.9] };
      if (h < 0.4) return { terrain: "plains", heightRange: [0.3, 0.6] };
      if (h < 0.65) return { terrain: "volcanic", heightRange: [0.3, 0.7] };
      return { terrain: "mountain", heightRange: [0.5, 1.0] };

    case "NORTH_FLANK":
    case "SOUTH_FLANK":
      if (h < 0.6) return { terrain: "forest", heightRange: [0.3, 0.7] };
      if (h < 0.8) return { terrain: "swamp", heightRange: [0.2, 0.5] };
      return { terrain: "plains", heightRange: [0.3, 0.6] };

    case "MIDFIELD":
    default:
      if (h < 0.30) return { terrain: "plains", heightRange: [0.3, 0.6] };
      if (h < 0.55) return { terrain: "forest", heightRange: [0.4, 0.9] };
      if (h < 0.72) return { terrain: "swamp", heightRange: [0.2, 0.5] };
      if (h < 0.85) return { terrain: "mountain", heightRange: [0.8, 1.6] };
      return { terrain: "water", heightRange: [0.1, 0.3] };
  }
}

// ── Landmark definitions ───────────────────────────────────────
const LANDMARKS = [
  { id: "the-spire",       q: 0,  r: 0,  name: "The Spire",       terrain: "volcanic", heightRange: [0.6, 0.8] },
  { id: "crystal-lake",    q: -4, r: 2,  name: "Crystal Lake",    terrain: "water",    heightRange: [0.2, 0.4] },
  { id: "obsidian-marsh",  q: 2,  r: -3, name: "Obsidian Marsh",  terrain: "swamp",    heightRange: [0.3, 0.5] },
  { id: "ironwood",        q: -5, r: -1, name: "Ironwood",        terrain: "forest",   heightRange: [0.5, 0.8] },
  { id: "forge-gate",      q: 5,  r: 0,  name: "Forge Gate",      terrain: "mountain", heightRange: [1.0, 1.5] },
  { id: "merrow-deep",     q: 0,  r: -5, name: "Merrow Deep",     terrain: "water",    heightRange: [0.1, 0.2] },
];

const LANDMARK_BY_COORD = {};
for (const lm of LANDMARKS) {
  LANDMARK_BY_COORD[`${lm.q},${lm.r}`] = lm;
}
const LANDMARK_IDS = new Set(LANDMARKS.map(l => l.id));

// ── Chokepoint detection ───────────────────────────────────────
function isNearChokepoint(q, r) {
  // Narrow points in the organic oval — exact hexes only
  const chokes = new Set([
    "-3,4",  "-2,4",   // P1 north pinch
    "-3,-4", "-2,-4",  // P1 south pinch
    "3,4",   "2,4",    // P2 north pinch
    "3,-4",  "2,-4",   // P2 south pinch
    "0,5",   "0,-5",   // center north/south narrows
  ]);
  return chokes.has(`${q},${r}`);
}

// ── Corridor detection ─────────────────────────────────────────
function isCorridorHex(q, r, zone) {
  const h = hashCoord(q, r, MAP_SEED + 300);
  // Northern edge forest corridor
  if (zone === "NORTH_FLANK" && Math.abs(r + 3) <= 1.5 && Math.abs(q) >= 2 && h < 0.5) return true;
  // Southern edge swamp corridor
  if (zone === "SOUTH_FLANK" && Math.abs(r - 3) <= 1.5 && Math.abs(q) >= 2 && h < 0.45) return true;
  // Deep flank forest corridor (P1 side)
  if (q >= -5 && q <= -2 && Math.abs(r) >= 3 && h < 0.4) return true;
  return false;
}

// ── Name generation ────────────────────────────────────────────
const ZONE_PREFIXES = {
  P1_HOME:       ["Crimson", "Bastion", "Guard", "Hearth"],
  P2_HOME:       ["Azure", "Citadel", "Watch", "Sanctum"],
  P1_HOME_BORDER:["Bulwark", "Rampart", "Shield", "Outpost"],
  P2_HOME_BORDER:["Fortress", "Redoubt", "Bastion", "Castle"],
  CENTRAL_ARENA: ["Scarred", "Cinder", "Shattered", "Blight"],
  NORTH_FLANK:   ["Shadow", "Whisper", "Veiled", "Twilight"],
  SOUTH_FLANK:   ["Gloom", "Dusk", "Hidden", "Murky"],
  MIDFIELD:      ["Broken", "Windswept", "Fallow", "Withered", "Bleak", "Ashen"],
};

const TERRAIN_SUFFIXES = {
  plains:   ["Field", "Prairie", "Heath", "Steppe", "Meadow"],
  forest:   ["Thicket", "Wood", "Grove", "Copse", "Briar"],
  mountain: ["Ridge", "Peak", "Crag", "Cliff", "Spur"],
  swamp:    ["Mire", "Fen", "Bog", "Marsh", "Quag"],
  water:    ["Pool", "Lake", "Reach", "Deep", "Bay"],
  volcanic: ["Wastes", "Caldron", "Fissure", "Vent", "Scar"],
};

let _nameCounter = {};
function generateName(q, r, terrain, zone) {
  const h = hashCoord(q, r, MAP_SEED + 400);
  // Special landmark names override
  const lm = LANDMARK_BY_COORD[`${q},${r}`];
  if (lm) return lm.name;

  const prefixes = ZONE_PREFIXES[zone] || ZONE_PREFIXES.MIDFIELD;
  const suffixes = TERRAIN_SUFFIXES[terrain] || TERRAIN_SUFFIXES.plains;

  // Deduplicate: track which names we've used
  const pIdx = Math.floor(h * prefixes.length);
  const sIdx = Math.floor(hashCoord(q, r, MAP_SEED + 401) * suffixes.length);
  const name = `${prefixes[pIdx]} ${suffixes[sIdx]}`;

  // Avoid repeats — add a numeral if needed
  const key = name;
  _nameCounter[key] = (_nameCounter[key] || 0) + 1;
  if (_nameCounter[key] > 1) return `${name} ${_nameCounter[key]}`;
  return name;
}

// ── Build all regions ──────────────────────────────────────────
function buildRegions() {
  _nameCounter = {};
  const regions = [];
  const coordList = Array.from(COORD_SET).map(s => {
    const [q, r] = s.split(",").map(Number);
    return { q, r };
  });

  // Sort for consistent iteration
  coordList.sort((a, b) => a.q - b.q || a.r - b.r);

  let idx = 0;
  for (const { q, r } of coordList) {
    const zone = classifyZone(q, r);
    const { terrain, heightRange } = assignTerrain(q, r, zone);
    const isChokepoint = isNearChokepoint(q, r);
    const isCorridor = isCorridorHex(q, r, zone);

    // Height with slight variation
    const h = hashCoord(q, r, MAP_SEED + 500);
    const height = Math.round((heightRange[0] + h * (heightRange[1] - heightRange[0])) * 100) / 100;

    // Use landmark ID if applicable
    const lm = LANDMARK_BY_COORD[`${q},${r}`];
    const id = lm ? lm.id : `hex-${q}-${r}`;
    const name = generateName(q, r, terrain, zone);
    const isHome = zone === "P1_HOME" ? "player-1" : zone === "P2_HOME" ? "player-2" : null;

    regions.push({
      id, q, r, terrain, name, height, zone,
      isChokepoint,
      isCorridor,
      coverBonus: isCorridor ? 0.8 : terrain === "forest" ? 0.4 : terrain === "swamp" ? 0.3 : 0,
      isHome,
      isLandmark: LANDMARK_IDS.has(id),
    });
    idx++;
  }

  return regions;
}

const BATTLEFIELD_REGIONS = buildRegions();
const BATTLEFIELD_COORD_SET = COORD_SET;

export { BATTLEFIELD_REGIONS, BATTLEFIELD_COORD_SET, LANDMARKS, LANDMARK_IDS, LANDMARK_BY_COORD };

// ── Map metadata ───────────────────────────────────────────────
export const BATTLEFIELD_META = {
  name: "The Shattered Realm",
  description: "An ancient battlefield scarred by centuries of war. Flank through the shadow woods, hold the central arena, or push through deadly chokepoints.",
  regionCount: BATTLEFIELD_REGIONS.length,
};
