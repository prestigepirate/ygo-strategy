import { useRef, useState, Suspense, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Text } from "@react-three/drei";
import * as THREE from "three";
import { useEditorStore, TOOLS } from "../../stores/editorStore";
import { TERRAIN_COLORS, HEX_SIZE } from "../../data/regions";
import { PLAYER_COLORS } from "../../data/gameState";

function ModelMesh({ assetId, scale }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/${assetId}.glb`);
  return (
    <primitive object={scene.clone()} scale={scale[0] * 0.22} position={[0, 0.2, 0]} />
  );
}

function hexShape(size) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function HexMesh({ terrain, height }) {
  const shape = useMemo(() => hexShape(HEX_SIZE * 0.9), []);
  const terrainColor = TERRAIN_COLORS[terrain] || "#888";
  const extrudeSettings = { steps: 1, depth: height, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06 };

  return (
    <group>
      <mesh position={[0, height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial color="#1a1818" roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh position={[0, height + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={terrainColor} roughness={0.6} />
      </mesh>
      <Text
        position={[0, height + 0.25, 0]}
        fontSize={0.18}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {terrain}
      </Text>
    </group>
  );
}

function KingBaseMesh({ owner }) {
  const glowRef = useRef();

  const darkStone = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1a1818", roughness: 0.7, metalness: 0.1,
  }), []);
  const midStone = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#252222", roughness: 0.65, metalness: 0.15,
  }), []);

  const isGold = owner === "gold";
  const isSilver = owner === "silver";
  const ownerColor = isGold ? "#d4a017" : isSilver ? "#c0c0c0" : PLAYER_COLORS[owner] || "#888";

  const accentMetal = useMemo(() => new THREE.MeshStandardMaterial({
    color: isGold ? "#b8860b" : isSilver ? "#a8a8a8" : "#3a3530",
    roughness: isGold || isSilver ? 0.2 : 0.3,
    metalness: isGold || isSilver ? 0.9 : 0.7,
  }), [isGold, isSilver]);

  useFrame((state) => {
    if (glowRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Base foundation */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.35, 8]} />
        <primitive object={darkStone} attach="material" />
      </mesh>
      {/* Buttress pillars */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={`p${i}`}
          position={[Math.cos(angle) * 0.45, 1.3, Math.sin(angle) * 0.45]}
          rotation={[0, 0, 0.08 * (i % 2 === 0 ? 1 : -1)]}
        >
          <cylinderGeometry args={[0.07, 0.1, 2.4, 6]} />
          <primitive object={midStone} attach="material" />
        </mesh>
      ))}
      {/* Main shaft */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.45, 2.2, 8]} />
        <primitive object={midStone} attach="material" />
      </mesh>
      {/* Structural rings */}
      {[0.5, 1.1, 1.7, 2.2].map((y, i) => (
        <mesh key={`r${i}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.06, 8, 12]} />
          <primitive object={i >= 2 || isGold || isSilver ? accentMetal : darkStone} attach="material" />
        </mesh>
      ))}
      {/* Upper section */}
      <mesh position={[0, 2.85, 0]}>
        <cylinderGeometry args={[0.2, 0.32, 1.0, 8]} />
        <primitive object={darkStone} attach="material" />
      </mesh>
      {/* Crown ring */}
      <mesh position={[0, 3.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.06, 8, 12]} />
        <primitive object={accentMetal} attach="material" />
      </mesh>
      {/* Energy orb */}
      <mesh ref={glowRef} position={[0, 3.75, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color={ownerColor} />
      </mesh>
      <mesh position={[0, 3.75, 0]} scale={[3.5, 3.5, 3.5]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color={ownerColor} transparent opacity={0.18} />
      </mesh>
      <pointLight position={[0, 3.75, 0]} color={ownerColor} intensity={1.2} distance={5} />
    </group>
  );
}

const CLICK_CATCHER_SIZE = {
  tower: [0.7, 2.4, 0.7],
  "king-base": [1.0, 4.2, 1.0],
  hex: [HEX_SIZE * 1.8, 0.8, HEX_SIZE * 1.8],
  asset: [0.5, 0.6, 0.5],
};

const SELECTION_RING = {
  tower: [0.36, 0.42],
  "king-base": [0.6, 0.68],
  hex: [HEX_SIZE * 0.88, HEX_SIZE * 0.94],
  asset: [0.18, 0.22],
};

export default function PlacedObject({ obj }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const selectObject = useEditorStore((s) => s.selectObject);

  const isSelected = selectedObjectId === obj.id;
  const baseCat = CLICK_CATCHER_SIZE[obj.type] || CLICK_CATCHER_SIZE.asset;
  const catSize = obj.type === "hex"
    ? [baseCat[0], Math.max(0.4, (obj.height || 0.5) + 0.1), baseCat[2]]
    : baseCat;
  const ringSize = SELECTION_RING[obj.type] || SELECTION_RING.asset;

  const handleClick = (e) => {
    if (!editMode) return;
    e.stopPropagation();
    if (activeTool === TOOLS.DELETE) {
      useEditorStore.getState().removeObject(obj.id);
    } else {
      selectObject(obj.id);
    }
  };

  return (
    <group
      ref={meshRef}
      position={obj.position}
      scale={obj.scale}
      rotation={obj.rotation ? new THREE.Euler(...obj.rotation) : undefined}
    >
      {/* Click-catcher — guarantees hits on all object types */}
      <mesh
        position={[0, catSize[1] / 2, 0]}
        onClick={handleClick}
        onPointerOver={(e) => { if (editMode) { e.stopPropagation(); setHovered(true); } }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={catSize} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} />
      </mesh>

      {obj.type === "tower" ? (
        <group>
          {/* Foundation */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.34, 0.44, 8]} />
            <meshStandardMaterial color="#1a1818" roughness={0.7} metalness={0.1} />
          </mesh>
          {/* Main shaft */}
          <mesh position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.24, 0.9, 8]} />
            <meshStandardMaterial color="#252322" roughness={0.6} metalness={0.15} />
          </mesh>
          {/* Structural ring */}
          <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.21, 0.04, 8, 16]} />
            <meshStandardMaterial color="#3a3530" roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Upper section */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 0.5, 8]} />
            <meshStandardMaterial color="#252322" roughness={0.6} metalness={0.15} />
          </mesh>
          {/* Battlements ring */}
          <mesh position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.16, 0.035, 8, 16]} />
            <meshStandardMaterial color="#3a3530" roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Roof cone */}
          <mesh position={[0, 1.98, 0]} castShadow>
            <coneGeometry args={[0.16, 0.36, 8]} />
            <meshStandardMaterial color={obj.owner === "player-2" ? "#8b3030" : "#2a4478"} roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Beacon orb */}
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color={obj.owner === "player-2" ? "#cc4444" : "#4488dd"} />
          </mesh>
          <mesh position={[0, 2.2, 0]} scale={[2.5, 2.5, 2.5]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color={obj.owner === "player-2" ? "#cc4444" : "#4488dd"} transparent opacity={0.15} />
          </mesh>
          <pointLight position={[0, 2.2, 0]} color={obj.owner === "player-2" ? "#cc4444" : "#4488dd"} intensity={1.0} distance={5} />
        </group>
      ) : obj.type === "king-base" ? (
        <KingBaseMesh owner={obj.owner || "player-1"} />
      ) : obj.type === "hex" ? (
        <HexMesh terrain={obj.terrain} height={obj.height} />
      ) : (
        <Suspense fallback={null}>
          <ModelMesh assetId={obj.assetId} scale={obj.scale} />
        </Suspense>
      )}

      {/* Selection / hover ring */}
      {(isSelected || hovered) && editMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[...ringSize, 32]} />
          <meshBasicMaterial
            color={isSelected ? "#ffd700" : "#ffffff"}
            side={THREE.DoubleSide}
            transparent
            opacity={isSelected ? 0.9 : 0.4}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}
