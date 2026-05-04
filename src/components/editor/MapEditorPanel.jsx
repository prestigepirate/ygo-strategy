import { useEditorStore, TOOLS, TERRAIN_TYPES } from "../../stores/editorStore";
import { TERRAIN_COLORS } from "../../data/regions";
import AssetLibrary from "./AssetLibrary";

const toolDefs = [
  { id: TOOLS.PLACE_TOWER, label: "Tower", icon: "🏗", desc: "Click terrain to place tower" },
  { id: TOOLS.PLACE_KING_BASE, label: "King Base", icon: "🏰", desc: "Click terrain to place main tower" },
  { id: TOOLS.PLACE_ASSET, label: "Asset", icon: "📦", desc: "Select a GLB then click terrain" },
  { id: TOOLS.PLACE_HEX, label: "Add Hex", icon: "⬡", desc: "Click terrain to place hex region" },
  { id: TOOLS.MOVE, label: "Move", icon: "✥", desc: "Drag gizmo. Shift+↑↓ = altitude" },
  { id: TOOLS.SCALE, label: "Scale", icon: "⤢", desc: "Drag gizmo. Shift+↑↓ = uniform scale" },
  { id: TOOLS.DELETE, label: "Delete", icon: "✕", desc: "Click objects to remove. Esc = deselect" },
];

export default function MapEditorPanel() {
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const selectedAsset = useEditorStore((s) => s.selectedAsset);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const placedObjects = useEditorStore((s) => s.placedObjects);
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeObject = useEditorStore((s) => s.removeObject);
  const clearAllObjects = useEditorStore((s) => s.clearAllObjects);
  const hexTerrain = useEditorStore((s) => s.hexTerrain);
  const hexHeight = useEditorStore((s) => s.hexHeight);
  const setHexConfig = useEditorStore((s) => s.setHexConfig);
  const kingBaseOwner = useEditorStore((s) => s.kingBaseOwner);
  const setKingBaseOwner = useEditorStore((s) => s.setKingBaseOwner);

  const selectedObj = placedObjects.find((o) => o.id === selectedObjectId);

  if (!editMode) return null;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", letterSpacing: 0.5 }}>MAP EDITOR</span>
        <span style={{ fontSize: "0.65rem", color: "#666" }}>
          {placedObjects.length} object{placedObjects.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tools */}
      <SectionLabel>TOOLS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {toolDefs.map((t) => (
          <ToolButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            desc={t.desc}
            active={activeTool === t.id}
            onClick={() => setActiveTool(t.id)}
          />
        ))}
      </div>

      <Divider />

      {/* Asset library */}
      <AssetLibrary />

      {/* Selected asset indicator */}
      {selectedAsset && activeTool === TOOLS.PLACE_ASSET && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            background: "rgba(68,136,255,0.15)",
            border: "1px solid rgba(68,136,255,0.3)",
            borderRadius: 4,
            fontSize: "0.68rem",
            color: "#88bbff",
          }}
        >
          Active asset: <strong>{selectedAsset.id}</strong>
          <br />
          Click terrain to place
        </div>
      )}

      {/* Hex placement config */}
      {activeTool === TOOLS.PLACE_HEX && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionLabel>TERRAIN</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {TERRAIN_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setHexConfig(t, hexHeight)}
                style={{
                  padding: "3px 6px",
                  background: hexTerrain === t ? `${TERRAIN_COLORS[t]}44` : "transparent",
                  border: hexTerrain === t ? `1px solid ${TERRAIN_COLORS[t]}` : "1px solid #333",
                  borderRadius: 3,
                  color: hexTerrain === t ? "#fff" : "#888",
                  cursor: "pointer",
                  fontSize: "0.62rem",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <SectionLabel>HEIGHT</SectionLabel>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={hexHeight}
            onChange={(e) => setHexConfig(hexTerrain, parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <span style={{ fontSize: "0.62rem", color: "#888", textAlign: "center" }}>
            {hexHeight.toFixed(1)}
          </span>
        </div>
      )}

      {/* King base owner selector */}
      {activeTool === TOOLS.PLACE_KING_BASE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <SectionLabel>OWNER</SectionLabel>
          <select
            value={kingBaseOwner}
            onChange={(e) => setKingBaseOwner(e.target.value)}
            style={{
              width: "100%",
              background: "#111",
              border: "1px solid #333",
              borderRadius: 3,
              color: "#ccc",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.7rem",
              padding: "4px 6px",
            }}
          >
            <option value="player-1">Crimson Dominion</option>
            <option value="player-2">Azure Coalition</option>
            <option value="gold">Gold Throne</option>
            <option value="silver">Silver Citadel</option>
          </select>
        </div>
      )}

      <Divider />

      {/* Properties inspector */}
      <SectionLabel>PROPERTIES</SectionLabel>
      {selectedObj ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: "0.7rem", color: "#ccc" }}>
            <strong>
              {selectedObj.type === "tower" ? "Tower"
              : selectedObj.type === "king-base" ? "King Base"
              : selectedObj.type === "hex" ? "Hex"
              : selectedObj.assetId}
            </strong>
            <span style={{ color: "#555", marginLeft: 6 }}>#{selectedObj.id.slice(-4)}</span>
          </div>

          <Vec3Field
            label="Position"
            value={selectedObj.position}
            onChange={(v) => updateObject(selectedObj.id, { position: v })}
          />

          {selectedObj.type === "king-base" ? (
            <div>
              <div style={{ fontSize: "0.62rem", color: "#555", marginBottom: 2 }}>Owner</div>
              <select
                value={selectedObj.owner || "player-1"}
                onChange={(e) => updateObject(selectedObj.id, { owner: e.target.value })}
                style={{
                  width: "100%",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: 3,
                  color: "#ccc",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "0.65rem",
                  padding: "3px 4px",
                }}
              >
                <option value="player-1">Crimson Dominion</option>
                <option value="player-2">Azure Coalition</option>
                <option value="gold">Gold Throne</option>
                <option value="silver">Silver Citadel</option>
              </select>
            </div>
          ) : selectedObj.type === "hex" ? (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", color: "#555", marginBottom: 2 }}>Terrain</div>
                <select
                  value={selectedObj.terrain || "plains"}
                  onChange={(e) => updateObject(selectedObj.id, { terrain: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#111",
                    border: "1px solid #333",
                    borderRadius: 3,
                    color: "#ccc",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "0.65rem",
                    padding: "3px 4px",
                  }}
                >
                  {TERRAIN_TYPES.map((t) => (
                    <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.62rem", color: "#555", marginBottom: 2 }}>Height</div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={selectedObj.height || 0.5}
                  onChange={(e) => updateObject(selectedObj.id, { height: parseFloat(e.target.value) })}
                  style={{ width: "100%" }}
                />
                <span style={{ fontSize: "0.62rem", color: "#888" }}>{(selectedObj.height || 0.5).toFixed(1)}</span>
              </div>
            </>
          ) : (
            <>
              <Vec3Field
                label="Scale"
                value={selectedObj.scale}
                onChange={(v) => updateObject(selectedObj.id, { scale: v })}
                step={0.05}
              />
              <Vec3Field
                label="Rotation"
                value={selectedObj.rotation}
                onChange={(v) => updateObject(selectedObj.id, { rotation: v })}
                step={5}
              />
            </>
          )}

          <button
            onClick={() => removeObject(selectedObj.id)}
            style={dangerBtnStyle}
          >
            Delete Selected
          </button>
        </div>
      ) : (
        <div style={{ fontSize: "0.68rem", color: "#555", fontStyle: "italic" }}>
          Select an object to edit its properties
        </div>
      )}

      <Divider />

      {/* Danger zone */}
      {placedObjects.length > 0 && (
        <>
          <button onClick={clearAllObjects} style={{ ...dangerBtnStyle, opacity: 0.6 }}>
            Clear All Objects
          </button>
          <button
            onClick={() => {
              const json = JSON.stringify(placedObjects, null, 2);
              console.log("EDITOR OBJECTS EXPORT:\n" + json);
              navigator.clipboard.writeText(json).then(() => alert("Copied " + placedObjects.length + " objects to clipboard. Paste them to Claude."));
            }}
            style={{ ...dangerBtnStyle, opacity: 0.8, background: "rgba(100,180,100,0.15)", border: "1px solid rgba(100,180,100,0.4)" }}
          >
            Export Objects to Clipboard
          </button>
        </>
      )}
    </div>
  );
}

// ── sub-components ──────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "0.65rem", fontWeight: 700, color: "#666",
      textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#222", margin: "8px 0" }} />;
}

function ToolButton({ icon, label, desc, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={desc}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 8px",
        background: active ? "rgba(100,140,220,0.2)" : "transparent",
        border: active ? "1px solid rgba(100,140,220,0.4)" : "1px solid transparent",
        borderRadius: 4,
        color: active ? "#fff" : "#999",
        cursor: "pointer",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.72rem",
        textAlign: "left",
        transition: "all 0.12s",
      }}
    >
      <span style={{ width: 22, textAlign: "center", fontSize: "0.85rem" }}>{icon}</span>
      <span>{label}</span>
      {active && <span style={{ marginLeft: "auto", color: "#6688cc", fontSize: "0.6rem" }}>●</span>}
    </button>
  );
}

function Vec3Field({ label, value, onChange, step = 0.1 }) {
  const [x, y, z] = value;
  const clamp = (v) => Math.round(v * 100) / 100;

  const sharedStyle = {
    width: "100%",
    background: "#111",
    border: "1px solid #333",
    borderRadius: 3,
    color: "#ccc",
    fontFamily: "monospace",
    fontSize: "0.65rem",
    padding: "2px 4px",
    textAlign: "center",
    outline: "none",
  };

  return (
    <div>
      <div style={{ fontSize: "0.62rem", color: "#555", marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", gap: 3 }}>
        {["X", "Y", "Z"].map((axis, i) => (
          <label key={axis} style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
            <span style={{ fontSize: "0.6rem", color: "#555" }}>{axis}</span>
            <input
              type="number"
              step={step}
              value={clamp(value[i])}
              onChange={(e) => {
                const v = [...value];
                v[i] = parseFloat(e.target.value) || 0;
                onChange(v);
              }}
              style={sharedStyle}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────

const panelStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  width: 230,
  maxHeight: "100vh",
  overflowY: "auto",
  background: "rgba(12,12,28,0.94)",
  borderRight: "1px solid #222",
  padding: "12px 10px",
  zIndex: 25,
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  scrollbarWidth: "thin",
  scrollbarColor: "#333 transparent",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  color: "#ddd",
  paddingBottom: 6,
  borderBottom: "1px solid #222",
};

const dangerBtnStyle = {
  width: "100%",
  padding: "5px 8px",
  background: "rgba(220,60,60,0.15)",
  border: "1px solid rgba(220,60,60,0.3)",
  borderRadius: 4,
  color: "#dd6666",
  cursor: "pointer",
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.7rem",
};
