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

// Central volcano spire
function SpirePeak({ height }) {
  const coneGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.5, height, 24, 8);
    // Roughen the cone
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const dist = Math.sqrt(x * x + z * z);
      if (dist > 0.05 && y > -height / 2 + 0.3 && y < height / 2 - 0.3) {
        const noise = (Math.sin(i * 7.3) * 0.5 + Math.cos(i * 11.1) * 0.5) * 0.12;
        const factor = 1 + noise;
        p.setX(i, x * factor);
        p.setZ(i, z * factor);
      }
    }
    g.computeVertexNormals();
    return g;
  }, [height]);

  return (
    <group position={[0, height / 2, 0]}>
      <mesh geometry={coneGeo}>
        <meshStandardMaterial color="#2a1a10" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Lava glow at tip */}
      <mesh position={[0, height / 2 - 0.1, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color="#ff6622" />
      </mesh>
      <mesh position={[0, height / 2 - 0.1, 0]} scale={[4, 4, 4]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.25} />
      </mesh>
      <pointLight position={[0, height / 2, 0]} color="#ff5522" intensity={2.5} distance={8} />
    </group>
  );
}

// Lava stream vein down the cone
function LavaStream({ startY, endY, angle, radius }) {
  const points = useMemo(() => {
    const pts = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = startY + (endY - startY) * t;
      const wobble = Math.sin(t * Math.PI * 3) * 0.15;
      const x = Math.cos(angle) * (radius + wobble);
      const z = Math.sin(angle) * (radius + wobble);
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [startY, endY, angle, radius]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 20, 0.06, 8, false), [curve]);

  return (
    <mesh geometry={tubeGeo}>
      <meshBasicMaterial color="#ff6611" />
    </mesh>
  );
}

// Smoke particles
function SmokeParticles({ spireHeight }) {
  const count = 60;
  const ref = useRef();

  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.5;
      arr[i * 3 + 1] = spireHeight + Math.random() * 0.3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      vels.push({
        vy: 0.3 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.3,
        life: Math.random(),
        y0: arr[i * 3 + 1],
      });
    }
    return { arr, vels };
  }, [spireHeight]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const v = data.vels[i];
      v.life += delta * 0.5;
      pos.array[i * 3] += v.vx * delta;
      pos.array[i * 3 + 1] += v.vy * delta;
      pos.array[i * 3 + 2] += v.vz * delta;
      if (v.life > 1) {
        v.life = 0;
        pos.array[i * 3] = (Math.random() - 0.5) * 0.5;
        pos.array[i * 3 + 1] = v.y0;
        pos.array[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={data.arr} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.25} color="#666666" transparent opacity={0.3} depthWrite={false} />
    </points>
  );
}

// Ember sparks
function Embers({ spireHeight }) {
  const count = 40;
  const ref = useRef();

  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.3;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = spireHeight * (0.6 + Math.random() * 0.4);
      arr[i * 3 + 2] = Math.sin(a) * r;
      vels.push({
        vy: 0.6 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.8,
        vz: (Math.random() - 0.5) * 0.8,
        life: Math.random(),
        y0: arr[i * 3 + 1],
      });
    }
    return { arr, vels };
  }, [spireHeight]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const v = data.vels[i];
      v.life += delta * 0.7;
      pos.array[i * 3] += v.vx * delta;
      pos.array[i * 3 + 1] += v.vy * delta;
      pos.array[i * 3 + 2] += v.vz * delta;
      if (v.life > 1) {
        v.life = 0;
        pos.array[i * 3] = (Math.random() - 0.5) * 0.3;
        pos.array[i * 3 + 1] = v.y0;
        pos.array[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={data.arr} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#ff8822" transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}

// Glow ring around base
function GlowRing({ y }) {
  return (
    <mesh position={[0, y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[hexShape, 32]} />
      <meshBasicMaterial color="#ff4400" side={THREE.BackSide} transparent opacity={0.2} />
    </mesh>
  );
}

export default function TheSpire({ regionHeight }) {
  const wy = regionHeight + 0.04;
  const spireH = 3.0;

  return (
    <group>
      {/* Base glow ring */}
      <GlowRing y={wy} />

      {/* Central spire */}
      <SpirePeak height={spireH} />

      {/* Lava streams down the spire */}
      {[0, Math.PI * 0.45, Math.PI * 0.9, Math.PI * 1.35, Math.PI * 1.8].map((angle, i) => (
        <LavaStream key={i} startY={spireH * 0.7} endY={wy + 0.02} angle={angle} radius={0.35 + (i % 3) * 0.12} />
      ))}

      {/* Smoke rising from peak */}
      <SmokeParticles spireHeight={spireH} />

      {/* Ember sparks */}
      <Embers spireHeight={spireH} />

      {/* Ambient glow light */}
      <pointLight position={[0, wy + 0.3, 0]} color="#ff4411" intensity={1.5} distance={6} />

      {/* Small lava pools scattered on surface (sizes seeded from index) */}
      {[[0.6, wy + 0.03, 0.5, 0.35], [-0.8, wy + 0.03, -0.4, 0.5], [0.1, wy + 0.03, -0.9, 0.4], [-0.5, wy + 0.03, 0.7, 0.55]].map(([x, y, z, r], i) => (
        <group key={`pool${i}`}>
          <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[r, 16]} />
            <meshBasicMaterial color="#ff4411" transparent opacity={0.6} />
          </mesh>
          <mesh position={[x, y + 0.01, z]} scale={[3, 3, 1]}>
            <circleGeometry args={[r, 8]} />
            <meshBasicMaterial color="#ff2200" transparent opacity={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
