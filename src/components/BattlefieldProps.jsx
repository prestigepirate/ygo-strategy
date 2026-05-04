import { useMemo } from "react";
import * as THREE from "three";
import { getRegions, hexToWorld } from "../data/regions";

// Deterministic seed from region coords
function seedFromCoords(q, r) {
  let h = q * 374761393 + r * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) / 2147483647 + 0.5) % 1;
}

// ── Crystal cluster (neon purple/teal octahedra) ───────────────
function CrystalCluster({ position, count, color, scale, seed }) {
  const crystals = useMemo(() => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const s = 0.3 + seed * 0.6 + (i / count) * 0.4;
      const angle = (i / count) * Math.PI * 2 + seed * 1.5;
      const radius = 0.15 + seed * 0.25;
      items.push({
        pos: [Math.cos(angle) * radius, s * 0.3, Math.sin(angle) * radius],
        scale: [0.06 + seed * 0.06, s * 0.2, 0.06 + seed * 0.06],
        rotY: angle + seed * Math.PI,
        rotX: 0.1 + seed * 0.3,
      });
    }
    return items;
  }, [count, seed]);

  return (
    <group position={position}>
      {crystals.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale} rotation={[c.rotX, c.rotY, 0]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.3}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Rune stone ─────────────────────────────────────────────────
function RuneStone({ position, seed }) {
  const rotY = seed * Math.PI * 2;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Stone base */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.12]} />
        <meshStandardMaterial color="#1a1a25" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Glowing rune line */}
      <mesh position={[0.08, 0.3, 0]}>
        <boxGeometry args={[0.02, 0.25, 0.005]} />
        <meshStandardMaterial
          color="#44ddcc"
          emissive="#44ddcc"
          emissiveIntensity={0.7}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

// ── Small ruin ─────────────────────────────────────────────────
function RuinCluster({ position, seed }) {
  const pieces = useMemo(() => {
    const items = [];
    // 2-3 wall pieces
    const wallCount = 2 + Math.floor(seed * 2);
    for (let i = 0; i < wallCount; i++) {
      const s = seed + i * 0.3;
      items.push({
        type: "wall",
        pos: [s * 0.6 - 0.4, 0.2 + s * 0.15, (s - 0.5) * 0.4],
        scale: [0.35 + s * 0.2, 0.4 + s * 0.3, 0.06],
        rotY: s * Math.PI * 1.5,
      });
    }
    // 1 fallen column
    items.push({
      type: "column",
      pos: [seed * 0.5 - 0.2, 0.05, -(seed - 0.5) * 0.3],
      scale: [0.06, 0.06, 0.4 + seed * 0.3],
      rotY: seed * Math.PI,
      rotX: Math.PI / 2,
    });
    return items;
  }, [seed]);

  return (
    <group position={position}>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          position={p.pos}
          scale={p.scale}
          rotation={[p.rotX || 0, p.rotY, 0]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#111118" roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Main props scatterer ───────────────────────────────────────
export default function BattlefieldProps() {
  const props = useMemo(() => {
    const regions = getRegions();
    const items = [];

    for (const r of regions) {
      // Skip home zones and chokepoints (too cluttered)
      if (r.zone === "P1_HOME" || r.zone === "P2_HOME") continue;
      if (r.isChokepoint) continue;

      const [wx, , wz] = hexToWorld(r.q, r.r);
      const y = r.height + 0.04;
      const s = seedFromCoords(r.q, r.r);

      // Crystal clusters in forest, volcanic, and arena zones
      if (
        (r.terrain === "forest" || r.terrain === "volcanic" || r.zone === "CENTRAL_ARENA") &&
        s > 0.55
      ) {
        const crystalColor = s > 0.78 ? "#8844cc" : "#44ddcc";
        const crystalCount = 3 + Math.floor(s * 3);
        items.push(
          <CrystalCluster
            key={`crystal-${r.id}`}
            position={[wx, y, wz]}
            count={crystalCount}
            color={crystalColor}
            scale={0.5 + s * 0.4}
            seed={s}
          />
        );
      }

      // Rune stones in MIDFIELD and flank zones
      if (
        (r.zone === "MIDFIELD" || r.zone === "NORTH_FLANK" || r.zone === "SOUTH_FLANK") &&
        s > 0.82
      ) {
        items.push(
          <RuneStone
            key={`rune-${r.id}`}
            position={[wx + s * 0.4 - 0.2, y, wz + (s - 0.5) * 0.4]}
            seed={s}
          />
        );
      }

      // Ruin clusters in MIDFIELD and border zones
      if (
        (r.zone === "MIDFIELD" || r.zone === "P1_HOME_BORDER" || r.zone === "P2_HOME_BORDER") &&
        s > 0.88
      ) {
        items.push(
          <RuinCluster
            key={`ruin-${r.id}`}
            position={[wx + s * 0.3 - 0.15, y, wz + (s - 0.5) * 0.3]}
            seed={s}
          />
        );
      }
    }

    return items;
  }, []);

  return <group>{props}</group>;
}
