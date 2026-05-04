import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";

function makeHexShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

const HEX_RADIUS = HEX_SIZE * 0.89;
const hexShape = makeHexShape(HEX_RADIUS);

// Ironwood tree — tall, metallic bark, dark iron canopy
function IronTree({ position, scale = 1, seed = 0 }) {
  const rng = useMemo(() => {
    const s = seed;
    return (n) => ((Math.sin(s * 12.9898 + n * 78.233) * 43758.5453) % 1) * 2 - 1;
  }, [seed]);

  const h = 2.4 * scale;
  const r = 0.16 * scale;
  const lean = rng(1) * 0.12;

  return (
    <group position={position} rotation={[lean, rng(2) * 0.3, lean * 0.5]}>
      {/* Trunk — metallic dark */}
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r * 1.4, r * 1.8, h, 20]} />
        <meshStandardMaterial color="#2a2520" roughness={0.25} metalness={0.7} />
      </mesh>

      {/* Iron bark ridges */}
      {[0.15, 0.35, 0.55, 0.75].map((ratio, i) => {
        const ridgeR = (r * 1.8) * (1 - ratio * 0.7);
        return (
          <mesh key={i} position={[0, h * ratio, 0]} rotation={[0, rng(i * 6) * Math.PI, 0]}>
            <torusGeometry args={[ridgeR, r * 0.2, 8, 12]} />
            <meshStandardMaterial color="#3a3530" roughness={0.3} metalness={0.65} />
          </mesh>
        );
      })}

      {/* Branches — thick iron-like limbs */}
      {[0.5, 0.62, 0.74, 0.85].map((ratio, i) => {
        const branchLen = 0.9 * scale;
        const br = r * 0.55;
        return (
          <group key={`br${i}`} position={[0, h * ratio, 0]} rotation={[0.4 + rng(i * 11) * 0.3, (i / 4) * Math.PI * 2 + rng(i * 7) * 0.5, rng(i * 3) * 0.2]}>
            <mesh position={[0, branchLen * 0.3, 0]}>
              <cylinderGeometry args={[br * 0.6, br, branchLen, 12]} />
              <meshStandardMaterial color="#2e2924" roughness={0.3} metalness={0.6} />
            </mesh>
            {/* Sub-branch */}
            <mesh position={[0, branchLen * 0.5, 0]} rotation={[rng(i * 13) * 0.4, rng(i * 17) * 0.5, 0]}>
              <cylinderGeometry args={[br * 0.3, br * 0.55, branchLen * 0.4, 8]} />
              <meshStandardMaterial color="#38332e" roughness={0.35} metalness={0.55} />
            </mesh>
          </group>
        );
      })}

      {/* Canopy — dark iron-colored sphere clusters */}
      {[0.65, 0.75, 0.82, 0.88].map((ratio, i) => (
        <mesh key={`leaf${i}`} position={[
          rng(i * 23) * 0.4 * scale,
          h * ratio,
          rng(i * 29) * 0.4 * scale,
        ]}>
          <sphereGeometry args={[0.25 * scale, 8, 8]} />
          <meshStandardMaterial color="#1e2022" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Top crown cluster */}
      <mesh position={[0, h * 0.95, 0]}>
        <sphereGeometry args={[0.3 * scale, 10, 10]} />
        <meshStandardMaterial color="#25282a" roughness={0.4} metalness={0.45} />
      </mesh>
      <mesh position={[rng(30) * 0.15 * scale, h * 0.92, rng(31) * 0.15 * scale]}>
        <sphereGeometry args={[0.22 * scale, 8, 8]} />
        <meshStandardMaterial color="#1c1e20" roughness={0.45} metalness={0.4} />
      </mesh>
    </group>
  );
}

// Iron ore boulder
function IronBoulder({ position, scale = 1 }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.2 * scale, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, p.getY(i) * (0.5 + Math.random() * 0.8));
      p.setX(i, p.getX(i) * (0.7 + Math.random() * 0.6));
      p.setZ(i, p.getZ(i) * (0.7 + Math.random() * 0.6));
    }
    g.computeVertexNormals();
    return g;
  }, [scale]);

  const rot = useMemo(() => [
    Math.random() * 0.3,
    Math.random() * Math.PI,
    Math.random() * 0.3,
  ], []);

  return (
    <mesh position={position} rotation={rot} geometry={geo}>
      <meshStandardMaterial color="#3a3530" roughness={0.2} metalness={0.75} />
    </mesh>
  );
}

// Forest mist
function ForestMist({ floorY }) {
  const ref = useRef();
  const count = 50;

  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * HEX_RADIUS * 0.7;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = floorY + Math.random() * 0.5;
      arr[i * 3 + 2] = Math.sin(a) * r;
      vels.push({
        vx: (Math.random() - 0.5) * 0.06,
        vz: (Math.random() - 0.5) * 0.06,
        p: Math.random() * Math.PI * 2,
      });
    }
    return { arr, vels };
  }, [floorY]);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const v = data.vels[i];
      pos.array[i * 3] += v.vx * 0.005;
      pos.array[i * 3 + 1] += Math.sin(state.clock.elapsedTime * 0.3 + v.p) * 0.002;
      pos.array[i * 3 + 2] += v.vz * 0.005;
      const d = Math.sqrt(pos.array[i * 3] ** 2 + pos.array[i * 3 + 2] ** 2);
      if (d > HEX_RADIUS * 0.65) {
        const a = Math.atan2(pos.array[i * 3 + 2], pos.array[i * 3]);
        pos.array[i * 3] = Math.cos(a) * HEX_RADIUS * 0.35;
        pos.array[i * 3 + 2] = Math.sin(a) * HEX_RADIUS * 0.35;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={data.arr} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.4} color="#666655" transparent opacity={0.06} depthWrite={false} />
    </points>
  );
}

export default function Ironwood({ regionHeight }) {
  const fy = regionHeight + 0.04;

  const items = useMemo(() => ({
    trees: [
      { position: [1.1, fy, 0.8],  scale: 1.7, seed: 10 },
      { position: [-0.9, fy, -0.7], scale: 2.0, seed: 22 },
      { position: [0.2, fy, -1.1],  scale: 1.5, seed: 35 },
      { position: [-0.8, fy, 1.0],  scale: 1.9, seed: 48 },
      { position: [1.0, fy, -0.4],  scale: 1.6, seed: 55 },
      { position: [-1.1, fy, 0.1],  scale: 1.8, seed: 62 },
      { position: [0.0, fy, 0.8],   scale: 2.1, seed: 70 },
      { position: [-0.3, fy, -0.5], scale: 1.4, seed: 78 },
    ],
    boulders: [
      { position: [0.6, fy + 0.02, -0.3], scale: 1.5 },
      { position: [-0.5, fy + 0.02, 0.4], scale: 1.2 },
      { position: [0.9, fy + 0.02, 0.3], scale: 1.8 },
      { position: [-0.7, fy + 0.02, -0.8], scale: 1.3 },
    ],
  }), [fy]);

  return (
    <group>
      {/* Rim — subtle green/brown */}
      <mesh position={[0, fy + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[hexShape, 32]} />
        <meshBasicMaterial color="#2a4420" side={THREE.BackSide} transparent opacity={0.15} />
      </mesh>

      {/* Ironwood trees */}
      {items.trees.map((t, i) => <IronTree key={`t${i}`} {...t} />)}

      {/* Iron boulders */}
      {items.boulders.map((b, i) => <IronBoulder key={`b${i}`} {...b} />)}

      {/* Ground mist */}
      <ForestMist floorY={fy} />

      {/* Subtle ambient light */}
      <pointLight position={[0, fy + 1.0, 0]} color="#445533" intensity={0.4} distance={4} />
    </group>
  );
}
