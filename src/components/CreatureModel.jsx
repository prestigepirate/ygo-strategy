import { useEffect, useRef, Suspense, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

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

function ModelMesh({ creatureId, active, scale, onLoaded }) {
  const ref = useRef();
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/${creatureId}.glb`);
  const hasFiredLoaded = useRef(false);

  const clonedScene = useMemo(() => scene.clone(), [scene]);

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
    <primitive
      ref={ref}
      object={clonedScene}
      scale={0.22 * scale}
      position={[0, 0.18, 0]}
    />
  );
}

export default function CreatureModel({ creature, active, scale = 1, onLoaded }) {
  if (!KNOWN_MODELS.has(creature.id)) return null;

  return (
    <Suspense fallback={null}>
      <ModelMesh creatureId={creature.id} active={active} scale={scale} onLoaded={onLoaded} />
    </Suspense>
  );
}
