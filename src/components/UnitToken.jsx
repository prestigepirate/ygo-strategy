import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../data/gameState";
import CreatureModel from "./CreatureModel";
import { getMovementAnim, clearMovementAnim } from "../data/movementAnims";

function creatureBaseScale(level) {
  if (level <= 2) return 1.2;
  if (level <= 3) return 1.5;
  if (level <= 4) return 1.8;
  if (level <= 5) return 2.2;
  if (level <= 6) return 2.8;
  if (level <= 7) return 3.5;
  if (level <= 8) return 4.4;
  return 5.5;
}

export default function UnitToken({ creature, owner, position, index = 0, total = 1, isSelected, onSelect }) {
  const groupRef = useRef();
  const _scaleVec = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);
  const active = hovered || isSelected;
  const immobilized = useGameStore((s) => s.immobilized[creature.id]);
  const buff = useGameStore((s) => s.tempBuffs[creature.id]);

  const s = creatureBaseScale(creature.level || 4);

  // Offset multiple units on same region so they don't overlap — scales with creature size
  const spacing = 0.4 * s;
  const offsetX = total > 1 ? (index - (total - 1) / 2) * spacing : 0;
  const offsetZ = total > 1 ? 0.15 * s : 0;

  const animRef = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const anim = getMovementAnim(creature.id);
    const baseX = position[0] + offsetX;
    const baseY = position[1];
    const baseZ = position[2] + offsetZ;

    if (anim) {
      animRef.current = true;
      const elapsed = performance.now() - anim.startTime;
      if (elapsed >= anim.duration) {
        clearMovementAnim(creature.id);
        groupRef.current.position.x = baseX;
        groupRef.current.position.z = baseZ;
      } else {
        const t = elapsed / anim.duration;
        const eased = t * (2 - t); // ease-out
        groupRef.current.position.x = anim.fromX + (baseX - anim.fromX) * eased;
        groupRef.current.position.z = anim.fromZ + (baseZ - anim.fromZ) * eased;
      }
    } else if (animRef.current) {
      animRef.current = false;
      groupRef.current.position.x = baseX;
      groupRef.current.position.z = baseZ;
    }

    // Hover/selection Y float + scale
    const targetY = active ? baseY + 0.2 * s : baseY;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * delta * 6;
    const targetScale = active ? s * 1.15 : s;
    groupRef.current.scale.lerp(
      _scaleVec.current.set(targetScale, targetScale, targetScale),
      delta * 6
    );
  });

  const ringRadius = 0.16 * s;

  return (
    <group
      ref={groupRef}
      position={[position[0] + offsetX, position[1], position[2] + offsetZ]}
      onClick={(e) => { e.stopPropagation(); onSelect(creature.id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 3D model (glb) — stripped all effects to isolate the block */}
      <CreatureModel creature={creature} active={active} scale={s} />
    </group>
  );
}

function LevelPips({ level, ringRadius, scale }) {
  const pips = [];
  const maxPips = Math.min(level, 10);
  const pipR = 0.025 * scale;
  for (let i = 0; i < maxPips; i++) {
    const angle = (i / maxPips) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * (ringRadius + 0.04 * scale);
    const pz = Math.sin(angle) * (ringRadius + 0.04 * scale);
    const intensity = 1 - i / maxPips * 0.5;
    pips.push(
      <mesh key={i} position={[px, 0.15 * scale, pz]}>
        <sphereGeometry args={[pipR, 6, 6]} />
        <meshBasicMaterial color={`hsl(${40 - i * 3}, 80%, ${50 + intensity * 20}%)`} />
      </mesh>
    );
  }
  return <group>{pips}</group>;
}
