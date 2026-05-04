import { useGameStore, PLAYER_NAMES } from "../data/gameState";

const G = { light: "#c8aa4e", mid: "#8b7630", dim: "#5a4a20" };
const TX = "#e0d8c0";
const TX2 = "#9a9070";

export default function GameOver() {
  const hp1 = useGameStore((s) => s.playerHP["player-1"]);
  const hp2 = useGameStore((s) => s.playerHP["player-2"]);
  const gameTime = useGameStore((s) => s.gameTime);

  if (hp1 > 0 && hp2 > 0 && gameTime > 0) return null;

  const timeUp = gameTime <= 0 && hp1 > 0 && hp2 > 0;
  const winner = hp1 <= 0 ? "player-2" : "player-1";
  const loser = hp1 <= 0 ? "player-1" : "player-2";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: `linear-gradient(180deg, #1a1630, #0d0a1c)`,
        border: `1px solid ${G.mid}`, borderRadius: 14,
        padding: "48px 44px", textAlign: "center", maxWidth: 440,
        boxShadow: `0 0 60px rgba(0,0,0,0.6), 0 0 120px ${G.dim}22`,
      }}>
        <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>
          {timeUp ? "⏰" : winner === "player-1" ? "🏆" : "💀"}
        </div>
        <h1 style={{
          color: TX, margin: "0 0 8px", fontSize: "1.6rem",
          fontWeight: 700, letterSpacing: "0.02em",
        }}>
          {timeUp ? "Time's Up!" : `${PLAYER_NAMES[winner]} Wins!`}
        </h1>
        <p style={{ color: TX2, margin: "0 0 28px", fontSize: "0.9rem" }}>
          {timeUp
            ? `${PLAYER_NAMES[winner]} wins by LP advantage.`
            : `${PLAYER_NAMES[loser]} has been defeated.`}
        </p>
        <div style={{
          display: "flex", gap: 32, justifyContent: "center", marginBottom: 28,
          padding: "16px 0", borderTop: `1px solid ${G.dim}`, borderBottom: `1px solid ${G.dim}`,
        }}>
          <div>
            <div style={{ color: "#c44b3c", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {PLAYER_NAMES["player-1"]}
            </div>
            <div style={{ color: "#c44b3c", fontSize: "1.3rem", fontWeight: "bold" }}>{hp1} LP</div>
          </div>
          <div style={{ color: G.dim }}>VS</div>
          <div>
            <div style={{ color: "#5b8cc4", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {PLAYER_NAMES["player-2"]}
            </div>
            <div style={{ color: "#5b8cc4", fontSize: "1.3rem", fontWeight: "bold" }}>{hp2} LP</div>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: `linear-gradient(180deg, rgba(180,140,60,0.2), rgba(140,100,30,0.15))`,
            border: `1px solid ${G.mid}`, color: G.light,
            padding: "12px 36px", borderRadius: 6,
            cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold",
            letterSpacing: "0.04em",
          }}>
          Play Again
        </button>
      </div>
    </div>
  );
}
