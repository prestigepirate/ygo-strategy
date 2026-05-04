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

// Crystal formation
function CrystalCluster({ position, scale = 1, seed = 0 }) {
  const crystals = useMemo(() => {
    const items = [];
    const rng = (n) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1);
    const count = 3 + Math.floor(rng(1) * 4);
    for (let i = 0; i < count; i++) {
      const g = new THREE.OctahedronGeometry(0.12 * scale * (0.6 + rng(i * 3) * 0.8), 1);
      const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) {
        p.setY(j, p.getY(j) * (1.5 + rng(i * 7 + j) * 2.5));
      }
      g.computeVertexNormals();
      items.push({
        geo: g,
        pos: [
          (rng(i * 5) - 0.5) * 0.5 * scale,
          scale * 0.15 + rng(i * 9) * 0.3 * scale,
          (rng(i * 11) - 0.5) * 0.5 * scale,
        ],
        rot: [rng(i * 13) * 0.3, rng(i * 17) * Math.PI, rng(i * 19) * 0.3],
        color: i === 0 ? "#aaccff" : i % 2 === 0 ? "#88aadd" : "#99bbee",
      });
    }
    return items;
  }, [scale, seed]);

  return (
    <group position={position}>
      {crystals.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={c.rot} geometry={c.geo}>
          <meshStandardMaterial color={c.color} roughness={0.1} metalness={0.2} emissive={c.color} emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* Glow sphere at base */}
      <mesh position={[0, scale * 0.05, 0]} scale={[2, 1, 2]}>
        <sphereGeometry args={[0.25 * scale, 8, 8]} />
        <meshBasicMaterial color="#4488cc" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// Floating wisp lights
function CrystalWisp({ position, speed = 1 }) {
  const groupRef = useRef();
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.3 * speed + phase;
    if (groupRef.current) {
      groupRef.current.position.x = position[0] + Math.cos(t) * 0.5;
      groupRef.current.position.z = position[2] + Math.sin(t * 1.3) * 0.5;
      groupRef.current.position.y = position[1] + Math.sin(t * 0.7) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#88ccff" />
      </mesh>
      <mesh scale={[3, 3, 3]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#88ccff" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// Light rays under water
function LightRays({ waterY }) {
  const ref = useRef();
  const count = 12;

  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * HEX_RADIUS * 0.7;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = waterY - 0.05;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, [waterY]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.material.opacity = 0.06 + Math.sin(t * 0.5) * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={data} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.8} color="#88bbff" transparent opacity={0.06} depthWrite={false} />
    </points>
  );
}

export default function CrystalLake({ regionHeight }) {
  const wy = regionHeight + 0.04;

  const items = useMemo(() => ({
    crystals: [
      { position: [1.0, wy + 0.02, 0.6], scale: 1.5, seed: 12 },
      { position: [-0.9, wy + 0.02, -0.7], scale: 1.8, seed: 25 },
      { position: [0.3, wy + 0.02, -1.1], scale: 1.3, seed: 38 },
      { position: [-0.5, wy + 0.02, 1.0], scale: 1.7, seed: 51 },
      { position: [0.9, wy + 0.02, -0.4], scale: 1.4, seed: 64 },
      { position: [-1.0, wy + 0.02, 0.2], scale: 1.6, seed: 77 },
    ],
    wisps: [
      { position: [0.5, wy + 0.5, -0.4], speed: 0.8 },
      { position: [-0.6, wy + 0.6, 0.3], speed: 0.7 },
      { position: [0.3, wy + 0.45, 0.8], speed: 0.9 },
      { position: [-0.4, wy + 0.55, -0.7], speed: 1.0 },
    ],
  }), [wy]);

  return (
    <group>
      {/* Rim glow — blue */}
      <mesh position={[0, wy + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[hexShape, 32]} />
        <meshBasicMaterial color="#3366aa" side={THREE.BackSide} transparent opacity={0.2} />
      </mesh>

      {/* Crystal clusters around edges */}
      {items.crystals.map((c, i) => <CrystalCluster key={`c${i}`} {...c} />)}

      {/* Floating wisps */}
      {items.wisps.map((w, i) => <CrystalWisp key={`w${i}`} {...w} />)}

      {/* Underwater light rays */}
      <LightRays waterY={wy} />

      {/* Ambient blue point light */}
      <pointLight position={[0, wy + 0.5, 0]} color="#4488cc" intensity={0.8} distance={5} />

      {/* Small lily pads */}
      {[[0.4, wy + 0.01, -0.3], [-0.3, wy + 0.01, 0.5], [0.7, wy + 0.01, 0.2]].map(([x, y, z], i) => (
        <group key={`lily${i}`} position={[x, y, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.15 + i * 0.03, 10]} />
            <meshStandardMaterial color="#225533" roughness={0.5} />
          </mesh>
          {i === 0 && (
            <mesh position={[0, 0.05, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#ffccdd" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
