import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function TrapEffect({ position, regionHeight, trapColor = "#ff4444", active, onComplete }) {
  const groupRef = useRef();
  const elapsedRef = useRef(0);
  const duration = 2.0;

  const particles = useMemo(() => {
    const count = 40;
    const data = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // upward cone
      const speed = 1.5 + Math.random() * 4;
      data.push({
        startAngle: angle,
        startPhi: phi,
        speed,
        size: 0.04 + Math.random() * 0.1,
        delay: Math.random() * 0.3,
      });
    }
    return data;
  }, []);

  // Pre-create geometries for each particle
  const meshes = useMemo(() =>
    particles.map((p, i) => ({
      key: i,
      delay: p.delay,
      speed: p.speed,
      startAngle: p.startAngle,
      startPhi: p.startPhi,
      size: p.size,
    })), [particles]);

  useFrame((_, delta) => {
    if (!active || !groupRef.current) return;
    elapsedRef.current += delta;

    if (elapsedRef.current > duration) {
      onComplete?.();
      return;
    }

    const t = elapsedRef.current;
    groupRef.current.children.forEach((mesh, i) => {
      if (!mesh || i === 0) return; // skip flash ring at index 0
      const p = particles[i - 1];
      const localT = Math.max(0, t - p.delay);
      const radius = localT * p.speed;
      const y = localT * (1.5 + p.speed * 0.3);
      const angle = p.startAngle + localT * 2;
      mesh.position.set(
        Math.cos(angle) * Math.cos(p.startPhi) * radius,
        y,
        Math.sin(angle) * Math.cos(p.startPhi) * radius
      );
      mesh.material.opacity = Math.max(0, 1 - localT / duration);
      mesh.scale.setScalar(Math.max(0.1, 1 - localT / duration));
    });
  });

  if (!active) return null;

  const y = regionHeight + 0.1;

  return (
    <group ref={groupRef} position={[position[0], y, position[2]]}>
      {/* Flash ring at base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 1.2, 32]} />
        <meshBasicMaterial color={trapColor} transparent opacity={0.7} side={THREE.DoubleSide} depthTest={false} />
      </mesh>

      {/* Particles */}
      {meshes.map((m) => (
        <mesh key={m.key}>
          <sphereGeometry args={[m.size, 6, 6]} />
          <meshBasicMaterial color={trapColor} transparent opacity={1} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
