import { Component } from "react";
import GameShell from "./components/GameShell";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Caught error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: "fixed", inset: 0, background: "#0a0a1a", color: "#ff4444",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", fontFamily: "monospace", padding: 40,
        }}>
          <h1 style={{ marginBottom: 16 }}>Render Error</h1>
          <pre style={{
            whiteSpace: "pre-wrap", maxWidth: 800, fontSize: 13,
            background: "rgba(255,255,255,0.05)", padding: 20, borderRadius: 8,
            lineHeight: 1.6,
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameShell />
    </ErrorBoundary>
  );
}
