import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_COLORS, PLAYER_NAMES } from "../data/gameState";

// ── Main Tower (Capital) — tall dark fortress with energy crown ──
function MainTower({ ownerColor, towerHP, maxHP }) {
  const glowRef = useRef();
  const hpRatio = towerHP / maxHP;

  const structure = useMemo(() => {
    // Base — wide octagonal foundation
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8);
    // Mid section — tapering shaft with subtle bulge
    const midGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.2, 8);
    // Upper section
    const upperGeo = new THREE.CylinderGeometry(0.2, 0.32, 1.0, 8);
    // Crown ring
    const crownGeo = new THREE.TorusGeometry(0.28, 0.06, 8, 12);
    // Energy orb at peak
    const orbGeo = new THREE.SphereGeometry(0.18, 16, 16);
    // Buttress pillars (4)
    const pillarGeo = new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6);
    // Damage cracks — visible as HP drops
    const crackGeo = new THREE.TorusGeometry(0.32, 0.015, 6, 8);

    return { baseGeo, midGeo, upperGeo, crownGeo, orbGeo, pillarGeo, crackGeo };
  }, []);

  // Stone materials
  const darkStone = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1a1818", roughness: 0.7, metalness: 0.1,
  }), []);
  const midStone = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#252222", roughness: 0.65, metalness: 0.15,
  }), []);
  const accentMetal = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#3a3530", roughness: 0.3, metalness: 0.7,
  }), []);

  // Glow pulse
  useFrame((state) => {
    if (glowRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Base foundation */}
      <mesh position={[0, 0.18, 0]} geometry={structure.baseGeo} material={darkStone} />

      {/* Buttress pillars at corners */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={`pillar-${i}`}
          position={[Math.cos(angle) * 0.45, 1.3, Math.sin(angle) * 0.45]}
          rotation={[0, 0, 0.08 * (i % 2 === 0 ? 1 : -1)]}
          geometry={structure.pillarGeo}
          material={midStone}
        />
      ))}

      {/* Main shaft */}
      <mesh position={[0, 1.5, 0]} geometry={structure.midGeo} material={midStone} />

      {/* Structural rings */}
      {[0.5, 1.1, 1.7, 2.2].map((y, i) => (
        <mesh key={`ring-${i}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={structure.crownGeo}>
          <primitive object={i === 3 ? accentMetal : darkStone} attach="material" />
        </mesh>
      ))}

      {/* Upper section */}
      <mesh position={[0, 2.85, 0]} geometry={structure.upperGeo} material={darkStone} />

      {/* Crown ring */}
      <mesh position={[0, 3.45, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={structure.crownGeo} material={accentMetal} />

      {/* Energy orb at peak */}
      <mesh ref={glowRef} position={[0, 3.75, 0]} geometry={structure.orbGeo}>
        <meshBasicMaterial color={ownerColor} />
      </mesh>

      {/* Orb outer glow */}
      <mesh position={[0, 3.75, 0]} scale={[3.5, 3.5, 3.5]} geometry={structure.orbGeo}>
        <meshBasicMaterial color={ownerColor} transparent opacity={0.18} />
      </mesh>

      {/* Point light from orb */}
      <pointLight position={[0, 3.75, 0]} color={ownerColor} intensity={1.2} distance={5} />

      {/* Damage cracks — red glow rings that appear as HP drops */}
      {hpRatio < 0.7 && (
        <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={structure.crackGeo}>
          <meshBasicMaterial color="#ff4422" transparent opacity={0.4 * (1 - hpRatio)} />
        </mesh>
      )}
      {hpRatio < 0.4 && (
        <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2.5, 0, 0]} geometry={structure.crackGeo}>
          <meshBasicMaterial color="#ff2200" transparent opacity={0.55 * (1 - hpRatio)} />
        </mesh>
      )}

      {/* HP bar indicator — floating ring that shrinks */}
      <mesh position={[0, 4.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.36, 32, 1, 0, Math.PI * 2 * hpRatio]} />
        <meshBasicMaterial color={hpRatio > 0.5 ? "#44ff44" : hpRatio > 0.25 ? "#ffaa22" : "#ff2222"} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Secondary Tower — smaller defensive outpost ──
function SecondaryTower({ ownerColor }) {
  const glowRef = useRef();

  const structure = useMemo(() => {
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.25, 6);
    const shaftGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6);
    const crownGeo = new THREE.TorusGeometry(0.2, 0.04, 6, 8);
    const orbGeo = new THREE.SphereGeometry(0.11, 12, 12);
    return { baseGeo, shaftGeo, crownGeo, orbGeo };
  }, []);

  const stone = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1e1c1c", roughness: 0.7, metalness: 0.1,
  }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#35302d", roughness: 0.35, metalness: 0.65,
  }), []);

  useFrame((state) => {
    if (glowRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <mesh position={[0, 0.13, 0]} geometry={structure.baseGeo} material={stone} />
      <mesh position={[0, 0.9, 0]} geometry={structure.shaftGeo} material={stone} />
      {[0.4, 0.9, 1.35].map((y, i) => (
        <mesh key={`r${i}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={structure.crownGeo}>
          <primitive object={i === 2 ? metal : stone} attach="material" />
        </mesh>
      ))}
      <mesh ref={glowRef} position={[0, 1.6, 0]} geometry={structure.orbGeo}>
        <meshBasicMaterial color={ownerColor} />
      </mesh>
      <mesh position={[0, 1.6, 0]} scale={[2.5, 2.5, 2.5]} geometry={structure.orbGeo}>
        <meshBasicMaterial color={ownerColor} transparent opacity={0.2} />
      </mesh>
      <pointLight position={[0, 1.6, 0]} color={ownerColor} intensity={0.5} distance={3} />
    </group>
  );
}

// ── Props interface ─────────────────────────────────────────
export default function Tower({
  position,
  owner,       // "player-1" | "player-2"
  isMain = false,
  towerHP = 8000,
  maxHP = 8000,
}) {
  const color = PLAYER_COLORS[owner] || "#888888";
  const label = PLAYER_NAMES[owner];

  return (
    <group position={position}>
      {isMain ? (
        <MainTower ownerColor={color} towerHP={towerHP} maxHP={maxHP} />
      ) : (
        <SecondaryTower ownerColor={color} />
      )}
    </group>
  );
}
