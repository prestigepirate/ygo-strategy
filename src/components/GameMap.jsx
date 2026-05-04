import { useState, useCallback, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import HexRegion from "./HexRegion";
import MapBridges from "./MapBridges";
import ObsidianMarsh from "./ObsidianMarsh";
import TheSpire from "./TheSpire";
import CrystalLake from "./CrystalLake";
import Ironwood from "./Ironwood";
import AzureSpire from "./AzureSpire";
import TerrainSurface from "./TerrainSurface";
import UnitToken from "./UnitToken";
import MoveTargets from "./MoveTargets";
import TrapEffect from "./TrapEffect";
import NotificationToast from "./NotificationToast";
import RegionPanel from "./RegionPanel";
import Editor3D from "./editor/Editor3D";
import MapEditorPanel from "./editor/MapEditorPanel";
import PlacedObject from "./editor/PlacedObject";
import { useEditorStore } from "../stores/editorStore";
import { getRegions, getActiveMapId, hexToWorld, getReachableHexes, getMovementRange } from "../data/regions";
import { getMapObjects } from "../data/mapObjects";
import { startMovementAnim } from "../data/movementAnims";
import { useGameStore, getRegionOwner, getRegionCreatures, findCreatureRegion, PLAYER_COLORS, getCard, getCreature } from "../data/gameState";

// ── Camera controller ──────────────────────────────────────
const AERIAL_POS = [0, 32, 0.5];
const AERIAL_TARGET = [0, 0, 0];
const DEFAULT_POS = [8, 10, 12];
const DEFAULT_TARGET = [0, 1, 0];

function CameraController({ focusTarget, aerialView }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const savedPos = useRef(null);
  const savedTarget = useRef(null);

  // Handle focus target snap
  useEffect(() => {
    if (focusTarget && controlsRef.current) {
      const [tx, ty, tz] = focusTarget;
      controlsRef.current.target.set(tx, ty + 0.6, tz);
      camera.position.set(tx + 1.8, ty + 2.5, tz + 2.5);
      controlsRef.current.update();
    }
  }, [focusTarget, camera]);

  // Handle aerial view toggle with smooth transition
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    if (aerialView) {
      // Save current position before going aerial
      savedPos.current = camera.position.toArray();
      savedTarget.current = ctrl.target.toArray();
    }
  }, [aerialView, camera]);

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    if (aerialView) {
      const t = 1 - Math.exp(-delta * 4);
      camera.position.lerp(
        { x: AERIAL_POS[0], y: AERIAL_POS[1], z: AERIAL_POS[2] },
        t
      );
      ctrl.target.lerp(
        { x: AERIAL_TARGET[0], y: AERIAL_TARGET[1], z: AERIAL_TARGET[2] },
        t
      );
    } else if (savedPos.current) {
      // Restore saved position
      const t = 1 - Math.exp(-delta * 4);
      camera.position.lerp(
        { x: savedPos.current[0], y: savedPos.current[1], z: savedPos.current[2] },
        t
      );
      ctrl.target.lerp(
        { x: savedTarget.current[0], y: savedTarget.current[1], z: savedTarget.current[2] },
        t
      );
      // Clear saved once close enough
      if (camera.position.distanceTo(
        { x: savedPos.current[0], y: savedPos.current[1], z: savedPos.current[2] }
      ) < 0.05) {
        savedPos.current = null;
        savedTarget.current = null;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={2}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.3}
    />
  );
}

// ── 3D Scene ───────────────────────────────────────────────
function MapScene({ selectedRegion, onSelectRegion, focusTarget, selectedUnit, onSelectUnit, onMoveUnit, trapTrigger, onTrapComplete, aerialView }) {
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const state = useGameStore();
  const editMode = useEditorStore((s) => s.editMode);
  const regions = getRegions();

  const handleHover = useCallback((id) => setHoveredRegion(id), []);
  const handleUnhover = useCallback(() => setHoveredRegion(null), []);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 18, 6]}
        intensity={0.85}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-5, 3, -5]} intensity={0.2} color="#445566" />

      <Sky sunPosition={[100, 60, 20]} turbidity={12} />
      <Stars radius={60} depth={60} count={800} factor={5} saturation={0} fade speed={0.3} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#050510" roughness={0.95} />
      </mesh>

      <gridHelper args={[30, 30, "#111122", "#111122"]} position={[0, -1.49, 0]} />

      <MapBridges regions={regions} />

      {/* Region hexes */}
      {regions.map((region) => {
        const [x, , z] = hexToWorld(region.q, region.r);
        const regionOwner = getRegionOwner(state, region.id);
        const ownerColor = PLAYER_COLORS[regionOwner];
        const markers = state.regionMarkers[region.id];
        return (
          <HexRegion
            key={region.id}
            region={region}
            position={[x, 0, z]}
            isSelected={selectedRegion === region.id}
            isHovered={hoveredRegion === region.id}
            onSelect={onSelectRegion}
            onHover={handleHover}
            onUnhover={handleUnhover}
            ownerColor={ownerColor !== PLAYER_COLORS.neutral ? ownerColor : null}
            p1Markers={markers?.["player-1"] ?? 0}
            p2Markers={markers?.["player-2"] ?? 0}
          />
        );
      })}

      {/* Terrain surfaces — procedural shaders for every region */}
      {regions.map((region) => {
        const [x, , z] = hexToWorld(region.q, region.r);
        return (
          <group key={`terrain-${region.id}`} position={[x, 0, z]}>
            <TerrainSurface terrain={region.terrain} regionHeight={region.height} />
          </group>
        );
      })}

      {/* Unit tokens on regions */}
      {regions.map((region) => {
        const creatures = getRegionCreatures(state, region.id);
        if (creatures.length === 0) return null;
        const [rx, , rz] = hexToWorld(region.q, region.r);
        const y = region.height + 0.02;
        return (
          <group key={`units-${region.id}`}>
            {creatures.map((creature, i) => {
              const creatureOwner = state.creatureOwners[creature.id] || "neutral";
              return (
                <UnitToken
                  key={creature.id}
                  creature={creature}
                  owner={creatureOwner}
                  position={[rx, y, rz]}
                  index={i}
                  total={creatures.length}
                  isSelected={selectedUnit === creature.id}
                  onSelect={onSelectUnit}
                />
              );
            })}
          </group>
        );
      })}

      {/* Move targets — highlight adjacent regions when a unit is selected */}
      <MoveTargets selectedUnit={selectedUnit} onMove={onMoveUnit} />

      {/* Trap trigger effect */}
      {trapTrigger && (
        <TrapEffect
          position={trapTrigger.position}
          regionHeight={trapTrigger.regionHeight}
          trapColor={trapTrigger.color}
          active={true}
          onComplete={onTrapComplete}
        />
      )}

      {/* Detailed region layers */}
      <DetailRegionSection regionId="obsidian-marsh" Component={ObsidianMarsh} />
      <DetailRegionSection regionId="the-spire" Component={TheSpire} />
      <DetailRegionSection regionId="crystal-lake" Component={CrystalLake} />
      <DetailRegionSection regionId="ironwood" Component={Ironwood} />
      <DetailRegionSection regionId="forge-gate" Component={AzureSpire} />

      {/* Towers placed via editor — PlacedHexes renders them below */}

      {/* Editor-placed hex regions (visible always, not just edit mode) */}
      <PlacedHexes />

      {editMode && <Editor3D />}

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.3}
          luminanceSmoothing={0.6}
          intensity={0.8}
          radius={0.5}
          mipmapBlur
        />
      </EffectComposer>

      <CameraController focusTarget={focusTarget} aerialView={aerialView} />
    </>
  );
}

function PlacedHexes() {
  const editMode = useEditorStore((s) => s.editMode);
  const placedObjects = useEditorStore((s) => s.placedObjects);
  const mapObjects = getMapObjects(getActiveMapId());

  // In edit mode, Editor3D handles rendering everything
  if (editMode) return null;

  // Merge map objects with editor objects, deduplicating by ID (map objects win)
  const mapIds = new Set(mapObjects.map((o) => o.id));
  const merged = [...mapObjects, ...placedObjects.filter((o) => !mapIds.has(o.id))];
  if (merged.length === 0) return null;

  return (
    <>
      {merged.map((obj) => (
        <PlacedObject key={obj.id} obj={obj} />
      ))}
    </>
  );
}

function DetailRegionSection({ regionId, Component }) {
  const region = getRegions().find((r) => r.id === regionId);
  if (!region) return null;
  const [x, , z] = hexToWorld(region.q, region.r);
  return (
    <group position={[x, 0, z]}>
      <Component regionHeight={region.height} />
    </group>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function GameMap() {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [trapTrigger, setTrapTrigger] = useState(null);
  const [aerialView, setAerialView] = useState(false);
  const editMode = useEditorStore((s) => s.editMode);
  const toggleEditMode = useEditorStore((s) => s.toggleEditMode);

  const focusOn = (regionId) => {
    const region = getRegions().find((r) => r.id === regionId);
    if (region) {
      const [x, y, z] = hexToWorld(region.q, region.r);
      setFocusTarget([x, y, z]);
      setTimeout(() => setFocusTarget(null), 100);
    }
  };

  const handleSelectRegion = (id) => {
    if (editMode) return;
    const state = useGameStore.getState();

    // If a card from hand is selected, deploy/set/cast instead of opening panel
    if (state.selectedHandCard && state.handMode) {
      const cardId = state.selectedHandCard;

      if (state.handMode === "deploy") {
        const success = state.deployCreature("player-1", cardId, id);
        if (success) state.clearHandSelection();
      } else if (state.handMode === "trap") {
        const success = state.setTrapFromHand("player-1", cardId, id);
        if (success) state.clearHandSelection();
      } else if (state.handMode === "spell") {
        const spellCard = getCard(cardId);
        if (spellCard?.target === "region" || spellCard?.target === "deck") {
          const success = state.castSpell("player-1", cardId, id, null);
          if (success) state.clearHandSelection();
        }
      } else if (state.handMode === "field") {
        const success = state.deployFieldSpell("player-1", cardId, id);
        if (success) state.clearHandSelection();
      }
      return;
    }

    setSelectedRegion(id === selectedRegion ? null : id);
    setSelectedUnit(null);
  };

  const handleSelectUnit = (id) => {
    if (editMode) return;
    const state = useGameStore.getState();

    // If hand card selected, handle equipment or creature-targeting spell
    if (state.selectedHandCard && state.handMode) {
      if (state.handMode === "equip") {
        const creatureOwner = state.creatureOwners[id];
        if (creatureOwner === "player-1") {
          state.equipCreature("player-1", state.selectedHandCard, id);
          state.clearHandSelection();
        }
        return;
      }
      if (state.handMode === "spell") {
        const spellCard = getCard(state.selectedHandCard);
        if (spellCard?.target === "creature") {
          // For monster-reborn: need region too — use the creature's current region
          const regionId = findCreatureRegion(state, id);
          const success = state.castSpell("player-1", state.selectedHandCard, regionId, id);
          if (success) state.clearHandSelection();
        }
        return;
      }
      return;
    }

    state.clearHandSelection();
    setSelectedUnit(id === selectedUnit ? null : id);
  };

  const handleMoveUnit = (creatureId, targetRegionId) => {
    if (editMode) return;
    const state = useGameStore.getState();
    if (state.immobilized[creatureId]) {
      state.addNotification(`${getCreature(creatureId)?.name || creatureId} is immobilized and cannot move.`);
      setSelectedUnit(null);
      return;
    }

    // 1 move per turn
    const creatureOwner = state.creatureOwners[creatureId] || "neutral";
    if (creatureOwner !== "neutral" && (state.movesUsed[creatureOwner] || 0) >= 1) {
      state.addNotification(`You have already moved a creature this turn.`);
      setSelectedUnit(null);
      return;
    }

    const fromRegionId = findCreatureRegion(state, creatureId);
    if (!fromRegionId || targetRegionId === fromRegionId) {
      setSelectedUnit(null);
      return;
    }

    // Validate target is within movement range
    const fromRegion = getRegions().find((r) => r.id === fromRegionId);
    const toRegion = getRegions().find((r) => r.id === targetRegionId);
    if (!fromRegion || !toRegion) {
      setSelectedUnit(null);
      return;
    }

    const creature = getCreature(creatureId);
    const maxSteps = getMovementRange(creature?.level || 4);
    const reachable = getReachableHexes(fromRegion.q, fromRegion.r, maxSteps);
    const inRange = reachable.some(({ region }) => region.id === targetRegionId);
    if (!inRange) {
      state.addNotification(`${creature?.name || creatureId} (Lv${creature?.level || "?"}) can only move ${maxSteps} step(s). Target is out of range.`);
      setSelectedUnit(null);
      return;
    }

    // Start movement animation before the state update
    const [fx, , fz] = hexToWorld(fromRegion.q, fromRegion.r);
    const [tx, , tz] = hexToWorld(toRegion.q, toRegion.r);
    const fromY = fromRegion.height + 0.02;
    const toY = toRegion.height + 0.02;
    startMovementAnim(creatureId, [fx, fromY, fz], [tx, toY, tz], 600);

    const result = useGameStore.getState().moveCreatureWithTraps(creatureId, fromRegionId, targetRegionId);

    // Show trap effect if one triggered
    if (result?.triggered) {
      const targetRegion = getRegions().find((r) => r.id === targetRegionId);
      const trapColor = result.result?.trapId === "mirror-force" ? "#ff4444" : "#8844cc";
      const [tx, , tz] = hexToWorld(targetRegion?.q || 0, targetRegion?.r || 0);
      setTrapTrigger({
        position: [tx, 0, tz],
        regionHeight: targetRegion?.height || 0.4,
        color: trapColor,
      });
    }

    setSelectedUnit(null);
  };

  const handleTrapComplete = () => setTrapTrigger(null);

  const handleClosePanel = () => {
    setSelectedRegion(null);
    setSelectedUnit(null);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      <Canvas
        shadows
        camera={{ position: [8, 10, 12], fov: 45 }}
        gl={{ antialias: true }}
      >
        <MapScene
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
          focusTarget={focusTarget}
          selectedUnit={selectedUnit}
          onSelectUnit={handleSelectUnit}
          onMoveUnit={handleMoveUnit}
          trapTrigger={trapTrigger}
          onTrapComplete={handleTrapComplete}
          aerialView={aerialView}
        />
      </Canvas>

      {/* Editor panel overlay */}
      <MapEditorPanel />

      {/* Edit Map toggle button */}
      <button
        onClick={toggleEditMode}
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 25,
          background: editMode ? "rgba(100,140,220,0.3)" : "rgba(20,10,40,0.85)",
          color: editMode ? "#aaccff" : "#888",
          border: editMode ? "1px solid rgba(100,140,220,0.5)" : "1px solid #333",
          padding: "8px 14px",
          borderRadius: 6,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.75rem",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {editMode ? "Exit Editor" : "Edit Map"}
      </button>

      {/* Aerial view toggle */}
      <button
        onClick={() => setAerialView((v) => !v)}
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          zIndex: 25,
          background: aerialView ? "rgba(100,200,140,0.3)" : "rgba(20,10,40,0.85)",
          color: aerialView ? "#aaffcc" : "#888",
          border: aerialView ? "1px solid rgba(100,200,140,0.5)" : "1px solid #333",
          padding: "8px 14px",
          borderRadius: 6,
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.75rem",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {aerialView ? "▼ Aerial On" : "▲ Aerial View"}
      </button>

      {/* Top-left info */}
      <div style={{
        position: "absolute",
        top: 16,
        left: 16,
        color: "#ccc",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.85rem",
        background: "rgba(10,10,30,0.8)",
        padding: "10px 16px",
        borderRadius: 8,
        border: "1px solid #333",
        userSelect: "none",
        pointerEvents: "none",
        zIndex: 5,
      }}>
        <div style={{ fontWeight: "bold", fontSize: "1rem", marginBottom: 4 }}>Duel Realms</div>
        <div style={{ fontSize: "0.75rem", color: "#888" }}>Click regions or units to inspect</div>
      </div>

      {/* Focus buttons for detailed regions */}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 8, zIndex: 5,
      }}>
        {[
          { id: "the-spire", label: "The Spire", color: "#dd4422" },
          { id: "crystal-lake", label: "Crystal Lake", color: "#4488dd" },
          { id: "obsidian-marsh", label: "Obsidian Marsh", color: "#8844cc" },
          { id: "forge-gate", label: "Forge Gate", color: "#44aacc" },
          { id: "merrow-deep", label: "Merrow Deep", color: "#3388cc" },
        ].map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => focusOn(id)}
            style={{
              background: "rgba(20,10,40,0.85)",
              color: "#ccc",
              border: `1px solid ${color}44`,
              padding: "8px 14px",
              borderRadius: 6,
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.75rem",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notification toasts */}
      <NotificationToast />

      {/* Region detail panel */}
      <RegionPanel regionId={selectedRegion} onClose={handleClosePanel} />
    </div>
  );
}
