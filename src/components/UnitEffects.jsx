import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_COLORS } from "../data/gameState";

const FACTION_COLORS = {
  "player-1": { main: "#4488ff", glow: "#66aaff", particle: "#88ccff" },
  "player-2": { main: "#ff5533", glow: "#ff7755", particle: "#ff9977" },
};

// ── Glow ring at unit base ──────────────────────────────────
function GlowRing({ color, scale, brightness, pulse }) {
  const ref = useRef();
  const ringGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.12 * scale, 0.18 * scale, 32);
    return g;
  }, [scale]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const b = brightness + (pulse ? Math.sin(performance.now() * 0.005) * 0.15 : 0);
    ref.current.material.opacity += (b - ref.current.material.opacity) * delta * 8;
  });

  return (
    <mesh ref={ref} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={ringGeo} attach="geometry" />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
        depthTest={true}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Selection light beam ────────────────────────────────────
function SelectionBeam({ color, scale, visible }) {
  const ref = useRef();
  const beamHeight = 0.6 * scale;
  const geo = useMemo(() => new THREE.CylinderGeometry(0.04 * scale, 0.06 * scale, beamHeight, 8, 1, true), [scale, beamHeight]);

  useFrame(({ clock }) => {
    if (!ref.current || !visible) return;
    ref.current.material.opacity = 0.25 + Math.sin(clock.elapsedTime * 3) * 0.1;
    ref.current.scale.y = 1 + Math.sin(clock.elapsedTime * 2) * 0.05;
  });

  return (
    <mesh ref={ref} position={[0, beamHeight / 2 + 0.02, 0]}>
      <primitive object={geo} attach="geometry" />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        depthTest={true}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Ambient faction particles ───────────────────────────────
function FactionParticles({ color, scale, count = 8, active }) {
  const ref = useRef();
  const speeds = useMemo(() => Array.from({ length: count }, () => 0.3 + Math.random() * 0.7), [count]);
  const offsets = useMemo(() => Array.from({ length: count }, () => Math.random() * Math.PI * 2), [count]);
  const radii = useMemo(() => Array.from({ length: count }, () => 0.2 + Math.random() * 0.25), [count]);
  const heights = useMemo(() => Array.from({ length: count }, () => 0.05 + Math.random() * 0.35), [count]);

  const pointsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array;
    const t = clock.elapsedTime;
    const targetOpacity = active ? 0.6 : 0.15;
    ref.current.material.opacity += (targetOpacity - ref.current.material.opacity) * 0.05;

    for (let i = 0; i < count; i++) {
      const angle = offsets[i] + t * speeds[i];
      pos[i * 3] = Math.cos(angle) * radii[i] * scale;
      pos[i * 3 + 1] = heights[i] * scale;
      pos[i * 3 + 2] = Math.sin(angle) * radii[i] * scale;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <primitive object={pointsGeo} attach="geometry" />
      <pointsMaterial
        color={color}
        size={0.025 * scale}
        transparent
        opacity={0.2}
        depthTest={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Small unit pedestal disc ────────────────────────────────
function BaseDisc({ scale }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.03 * scale, 12), [scale]);
  return (
    <mesh position={[0, 0.015 * scale, 0]}>
      <primitive object={geo} attach="geometry" />
      <meshStandardMaterial
        color="#111118"
        roughness={0.8}
        metalness={0.1}
        transparent
        opacity={0.5}
        depthWrite={true}
      />
    </mesh>
  );
}

// ── Main export ─────────────────────────────────────────────
export default function UnitEffects({
  owner,
  scale = 1,
  isHovered,
  isSelected,
}) {
  const colors = FACTION_COLORS[owner] || FACTION_COLORS["player-1"];
  const brightness = isSelected ? 0.7 : isHovered ? 0.5 : 0.25;
  const active = isHovered || isSelected;

  return (
    <group>
      {/* Subtle base disc for small units */}
      {scale < 2.0 && <BaseDisc scale={scale} />}

      {/* Faction glow ring */}
      <GlowRing
        color={colors.glow}
        scale={scale}
        brightness={brightness}
        pulse={active}
      />

      {/* Selection beam */}
      {isSelected && (
        <SelectionBeam
          color={colors.glow}
          scale={scale}
          visible={isSelected}
        />
      )}

      {/* Faction ambient particles */}
      <FactionParticles
        color={colors.particle}
        scale={scale}
        count={Math.floor(6 + scale * 2)}
        active={active}
      />
    </group>
  );
}
