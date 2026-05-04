import { useState } from "react";
import { useGameStore, getCard } from "../data/gameState";

// ── MTG theme palette ──────────────────────────────────────
const G = { // gold
  light: "#c8aa4e",
  mid:   "#8b7630",
  dim:   "#5a4a20",
};
const BG  = "rgba(12, 10, 26, 0.94)";
const BGL = "rgba(18, 14, 36, 0.90)";
const TX  = "#e0d8c0";
const TX2 = "#9a9070";
const TX3 = "#6a6048";

export default function GameHUD() {
  const [cardDetail, setCardDetail] = useState(null);

  const hand = useGameStore((s) => s.playerHand["player-1"]);
  const sp = useGameStore((s) => s.playerSP["player-1"]);
  const hp = useGameStore((s) => s.playerHP["player-1"]);
  const enemyHP = useGameStore((s) => s.playerHP["player-2"]);
  const towerHP = useGameStore((s) => s.towerHP);
  const towerMaxHP = useGameStore((s) => s.towerMaxHP);
  const turn = useGameStore((s) => s.turn);
  const gameTime = useGameStore((s) => s.gameTime);
  const apocalypseWave = useGameStore((s) => s.apocalypseWave);
  const deckSize = useGameStore((s) => s.playerDeck["player-1"]?.length || 0);
  const endTurn = useGameStore((s) => s.endTurn);
  const autoPlay = useGameStore((s) => s.autoPlay);
  const startAutoPlay = useGameStore((s) => s.startAutoPlay);
  const stopAutoPlay = useGameStore((s) => s.stopAutoPlay);
  const selectedCardId = useGameStore((s) => s.selectedHandCard);
  const handMode = useGameStore((s) => s.handMode);
  const setSelectedHandCard = useGameStore((s) => s.setSelectedHandCard);
  const clearHandSelection = useGameStore((s) => s.clearHandSelection);

  const handCards = (hand || []).map((id) => getCard(id)).filter(Boolean);
  const selectedCard = selectedCardId ? getCard(selectedCardId) : null;

  const mins = Math.floor(gameTime / 60);
  const secs = gameTime % 60;
  const timerStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const timerUrgent = gameTime <= 120;

  const handleCardClick = (card) => {
    if (selectedCardId === card.id) {
      clearHandSelection();
      return;
    }
    if (card.type === "creature") {
      setSelectedHandCard(card.id, "deploy");
    } else if (card.type === "trap") {
      setSelectedHandCard(card.id, "trap");
    } else if (card.type === "equipment") {
      setSelectedHandCard(card.id, "equip");
    } else if (card.type === "spell") {
      if (card.target === "self" || card.target === "deck") {
        const state = useGameStore.getState();
        if (card.target === "deck") {
          setSelectedHandCard(card.id, "spell");
        } else {
          state.castSpell("player-1", card.id, null, null);
        }
      } else {
        setSelectedHandCard(card.id, "spell");
      }
    } else if (card.type === "field") {
      setSelectedHandCard(card.id, "field");
    }
  };

  const handleCardDetail = (card) => {
    setCardDetail(cardDetail?.id === card.id ? null : card);
  };

  return (
    <>
      {/* ── Top HUD bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        background: BG, borderBottom: `1px solid ${G.dim}`,
        padding: "6px 20px", display: "flex", justifyContent: "space-between",
        alignItems: "center", fontFamily: "system-ui, sans-serif",
        pointerEvents: "auto", zIndex: 10,
        boxShadow: `0 1px 12px rgba(0,0,0,0.5)`,
      }}>
        {/* Left — HP + enemy HP + Tower HP */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#c44b3c", boxShadow: "0 0 6px #c44b3c88",
            }} />
            <span style={{ color: "#c44b3c", fontWeight: "bold", fontSize: "0.85rem" }}>
              {hp} LP
            </span>
          </div>
          <span style={{ color: TX3, fontSize: "0.7rem" }}>│</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#5b8cc4", boxShadow: "0 0 6px #5b8cc488",
            }} />
            <span style={{ color: "#5b8cc4", fontSize: "0.85rem" }}>
              Enemy: {enemyHP} LP
            </span>
          </div>
          <span style={{ color: TX3, fontSize: "0.7rem" }}>│</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.75rem" }}>🏰</span>
            <span style={{ color: "#c0c0c0", fontSize: "0.75rem", fontWeight: 600 }}>
              {towerHP?.silver ?? 8000}
            </span>
          </div>
          <span style={{ color: TX3, fontSize: "0.7rem" }}>│</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.75rem" }}>👑</span>
            <span style={{ color: "#d4a017", fontSize: "0.75rem", fontWeight: 600 }}>
              {towerHP?.gold ?? 8000}
            </span>
          </div>
        </div>

        {/* Center — Timer + Turn */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {apocalypseWave && (
            <span style={{
              color: "#c44b3c", fontSize: "0.7rem", fontWeight: "bold",
              animation: "pulse 0.8s infinite",
              textShadow: "0 0 8px #c44b3c88",
            }}>
              ⚡ APOCALYPSE
            </span>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: timerUrgent ? "rgba(200,40,20,0.12)" : "rgba(200,170,78,0.06)",
            border: `1px solid ${timerUrgent ? "#8b3020" : G.dim}`,
            borderRadius: 4, padding: "3px 12px",
          }}>
            <span style={{
              color: timerUrgent ? "#e04030" : G.light, fontSize: "0.85rem",
              fontWeight: "bold", fontVariantNumeric: "tabular-nums",
            }}>
              {timerStr}
            </span>
          </div>
          <span style={{ color: TX3, fontSize: "0.75rem" }}>
            Turn {turn}
          </span>
        </div>

        {/* Right — SP, Deck, Auto-play, End Turn */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: "#a088cc", fontSize: "0.8rem", fontWeight: "bold" }}>
            ⭐ {sp} SP
          </span>
          <span style={{ color: TX3, fontSize: "0.7rem" }}>
            Deck: {deckSize}
          </span>
          <button
            onClick={autoPlay ? stopAutoPlay : startAutoPlay}
            style={{
              background: autoPlay ? "rgba(200,60,60,0.18)" : "rgba(60,200,100,0.1)",
              border: `1px solid ${autoPlay ? "#8b3030" : "#3a6b3a"}`,
              color: autoPlay ? "#e05050" : "#50b860",
              padding: "6px 14px", borderRadius: 4,
              cursor: "pointer", fontSize: "0.72rem", fontWeight: "bold",
              letterSpacing: "0.03em",
            }}
          >
            {autoPlay ? "Stop AI" : "AI vs AI"}
          </button>
          <button
            onClick={endTurn}
            disabled={autoPlay}
            style={{
              background: `linear-gradient(180deg, rgba(180,140,60,0.2), rgba(140,100,30,0.15))`,
              border: `1px solid ${G.mid}`,
              color: autoPlay ? TX3 : G.light,
              padding: "6px 18px", borderRadius: 4,
              cursor: autoPlay ? "not-allowed" : "pointer",
              fontSize: "0.78rem", fontWeight: "bold",
              letterSpacing: "0.04em",
              opacity: autoPlay ? 0.5 : 1,
            }}
          >
            End Turn
          </button>
        </div>
      </div>

      {/* ── Mode indicator ── */}
      {handMode && selectedCard && (
        <div style={{
          position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)",
          background: "rgba(40, 20, 60, 0.92)", border: `1px solid ${G.dim}`,
          borderRadius: 6, padding: "6px 18px", fontFamily: "system-ui, sans-serif",
          fontSize: "0.78rem", color: G.light, pointerEvents: "none", zIndex: 10,
        }}>
          {handMode === "deploy" && `Select a region to deploy ${selectedCard.name}`}
          {handMode === "trap" && `Select a region to set ${selectedCard.name}`}
          {handMode === "equip" && `Select a friendly creature to equip ${selectedCard.name}`}
          {handMode === "spell" && selectedCard?.target === "region" && `Select a region to cast ${selectedCard.name}`}
          {handMode === "spell" && selectedCard?.target === "creature" && `Select a creature to cast ${selectedCard.name}`}
          {handMode === "spell" && selectedCard?.target === "deck" && `Select a region to summon from deck`}
          {handMode === "field" && `Select a region to deploy ${selectedCard.name}`}
          <span style={{ marginLeft: 10, color: TX3, fontSize: "0.65rem" }}>(click card again to cancel)</span>
        </div>
      )}

      {/* ── Bottom hand bar ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: BG, borderTop: `1px solid ${G.dim}`,
        padding: "10px 20px", display: "flex", gap: 8,
        justifyContent: "center", alignItems: "flex-end",
        zIndex: 10, pointerEvents: "auto",
        minHeight: 100, boxShadow: `0 -1px 12px rgba(0,0,0,0.5)`,
      }}>
        {handCards.length === 0 && (
          <span style={{ color: TX3, fontSize: "0.8rem", alignSelf: "center" }}>
            No cards in hand
          </span>
        )}
        {handCards.map((card) => {
          const isSelected = selectedCardId === card.id;
          const typeColors = {
            creature: "#c4a44a", spell: "#5b8c5b", trap: "#b8456e",
            equipment: "#8b7b5a", field: "#4a8b7b",
          };
          const tc = typeColors[card.type] || TX2;
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card)}
              onContextMenu={(e) => { e.preventDefault(); handleCardDetail(card); }}
              style={{
                width: 80, height: 110,
                background: isSelected ? "rgba(180, 140, 60, 0.12)" : BGL,
                border: isSelected ? `2px solid ${G.light}` : `1px solid ${G.dim}`,
                borderRadius: 6, cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "4px", transition: "all 0.15s",
                position: "relative",
                transform: isSelected ? "translateY(-14px)" : "none",
                boxShadow: isSelected ? `0 4px 16px rgba(200,170,78,0.2)` : "none",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{card.art}</span>
              <span style={{
                fontSize: "0.53rem", color: TX, marginTop: 2,
                textAlign: "center", lineHeight: 1.1, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {card.name}
              </span>
              <span style={{
                fontSize: "0.5rem", color: tc, textTransform: "uppercase",
                position: "absolute", top: 4, right: 6,
                fontWeight: 600, letterSpacing: "0.04em",
              }}>
                {card.type}
              </span>
              <span style={{
                fontSize: "0.55rem", color: "#a088cc", position: "absolute",
                bottom: 4, right: 6, fontWeight: 600,
              }}>
                {card.cost}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Card detail popup ── */}
      {cardDetail && (
        <div onClick={() => setCardDetail(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: `linear-gradient(180deg, #1a1630, #120e24)`,
            border: `1px solid ${G.mid}`, borderRadius: 10,
            padding: "28px", maxWidth: 360, width: "90%",
            boxShadow: `0 0 40px rgba(0,0,0,0.6), 0 0 80px ${G.dim}22`,
          }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>{cardDetail.art}</div>
            <h2 style={{ margin: "0 0 4px", color: TX, fontSize: "1.1rem", fontWeight: 700 }}>
              {cardDetail.name}
            </h2>
            <span style={{
              fontSize: "0.65rem", color: G.mid, textTransform: "uppercase",
              letterSpacing: "0.08em", fontWeight: 600,
            }}>
              {cardDetail.type}
            </span>
            {cardDetail.type === "creature" && (
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <span style={{ color: "#c44b3c", fontWeight: 600 }}>ATK {cardDetail.atk}</span>
                <span style={{ color: "#5b8cc4", fontWeight: 600 }}>DEF {cardDetail.def}</span>
                <span style={{ color: TX2 }}>Lv.{cardDetail.level}</span>
                <span style={{ color: TX2, textTransform: "capitalize" }}>{cardDetail.element}</span>
              </div>
            )}
            {cardDetail.type === "trap" && (
              <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#b8456e" }}>
                Trigger: {cardDetail.trigger} · Effect: {cardDetail.trapEffect}
              </div>
            )}
            <p style={{ margin: "14px 0 0", fontSize: "0.8rem", color: TX2, lineHeight: 1.5 }}>
              {cardDetail.effect}
            </p>
            <p style={{ fontSize: "0.7rem", color: "#a088cc", marginTop: 6 }}>
              Cost: {cardDetail.cost} SP
            </p>
            <button onClick={() => setCardDetail(null)} style={{
              marginTop: 16, width: "100%",
              background: `linear-gradient(180deg, rgba(180,140,60,0.12), rgba(120,100,30,0.08))`,
              border: `1px solid ${G.dim}`, color: G.light,
              padding: "8px 20px", borderRadius: 4, cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 600,
            }}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
