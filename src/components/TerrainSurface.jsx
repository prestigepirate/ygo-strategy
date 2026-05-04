import { useMemo } from "react";
import * as THREE from "three";
import { HEX_SIZE } from "../data/regions";
import { getTerrainTextures, getSharedDiffuse } from "../data/terrainTextures";

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

export default function TerrainSurface({ terrain, regionHeight }) {
  const procTextures = useMemo(() => getTerrainTextures(terrain), [terrain]);
  const sharedDiffuse = getSharedDiffuse();

  const y = regionHeight + 0.04;

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[hexShape, 48]} />
      <meshStandardMaterial
        map={sharedDiffuse}
        normalMap={procTextures.normal}
        roughnessMap={procTextures.roughness}
        roughness={0.7}
        metalness={0.05}
      />
    </mesh>
  );
}
