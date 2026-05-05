import { useRef, Suspense, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const KNOWN_MODELS = new Set([
  "dark-magician",
  "blue-eyes",
  "red-eyes",
  "kuriboh",
  "celtic-guardian",
  "giant-soldier",
  "aqua-madoor",
  "luster-dragon",
  "flame-swordsman",
  "zombie-dragon",
  "harpie-lady",
  "beaver-warrior",
  "summoned-skull",
]);

const FACTION_GLOW = {
  "player-1": "#4488ff",
  "player-2": "#ff5533",
};

// ── Rim glow: backface-scaled clone creates outline ─────────
function RimGlowMeshes({ scene, color, glowIntensity }) {
  const groupRef = useRef();

  const glowMeshes = useMemo(() => {
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const g = child.geometry.clone();
        const m = new THREE.MeshBasicMaterial({
          color,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.15,
          depthTest: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.scale.set(1.06, 1.06, 1.06);
        mesh.position.copy(child.position);
        mesh.rotation.copy(child.rotation);
        mesh.userData = { baseOpacity: 0.15 };
        meshes.push(mesh);
      }
    });
    return meshes;
  }, [scene, color]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = glowIntensity;
    for (const child of groupRef.current.children) {
      if (child.material) {
        child.material.opacity += (target * (child.userData?.baseOpacity || 0.15) - child.material.opacity) * delta * 6;
      }
    }
  });

  if (glowMeshes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {glowMeshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}

function ModelMesh({ creatureId, active, scale, owner, onLoaded }) {
  const ref = useRef();
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/${creatureId}.glb`);
  const hasFiredLoaded = useRef(false);

  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const glowColor = FACTION_GLOW[owner] || FACTION_GLOW["player-1"];

  useEffect(() => {
    if (scene && !hasFiredLoaded.current) {
      hasFiredLoaded.current = true;
      onLoaded?.();
    }
  }, [scene, onLoaded]);

  useFrame((_, delta) => {
    if (ref.current && active) {
      ref.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <group scale={0.22 * scale} position={[0, 0.18, 0]}>
      {/* Rim glow outline — backface rendering */}
      <RimGlowMeshes
        scene={clonedScene}
        color={glowColor}
        glowIntensity={active ? 1.0 : 0.4}
      />
      {/* Actual 3D model */}
      <primitive ref={ref} object={clonedScene} />
    </group>
  );
}

export default function CreatureModel({ creature, active, scale = 1, owner = "player-1", onLoaded }) {
  if (!KNOWN_MODELS.has(creature.id)) return null;

  return (
    <Suspense fallback={null}>
      <ModelMesh
        creatureId={creature.id}
        active={active}
        scale={scale}
        owner={owner}
        onLoaded={onLoaded}
      />
    </Suspense>
  );
}
