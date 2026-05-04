import { useMemo } from "react";
import { getAdjacentRegions, hexToWorld } from "../data/regions";

// Renders faint connection lines between adjacent regions
export default function MapBridges({ regions }) {
  const edges = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const r of regions) {
      for (const adj of getAdjacentRegions(r)) {
        const key = [r.id, adj.id].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        const [x1, , z1] = hexToWorld(r.q, r.r);
        const [x2, , z2] = hexToWorld(adj.q, adj.r);
        const h1 = r.height;
        const h2 = adj.height;
        result.push({
          key,
          x1, z1, h1,
          x2, z2, h2,
        });
      }
    }
    return result;
  }, [regions]);

  return (
    <group>
      {edges.map((e) => {
        const midX = (e.x1 + e.x2) / 2;
        const midZ = (e.z1 + e.z2) / 2;
        const midH = (e.h1 + e.h2) / 2;
        const dx = e.x2 - e.x1;
        const dz = e.z2 - e.z1;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);

        return (
          <group key={e.key}>
            {/* Pillar under the bridge mid-point */}
            <mesh position={[midX, midH / 2 - 0.3, midZ]}>
              <cylinderGeometry args={[0.08, 0.08, midH - 0.3, 6]} />
              <meshStandardMaterial color="#444444" roughness={0.7} />
            </mesh>

            {/* Bridge beam */}
            <mesh
              position={[midX, midH + 0.05, midZ]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[length, 0.06, 0.25]} />
              <meshStandardMaterial
                color="#555555"
                roughness={0.6}
                metalness={0.3}
                transparent
                opacity={0.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
