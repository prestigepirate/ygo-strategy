import { useState, useMemo } from "react";
import { ALL_CARDS, CREATURES, SPELLS, TRAPS, EQUIPMENT, FIELD_SPELLS } from "../data/cards";

const TABS = [
  { key: "all", label: "All", cards: ALL_CARDS },
  { key: "creature", label: "Creatures", cards: CREATURES },
  { key: "spell", label: "Spells", cards: SPELLS },
  { key: "trap", label: "Traps", cards: TRAPS },
  { key: "equipment", label: "Equipment", cards: EQUIPMENT },
  { key: "field", label: "Field", cards: FIELD_SPELLS },
];

const G = { light: "#c8aa4e", mid: "#8b7630", dim: "#5a4a20" };
const TX = "#e0d8c0";
const TX2 = "#9a9070";
const TX3 = "#6a6048";
const BG = "#0d0a1c";

export default function DeckBuilder({ deck, onAddCard, onRemoveCard, onConfirm, minCards = 20, maxCards = 30, themeName, themeColor, onBack }) {
  const [tab, setTab] = useState("all");
  const [viewCard, setViewCard] = useState(null);
  const currentCards = TABS.find((t) => t.key === tab)?.cards || ALL_CARDS;

  const deckCards = useMemo(() =>
    deck.map((id) => ALL_CARDS.find((c) => c.id === id)).filter(Boolean),
    [deck]);

  const deckCounts = useMemo(() => {
    const counts = {};
    for (const id of deck) counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, [deck]);

  const isValid = deck.length >= minCards && deck.length <= maxCards;

  return (
    <div style={{
      width: "100vw", height: "100vh", background: BG, color: TX,
      fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px", borderBottom: `1px solid ${G.dim}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(20, 14, 36, 0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: "none", border: `1px solid ${G.dim}`, color: TX3,
              width: 34, height: 34, borderRadius: 6, cursor: "pointer",
              fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
            }}>←</button>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", color: G.light, fontWeight: 700, letterSpacing: "0.02em" }}>
              {themeName ? `${themeName} — Deck Builder` : "Deck Builder"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: TX3 }}>
              {deck.length} / {minCards}–{maxCards} cards
              {themeName && (
                <span style={{ color: themeColor || G.light, marginLeft: 8 }}>Pre-loaded archetype</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onConfirm}
          disabled={!isValid}
          style={{
            background: isValid
              ? `linear-gradient(180deg, rgba(180,140,60,0.2), rgba(140,100,30,0.15))`
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${isValid ? G.mid : G.dim}`,
            color: isValid ? G.light : TX3,
            padding: "10px 28px", borderRadius: 6, fontSize: "0.88rem",
            cursor: isValid ? "pointer" : "default", fontWeight: "bold",
            letterSpacing: "0.04em",
          }}
        >
          {isValid ? "Save Deck & Start" : `${minCards} cards minimum`}
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, padding: "8px 24px",
        borderBottom: `1px solid ${G.dim}22`, background: "rgba(0,0,0,0.15)",
      }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? "rgba(180, 140, 60, 0.08)" : "transparent",
            border: tab === t.key ? `1px solid ${G.dim}` : "1px solid transparent",
            color: tab === t.key ? G.light : TX3,
            padding: "5px 14px", borderRadius: 4, fontSize: "0.74rem",
            cursor: "pointer", transition: "all 0.15s",
            textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Card grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 8,
          }}>
            {currentCards.map((card) => {
              const count = deckCounts[card.id] || 0;
              const maxCopies = 3;
              return (
                <div key={card.id} onClick={() => setViewCard(card)} style={{
                  background: "rgba(20, 16, 40, 0.6)",
                  border: `1px solid ${G.dim}33`,
                  borderRadius: 6, padding: "10px", cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = `${G.mid}88`}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = `${G.dim}33`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "1.1rem" }}>{card.art}</span>
                    <span style={{
                      fontSize: "0.6rem", color: TX3, textTransform: "uppercase",
                      letterSpacing: "0.06em", fontWeight: 600,
                    }}>{card.type}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem", color: TX, marginTop: 4 }}>
                    {card.name}
                  </div>
                  {card.type === "creature" && (
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: "0.7rem" }}>
                      <span style={{ color: "#c44b3c" }}>ATK {card.atk}</span>
                      <span style={{ color: "#5b8cc4" }}>DEF {card.def}</span>
                      <span style={{ color: TX3 }}>Lv.{card.level}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveCard(card.id); }} disabled={count === 0}
                      style={{
                        background: "rgba(200,50,50,0.08)", border: `1px solid ${G.dim}33`,
                        color: count > 0 ? "#c44b3c" : TX3,
                        width: 26, height: 26, borderRadius: 4,
                        cursor: count > 0 ? "pointer" : "default",
                        fontSize: "0.9rem", lineHeight: "24px",
                      }}>−</button>
                    <span style={{
                      fontSize: "0.74rem", color: TX2, minWidth: 16,
                      textAlign: "center", lineHeight: "26px", fontWeight: 600,
                    }}>{count}</span>
                    <button onClick={(e) => { e.stopPropagation(); onAddCard(card.id); }}
                      disabled={count >= maxCopies || deck.length >= maxCards}
                      style={{
                        background: "rgba(100,180,100,0.06)", border: `1px solid ${G.dim}33`,
                        color: count < maxCopies && deck.length < maxCards ? "#6aaa44" : TX3,
                        width: 26, height: 26, borderRadius: 4,
                        cursor: count < maxCopies && deck.length < maxCards ? "pointer" : "default",
                        fontSize: "0.9rem", lineHeight: "24px",
                      }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deck sidebar */}
        <div style={{
          width: 280, borderLeft: `1px solid ${G.dim}33`,
          padding: "16px", overflowY: "auto",
          background: "rgba(14, 10, 26, 0.4)",
        }}>
          <h2 style={{
            margin: "0 0 12px", fontSize: "0.76rem", color: G.mid,
            textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700,
          }}>Your Deck</h2>
          {deckCards.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: TX3 }}>Add cards to your deck. {minCards}–{maxCards} required.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {deckCards.map((card, i) => (
              <div key={`${card.id}-${i}`} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", background: "rgba(20, 16, 40, 0.5)",
                borderRadius: 4, fontSize: "0.76rem",
                border: `1px solid ${G.dim}22`,
              }}>
                <span style={{ fontSize: "0.9rem" }}>{card.art}</span>
                <span style={{ flex: 1, color: TX }}>{card.name}</span>
                <span style={{ color: TX3, fontSize: "0.6rem", textTransform: "uppercase" }}>{card.type}</span>
                <button onClick={() => onRemoveCard(card.id)} style={{
                  background: "none", border: "none", color: "#c44b3c",
                  cursor: "pointer", fontSize: "1rem",
                }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card detail modal */}
      {viewCard && (
        <div onClick={() => setViewCard(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: `linear-gradient(180deg, #1a1630, #120e24)`,
            border: `1px solid ${G.mid}`, borderRadius: 10,
            padding: "28px", maxWidth: 360, width: "90%",
            boxShadow: `0 0 40px rgba(0,0,0,0.5)`,
          }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>{viewCard.art}</div>
            <h2 style={{ margin: "0 0 4px", color: TX, fontSize: "1.1rem", fontWeight: 700 }}>
              {viewCard.name}
            </h2>
            <span style={{
              fontSize: "0.65rem", color: G.mid, textTransform: "uppercase",
              letterSpacing: "0.08em", fontWeight: 600,
            }}>{viewCard.type}</span>
            {viewCard.type === "creature" && (
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <span style={{ color: "#c44b3c", fontWeight: 600 }}>ATK {viewCard.atk}</span>
                <span style={{ color: "#5b8cc4", fontWeight: 600 }}>DEF {viewCard.def}</span>
                <span style={{ color: TX2 }}>Lv.{viewCard.level}</span>
                <span style={{ color: TX2, textTransform: "capitalize" }}>{viewCard.element}</span>
              </div>
            )}
            {(viewCard.type === "trap") && (
              <div style={{ marginTop: 10, fontSize: "0.76rem", color: "#b8456e" }}>
                Trigger: {viewCard.trigger || "?"} · Effect: {viewCard.trapEffect || "?"}
              </div>
            )}
            <p style={{ margin: "14px 0 0", fontSize: "0.78rem", color: TX2, lineHeight: 1.5 }}>
              {viewCard.effect}
            </p>
            <p style={{ fontSize: "0.7rem", color: "#a088cc", marginTop: 6 }}>Cost: {viewCard.cost} SP</p>
            <button onClick={() => setViewCard(null)} style={{
              marginTop: 16, width: "100%",
              background: `linear-gradient(180deg, rgba(180,140,60,0.12), rgba(120,100,30,0.08))`,
              border: `1px solid ${G.dim}`, color: G.light,
              padding: "8px 20px", borderRadius: 4, cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 600,
            }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
