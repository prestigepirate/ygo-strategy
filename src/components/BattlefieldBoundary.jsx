import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getRegions, hexToWorld, getNeighbors, HEX_SIZE } from "../data/regions";

// ── Convex hull (Graham scan) in 2D xz-plane ──────────────────
function convexHull2D(points) {
  if (points.length < 3) return points;
  // Sort by x, then z
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// Smooth closed curve from hull points
function smoothHull(hullPoints, segments = 120) {
  if (hullPoints.length < 3) return hullPoints;
  // Close the loop
  const closed = [...hullPoints, hullPoints[0], hullPoints[1]];
  const curve = new THREE.CatmullRomCurve3(
    closed.map(([x, , z]) => new THREE.Vector3(x, 0.05, z)),
    true, // closed
    "catmullrom",
    0.5
  );
  return curve.getPoints(segments);
}

// Shape for wall extrusion
function wallShape(height) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.04, 0);
  shape.lineTo(0.04, 0);
  shape.lineTo(0.04, height);
  shape.lineTo(-0.04, height);
  shape.closePath();
  return shape;
}

const WALL_SHAPE = wallShape(0.8);

function BoundaryWalls({ boundaryHexes }) {
  const coordSet = useMemo(() => {
    const s = new Set(getRegions().map(r => `${r.q},${r.r}`));
    return s;
  }, []);

  const walls = useMemo(() => {
    const items = [];
    for (const { q, r } of boundaryHexes) {
      const [cx, , cz] = hexToWorld(q, r);
      const neighbors = getNeighbors(q, r);
      for (let i = 0; i < neighbors.length; i++) {
        const [nq, nr] = neighbors[i];
        if (coordSet.has(`${nq},${nr}`)) continue;
        // This edge faces outside — place a wall
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        // Edge midpoint is at hex boundary, half a hex outward from center
        const edgeDist = HEX_SIZE * 0.87;
        const mx = cx + Math.cos(angle) * edgeDist;
        const mz = cz + Math.sin(angle) * edgeDist;
        items.push({
          pos: [mx, 0.4, mz],
          rotY: angle + Math.PI / 2, // wall faces perpendicular to edge
          key: `${q},${r}-${i}`,
        });
      }
    }
    return items;
  }, [boundaryHexes, coordSet]);

  return (
    <group>
      {walls.map(({ pos, rotY, key }) => (
        <mesh key={key} position={pos} rotation={[0, rotY, 0]}>
          <shapeGeometry args={[WALL_SHAPE]} />
          <meshStandardMaterial
            color="#111122"
            roughness={0.6}
            metalness={0.1}
            transparent
            opacity={0.7}
            emissive="#221144"
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function GlowTube({ curvePoints }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
      ref.current.material.opacity = 0.35 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
      ref.current.material.emissiveIntensity = pulse;
    }
  });

  if (curvePoints.length < 3) return null;

  const { curve, tubeArgs } = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(
      curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z)),
      true
    );
    return {
      curve: c,
      tubeArgs: [c, curvePoints.length * 1.5, 0.08, 8, true],
    };
  }, [curvePoints]);

  return (
    <mesh ref={ref} position={[0, 0.3, 0]}>
      <tubeGeometry args={tubeArgs} />
      <meshStandardMaterial
        color="#6644cc"
        emissive="#8844ff"
        emissiveIntensity={1.0}
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.4}
        depthTest={true}
      />
    </mesh>
  );
}

function GroundGlow({ curvePoints }) {
  const ref = useRef();
  const shape = useMemo(() => {
    if (curvePoints.length < 3) return null;
    const s = new THREE.Shape();
    // Create a closed shape from the hull points projected to ground
    s.moveTo(curvePoints[0].x, curvePoints[0].z);
    for (let i = 1; i < curvePoints.length; i++) {
      s.lineTo(curvePoints[i].x, curvePoints[i].z);
    }
    s.closePath();
    return s;
  }, [curvePoints]);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.material.opacity = 0.06 + Math.sin(clock.elapsedTime * 1.5) * 0.03;
    }
  });

  if (!shape) return null;

  return (
    <mesh ref={ref} position={[0, -1.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial
        color="#8844ff"
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        depthTest={false}
      />
    </mesh>
  );
}

export default function BattlefieldBoundary() {
  const { curvePoints, boundaryHexes } = useMemo(() => {
    try {
      const regions = getRegions();
      if (!regions || regions.length === 0) return { curvePoints: [], boundaryHexes: [] };
      const coordSet = new Set(regions.map(r => `${r.q},${r.r}`));

      // Find boundary hexes
      const boundary = regions.filter(r => {
        return getNeighbors(r.q, r.r).some(([nq, nr]) => !coordSet.has(`${nq},${nr}`));
      });

      // Get world positions of boundary hex centers
      const worldPositions = boundary.map(r => hexToWorld(r.q, r.r));

      // Compute hull and smooth
      const hull = convexHull2D(worldPositions);
      const smoothed = smoothHull(hull, 150);

      return {
        curvePoints: smoothed,
        boundaryHexes: boundary.map(r => ({ q: r.q, r: r.r })),
      };
    } catch (e) {
      console.warn("BattlefieldBoundary: map not ready", e);
      return { curvePoints: [], boundaryHexes: [] };
    }
  }, []);

  if (boundaryHexes.length === 0) return null;

  return (
    <group>
      <BoundaryWalls boundaryHexes={boundaryHexes} />
      <GlowTube curvePoints={curvePoints} />
      {curvePoints.length >= 3 && <GroundGlow curvePoints={curvePoints} />}
    </group>
  );
}
