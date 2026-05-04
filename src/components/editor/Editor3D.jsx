import { useRef, useCallback, useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditorStore, TOOLS } from "../../stores/editorStore";
import { getMapObjects } from "../../data/mapObjects";
import { getActiveMapId } from "../../data/regions";
import PlacedObject from "./PlacedObject";

const KEY_STEP = 0.1;

export default function Editor3D() {
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedAsset = useEditorStore((s) => s.selectedAsset);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const placedObjects = useEditorStore((s) => s.placedObjects);
  const addObject = useEditorStore((s) => s.addObject);
  const selectObject = useEditorStore((s) => s.selectObject);
  const updateObject = useEditorStore((s) => s.updateObject);

  const { camera, raycaster, pointer } = useThree();
  const groundRef = useRef();
  const selectedRef = useRef();
  const [previewPos, setPreviewPos] = useState(null);

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    if (!editMode) return;

    const handleKeyDown = (e) => {
      // Escape: deselect
      if (e.key === "Escape") {
        const store = useEditorStore.getState();
        if (store.selectedObjectId) store.selectObject(null);
        return;
      }

      if (!e.shiftKey) return;

      let delta = 0;
      if (e.key === "ArrowUp") delta = KEY_STEP;
      else if (e.key === "ArrowDown") delta = -KEY_STEP;
      if (delta === 0) return;

      e.preventDefault();

      const store = useEditorStore.getState();
      const obj = store.placedObjects.find((o) => o.id === store.selectedObjectId);
      if (!obj) return;

      if (store.activeTool === TOOLS.SCALE) {
        const s = Math.max(0.05, obj.scale[0] + delta);
        store.updateObject(obj.id, { scale: [s, s, s] });
      } else {
        store.updateObject(obj.id, {
          position: [obj.position[0], obj.position[1] + delta, obj.position[2]],
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode]);

  // ── Raycasting against placement plane ──────────────────────
  const getPlacementPoint = useCallback(() => {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(groundRef.current, false);
    if (intersects.length > 0) {
      const p = intersects[0].point;
      const snap = 0.1;
      return [
        Math.round(p.x / snap) * snap,
        0.05,
        Math.round(p.z / snap) * snap,
      ];
    }
    return null;
  }, [camera, pointer, raycaster]);

  // Preview follows pointer when placing
  useFrame(() => {
    if (!editMode) {
      setPreviewPos(null);
      return;
    }
    if (activeTool === TOOLS.PLACE_TOWER || activeTool === TOOLS.PLACE_ASSET || activeTool === TOOLS.PLACE_HEX || activeTool === TOOLS.PLACE_KING_BASE) {
      setPreviewPos(getPlacementPoint());
    } else {
      setPreviewPos(null);
    }
  });

  // ── Ground plane click (placement / deselect) ──────────────
  const handleGroundClick = useCallback(
    (e) => {
      if (!editMode) return;
      e.stopPropagation();

      if (activeTool === TOOLS.PLACE_TOWER) {
        const pt = getPlacementPoint();
        if (pt) {
          addObject({ type: "tower", owner: "player-1", position: pt, scale: [1, 1, 1], rotation: [0, 0, 0] });
        }
      } else if (activeTool === TOOLS.PLACE_ASSET && selectedAsset) {
        const pt = getPlacementPoint();
        if (pt) {
          addObject({ type: "asset", assetId: selectedAsset.id, position: pt, scale: [1, 1, 1], rotation: [0, 0, 0] });
        }
      } else if (activeTool === TOOLS.PLACE_HEX) {
        const pt = getPlacementPoint();
        if (pt) {
          const store = useEditorStore.getState();
          addObject({ type: "hex", terrain: store.hexTerrain, height: store.hexHeight, position: pt, scale: [1, 1, 1], rotation: [0, 0, 0] });
        }
      } else if (activeTool === TOOLS.PLACE_KING_BASE) {
        const pt = getPlacementPoint();
        if (pt) {
          const store = useEditorStore.getState();
          addObject({ type: "king-base", owner: store.kingBaseOwner, position: pt, scale: [1, 1, 1], rotation: [0, 0, 0] });
        }
      } else if (activeTool === TOOLS.MOVE || activeTool === TOOLS.SCALE || activeTool === TOOLS.DELETE) {
        // Clicking empty ground deselects
        useEditorStore.getState().selectObject(null);
      }
    },
    [editMode, activeTool, selectedAsset, addObject, getPlacementPoint]
  );

  const selectedObj = placedObjects.find((o) => o.id === selectedObjectId);

  return (
    <>
      {/* Ground plane for placement raycasting */}
      <mesh
        ref={groundRef}
        position={[0, -0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} />
      </mesh>

      {/* Map baked-in objects */}
      {getMapObjects(getActiveMapId()).map((obj) => (
        <PlacedObject key={obj.id} obj={obj} />
      ))}

      {/* Editor-placed objects (skip any already baked into the map) */}
      {placedObjects.filter((o) => !getMapObjects(getActiveMapId()).some((m) => m.id === o.id)).map((obj) => (
        <PlacedObject key={obj.id} obj={obj} />
      ))}

      {/* Placement preview ring */}
      {editMode && previewPos && (activeTool === TOOLS.PLACE_TOWER || activeTool === TOOLS.PLACE_ASSET || activeTool === TOOLS.PLACE_HEX || activeTool === TOOLS.PLACE_KING_BASE) && (
        <mesh position={previewPos}>
          <ringGeometry args={[0.12, 0.16, 24]} />
          <meshBasicMaterial
            color={
              activeTool === TOOLS.PLACE_TOWER ? "#ffcc44"
              : activeTool === TOOLS.PLACE_HEX ? "#44ff66"
              : activeTool === TOOLS.PLACE_KING_BASE ? "#ff8844"
              : "#44ccff"
            }
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}

      {/* Transform gizmo — only for Move/Scale tools */}
      {editMode && selectedObj && (activeTool === TOOLS.MOVE || activeTool === TOOLS.SCALE) && (
        <TransformControls
          key={`${selectedObj.id}-${activeTool}`}
          object={selectedRef}
          mode={activeTool === TOOLS.SCALE ? "scale" : "translate"}
          size={0.6}
          onObjectChange={(e) => {
            const o = e.target.object;
            if (!o) return;
            const pos = o.position.toArray();
            const scl = o.scale.toArray();
            const rot = o.rotation.toArray();
            updateObject(selectedObj.id, {
              position: [pos[0], pos[1], pos[2]],
              scale: [scl[0], scl[1], scl[2]],
              rotation: [rot[0], rot[1], rot[2]],
            });
          }}
        >
          <mesh
            ref={selectedRef}
            position={selectedObj.position}
            scale={selectedObj.scale}
            rotation={selectedObj.rotation}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial transparent opacity={0} depthTest={false} />
          </mesh>
        </TransformControls>
      )}
    </>
  );
}
