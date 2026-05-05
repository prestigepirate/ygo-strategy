import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_SIZE, TERRAIN_COLORS } from "../data/regions";
import { PLAYER_COLORS } from "../data/gameState";

// Create a flat-top hexagon shape
export function hexShape(size) {
  const shape = new THREE.Shape();
  const corners = 6;
  for (let i = 0; i < corners; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

const NYX_COLORS = {
  plains:   "#1a1a28",
  forest:   "#141422",
  mountain: "#181828",
  swamp:    "#161630",
  water:    "#101022",
  volcanic: "#1c1c30",
};

function MarkerPips({ p1Markers, p2Markers, height, nyxMode }) {
  const pipR = 0.075;
  const ringR = 0.42;
  const pipY = height + 0.12;
  const count = 5;
  const angleStep = (Math.PI * 2) / count;
  const startAngle = -Math.PI / 2;

  const pips = [];
  for (let i = 0; i < p1Markers; i++) pips.push(nyxMode ? "#88aacc" : PLAYER_COLORS["player-1"]);
  for (let i = 0; i < p2Markers; i++) pips.push(nyxMode ? "#ff6644" : PLAYER_COLORS["player-2"]);
  for (let i = pips.length; i < count; i++) pips.push(nyxMode ? "#333355" : PLAYER_COLORS.neutral);

  return (
    <group>
      {pips.map((color, i) => {
        const angle = startAngle + angleStep * i;
        return (
          <mesh key={i} position={[Math.cos(angle) * ringR, pipY, Math.sin(angle) * ringR]}>
            <sphereGeometry args={[pipR, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function HexRegion({
  region,
  position,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onUnhover,
  ownerColor = null,
  p1Markers = 0,
  p2Markers = 0,
  nyxMode = false,
}) {
  const meshRef = useRef();
  const _scaleVec = useRef(new THREE.Vector3());
  const [hoveredLocal, setHoveredLocal] = useState(false);
  const shape = useMemo(() => hexShape(HEX_SIZE * 0.9), []);

  const terrainColor = nyxMode
    ? (NYX_COLORS[region.terrain] || "#161628")
    : TERRAIN_COLORS[region.terrain];
  const active = isHovered || hoveredLocal;

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = active ? 1.025 : 1;
      meshRef.current.scale.lerp(
        _scaleVec.current.set(targetScale, targetScale, targetScale),
        delta * 6
      );
    }
  });

  const extrudeSettings = { steps: 1, depth: region.height, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08 };
  const hexBodyColor = nyxMode ? "#0a0a16" : "#1a1818";

  return (
    <group position={position}>
      {/* Invisible hover catcher */}
      <mesh
        position={[0, region.height / 2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHoveredLocal(true); onHover(region.id); }}
        onPointerOut={() => { setHoveredLocal(false); onUnhover(); }}
        onClick={(e) => { e.stopPropagation(); onSelect(region.id); }}
      >
        <shapeGeometry args={[hexShape(HEX_SIZE * 0.95)]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Hex prism body */}
      <mesh ref={meshRef} position={[0, region.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial
          color={hexBodyColor}
          roughness={0.8}
          metalness={nyxMode ? 0.02 : 0.05}
          emissive={nyxMode ? "#080820" : undefined}
          emissiveIntensity={nyxMode ? 0.1 : undefined}
        />
      </mesh>

      {/* Owner ring */}
      {ownerColor && (
        <mesh position={[0, region.height + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[hexShape(HEX_SIZE * 0.94)]} />
          <meshBasicMaterial color={ownerColor} side={THREE.BackSide} transparent opacity={0.35} />
        </mesh>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, region.height + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[hexShape(HEX_SIZE * 0.92)]} />
          <meshBasicMaterial color="#ffd700" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Marker pips */}
      <MarkerPips p1Markers={p1Markers} p2Markers={p2Markers} height={region.height} nyxMode={nyxMode} />

      {/* Terrain icon marker — use Nyx palette when in Nyx mode */}
      <mesh position={[0, region.height + 0.2, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={terrainColor} />
      </mesh>
    </group>
  );
}
