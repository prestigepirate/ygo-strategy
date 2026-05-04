import { useState } from "react";
import { useEditorStore } from "../../stores/editorStore";

const CATEGORIES = {
  Dragons: ["blue-eyes", "red-eyes", "luster-dragon", "zombie-dragon"],
  Spellcasters: ["dark-magician", "aqua-madoor"],
  Warriors: ["celtic-guardian", "giant-soldier", "flame-swordsman", "beaver-warrior"],
  Fiends: ["summoned-skull", "kuriboh"],
  "Winged Beasts": ["harpie-lady"],
};

function categoryFor(id) {
  for (const [cat, ids] of Object.entries(CATEGORIES)) {
    if (ids.includes(id)) return cat;
  }
  return "Other";
}

const ALL_MODELS = Object.values(CATEGORIES).flat();

const GROUPED = {};
for (const id of ALL_MODELS) {
  const cat = categoryFor(id);
  (GROUPED[cat] ??= []).push(id);
}

export default function AssetLibrary() {
  const selectedAsset = useEditorStore((s) => s.selectedAsset);
  const selectAsset = useEditorStore((s) => s.selectAsset);
  const [expanded, setExpanded] = useState(
    () => Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, true]))
  );

  const toggleCat = (cat) => setExpanded((p) => ({ ...p, [cat]: !p[cat] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        GLB Assets
      </div>
      {Object.entries(GROUPED).map(([cat, ids]) => (
        <div key={cat}>
          <button
            onClick={() => toggleCat(cat)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "#aaa",
              fontSize: "0.72rem",
              padding: "3px 6px",
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: "0.6rem", transition: "transform 0.15s", transform: expanded[cat] ? "rotate(90deg)" : "none" }}>&#9654;</span>
            {cat} ({ids.length})
          </button>
          {expanded[cat] &&
            ids.map((id) => (
              <div
                key={id}
                onClick={() => selectAsset({ id, path: `/models/${id}.glb`, category: cat })}
                style={{
                  padding: "4px 8px 4px 22px",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  color: selectedAsset?.id === id ? "#fff" : "#999",
                  background: selectedAsset?.id === id ? "rgba(100,140,220,0.25)" : "transparent",
                  borderLeft: selectedAsset?.id === id ? "2px solid #6688cc" : "2px solid transparent",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {id.replace(/-/g, " ")}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
