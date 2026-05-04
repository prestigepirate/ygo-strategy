import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";

// Hex shape matching the platform (flat-top)
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

const HEX_RADIUS = HEX_SIZE * 0.89; // slightly inset from edge
const hexShape = makeHexShape(HEX_RADIUS);

// ── Dead Tree (BIG — visible from strategic view) ──────────
function DeadTree({ position, scale = 1, seed = 0 }) {
  const rng = useMemo(() => {
    const s = seed;
    return (n) => ((Math.sin(s * 12.9898 + n * 78.233) * 43758.5453) % 1) * 2 - 1;
  }, [seed]);

  // Trees are 3-4.5 units tall with scale 1.5-2.5
  const h = 2.0 * scale;
  const r = 0.15 * scale;

  return (
    <group position={position}>
      <group rotation={[rng(1) * 0.12, rng(2) * 0.4, rng(3) * 0.12]}>
        {/* Trunk */}
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[r * 1.5, r, h, 16]} />
          <meshStandardMaterial color="#1a1410" roughness={0.9} />
        </mesh>
        {/* Branches */}
        {[0.4, 0.55, 0.7, 0.82].map((ratio, i) => {
          const branchLen = 0.8 * scale;
          return (
            <group key={i} position={[0, h * ratio, 0]} rotation={[0.5, (i / 4) * Math.PI * 2 + rng(i * 7), rng(i * 3) * 0.25]}>
              <mesh position={[0, branchLen * 0.35, 0]}>
                <cylinderGeometry args={[r * 0.3, r * 0.6, branchLen, 10]} />
                <meshStandardMaterial color="#1a1410" roughness={0.9} />
              </mesh>
              {/* Twig */}
              <mesh position={[0, branchLen * 0.7, 0]} rotation={[rng(i * 11) * 0.5, rng(i * 15) * 0.4, 0]}>
                <cylinderGeometry args={[r * 0.15, r * 0.3, branchLen * 0.45, 8]} />
                <meshStandardMaterial color="#181210" roughness={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ── Obsidian Shard ─────────────────────────────────────────
function ObsidianShard({ position, scale = 1 }) {
  const geo = useMemo(() => {
    const g = new THREE.OctahedronGeometry(0.3 * scale, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, p.getY(i) * (2.0 + Math.random() * 1.8));
      p.setX(i, p.getX(i) * (0.35 + Math.random() * 0.65));
      p.setZ(i, p.getZ(i) * (0.35 + Math.random() * 0.65));
    }
    g.computeVertexNormals();
    return g;
  }, [scale]);

  const rotAngle = useMemo(() => Math.random() * Math.PI * 2, []);

  return (
    <mesh position={position} rotation={[0.15, rotAngle, 0.1]} geometry={geo}>
      <meshStandardMaterial color="#111118" roughness={0.08} metalness={0.95} />
    </mesh>
  );
}

// ── Wisp (big + bright — visible from strategic zoom) ─────
function Wisp({ position, speed = 1 }) {
  const groupRef = useRef();
  const lightRef = useRef();
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.35 * speed + phase;
    if (groupRef.current) {
      groupRef.current.position.x = position[0] + Math.cos(t) * 0.6;
      groupRef.current.position.z = position[2] + Math.sin(t * 1.2) * 0.6;
      groupRef.current.position.y = position[1] + Math.sin(t * 0.6) * 0.25;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.5 + Math.sin(state.clock.elapsedTime * 2.5 * speed + phase) * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color="#cc88ff" />
      </mesh>
      <mesh scale={[3.5, 3.5, 3.5]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial color="#cc88ff" transparent opacity={0.18} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0, 0]} color="#aa66ee" intensity={0.7} distance={2.5} />
    </group>
  );
}

// ── Mist ───────────────────────────────────────────────────
function MistLayer({ waterY }) {
  const ref = useRef();
  const count = 80;

  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * HEX_RADIUS * 0.8;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = waterY + Math.random() * 0.7;
      arr[i * 3 + 2] = Math.sin(a) * r;
      vels.push({
        vx: (Math.random() - 0.5) * 0.12,
        vz: (Math.random() - 0.5) * 0.12,
        p: Math.random() * Math.PI * 2,
        y0: arr[i * 3 + 1],
      });
    }
    return { arr, vels };
  }, [waterY]);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const v = data.vels[i];
      pos.array[i * 3] += v.vx * 0.004;
      pos.array[i * 3 + 1] = v.y0 + Math.sin(state.clock.elapsedTime * 0.2 + v.p) * 0.1;
      pos.array[i * 3 + 2] += v.vz * 0.004;
      const d = Math.sqrt(pos.array[i * 3] ** 2 + pos.array[i * 3 + 2] ** 2);
      if (d > HEX_RADIUS * 0.75) {
        const a = Math.atan2(pos.array[i * 3 + 2], pos.array[i * 3]);
        pos.array[i * 3] = Math.cos(a) * HEX_RADIUS * 0.45;
        pos.array[i * 3 + 2] = Math.sin(a) * HEX_RADIUS * 0.45;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={data.arr} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.5} color="#8888aa" transparent opacity={0.05} depthWrite={false} />
    </points>
  );
}

// ── MAIN ───────────────────────────────────────────────────
export default function ObsidianMarsh({ regionHeight }) {
  const wy = regionHeight + 0.04;

  const items = useMemo(() => ({
    trees: [
      { position: [1.2, wy, 0.7],  scale: 1.8, seed: 10 },
      { position: [-1.1, wy, -0.9], scale: 2.0, seed: 22 },
      { position: [0.3, wy, -1.2],  scale: 1.6, seed: 35 },
      { position: [-0.7, wy, 1.1],  scale: 2.2, seed: 48 },
      { position: [-1.2, wy, 0.1],  scale: 1.7, seed: 55 },
    ],
    shards: [
      { position: [0.7, wy + 0.06, -0.3], scale: 2.8 },
      { position: [-0.6, wy + 0.04, 0.6], scale: 2.4 },
      { position: [0.4, wy + 0.06, -0.9], scale: 3.0 },
      { position: [-0.9, wy + 0.04, -0.4], scale: 2.2 },
    ],
    wisps: [
      { position: [0.4, wy + 0.6, -0.5], speed: 0.7 },
      { position: [-0.6, wy + 0.7, -0.3], speed: 0.9 },
      { position: [0.9, wy + 0.5, 0.5], speed: 1.0 },
      { position: [-0.7, wy + 0.6, 0.6], speed: 0.8 },
    ],
  }), [wy]);

  return (
    <group>
      {/* Rim glow — visible from distance */}
      <mesh position={[0, wy + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[hexShape, 32]} />
        <meshBasicMaterial color="#443388" side={THREE.BackSide} transparent opacity={0.3} />
      </mesh>

      {/* Trees — 3-4.5 units tall */}
      {items.trees.map((t, i) => <DeadTree key={`t${i}`} {...t} />)}

      {/* Obsidian shards — large rock formations */}
      {items.shards.map((s, i) => <ObsidianShard key={`s${i}`} {...s} />)}

      {/* Wisps — bright glowing orbs */}
      {items.wisps.map((w, i) => <Wisp key={`w${i}`} {...w} />)}

      {/* Low mist */}
      <MistLayer waterY={wy} />
    </group>
  );
}
