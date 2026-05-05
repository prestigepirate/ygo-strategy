import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Preset color themes ──────────────────────────────────────
export const RING_THEMES = {
  selection:   { inner: "#ffd700", outer: "#fff8dc", name: "Selection" },
  friendly:    { inner: "#3388ff", outer: "#88ccff", name: "Friendly" },
  enemy:       { inner: "#ff4422", outer: "#ff8866", name: "Enemy" },
  hostile:     { inner: "#ff2200", outer: "#ff6644", name: "Hostile" },
  ability:     { inner: "#44aaff", outer: "#aaddff", name: "Ability" },
  trap:        { inner: "#cc44ff", outer: "#ee88ff", name: "Trap" },
  heal:        { inner: "#44dd44", outer: "#88ff88", name: "Heal" },
  neutral:     { inner: "#aaaaaa", outer: "#dddddd", name: "Neutral" },
};

// ── Shared geometries (keyed by size + segments for reuse) ───
const geoCache = new Map();

function getRingGeo(innerR, outerR, segments) {
  const key = `${innerR}|${outerR}|${segments}`;
  if (!geoCache.has(key)) {
    geoCache.set(key, new THREE.RingGeometry(innerR, outerR, segments));
  }
  return geoCache.get(key);
}

// ── Shared materials (keyed by color) ────────────────────────
const matCache = new Map();

function getRingMaterial(color, transparent = true) {
  const key = `${color}|${transparent}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent,
      depthTest: true,
      depthWrite: false,
    }));
  }
  return matCache.get(key);
}

// ── GroundRing component ────────────────────────────────────
const GroundRing = forwardRef(function GroundRing({
  // Sizing
  radius = 0.4,
  width = 0.08,
  // Theme
  theme = "selection",
  customColor = null,        // Override: { inner, outer }
  // Animation
  pulseSpeed = 1.0,          // Multiplier for pulse speed
  rotateSpeed = 0,           // Degrees/sec, 0 = no rotation
  scaleRange = [0.94, 1.06], // Min/max scale pulse
  opacityRange = [0.5, 0.9], // Min/max opacity pulse
  // Lifecycle
  duration = 0,              // 0 = permanent, >0 = auto-remove after ms
  fadeIn = true,             // Fade in on mount
  fadeOut = true,            // Fade out before removal
  // Position
  yOffset = 0.04,            // Height above ground
  // Callbacks
  onComplete = null,         // Called when temporary ring finishes
  // Inner glow ring (wider, softer)
  innerGlow = true,
  innerWidth = 0.15,
  innerOpacityMult = 0.3,
  // Outer edge ring (thin, sharp)
  outerEdge = true,
  outerWidth = 0.03,
  outerOpacityMult = 0.7,
}, ref) {
  const groupRef = useRef();
  const innerRef = useRef();
  const outerRef = useRef();
  const startTime = useRef(performance.now());
  const phase = useRef(Math.random() * Math.PI * 2); // Random start phase

  // Resolve colors
  const colors = customColor || RING_THEMES[theme] || RING_THEMES.selection;

  // Shared geometries
  const innerGeo = getRingGeo(radius, radius + innerWidth, 48);
  const outerGeo = getRingGeo(radius, radius + outerWidth, 48);

  // Shared materials
  const innerMat = getRingMaterial(colors.inner);
  const outerMat = getRingMaterial(colors.outer);

  // Expose controls via ref
  useImperativeHandle(ref, () => ({
    getGroup: () => groupRef.current,
    setOpacity: (v) => {
      if (innerRef.current) innerRef.current.material.opacity = v * innerOpacityMult;
      if (outerRef.current) outerRef.current.material.opacity = v * outerOpacityMult;
    },
    dispose: () => {
      if (groupRef.current) {
        groupRef.current.parent?.remove(groupRef.current);
      }
    },
  }));

  // Fade-in on mount
  useEffect(() => {
    if (!fadeIn) return;
    if (innerRef.current) innerRef.current.material.opacity = 0;
    if (outerRef.current) outerRef.current.material.opacity = 0;
    startTime.current = performance.now();
  }, []);

  // Auto-remove after duration
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onComplete?.();
      if (groupRef.current?.parent) {
        // Parent removes the ring via React or manual cleanup
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = (performance.now() - startTime.current) / 1000;
    const t = clock.elapsedTime;

    // Fade-in (first 0.3s)
    const fadeInProgress = fadeIn ? Math.min(elapsed / 0.3, 1) : 1;

    // Fade-out (last 0.3s of duration)
    let fadeOutProgress = 1;
    if (duration > 0 && fadeOut) {
      const remaining = (duration / 1000) - elapsed;
      fadeOutProgress = Math.min(remaining / 0.3, 1);
    }

    const fadeMult = fadeInProgress * fadeOutProgress;

    // Pulse
    const [scaleMin, scaleMax] = scaleRange;
    const [opacityMin, opacityMax] = opacityRange;
    const pulse = Math.sin(t * 3 * pulseSpeed + phase.current) * 0.5 + 0.5;
    const currentScale = scaleMin + pulse * (scaleMax - scaleMin);

    // Apply to group
    groupRef.current.scale.setScalar(currentScale);

    // Rotation
    if (rotateSpeed !== 0) {
      groupRef.current.rotation.z += THREE.MathUtils.degToRad(rotateSpeed) * (1 / 60);
    }

    // Inner glow ring
    if (innerRef.current && innerGlow) {
      const baseOpacity = opacityMin + pulse * (opacityMax - opacityMin);
      innerRef.current.material.opacity = baseOpacity * innerOpacityMult * fadeMult;
    }

    // Outer edge ring
    if (outerRef.current && outerEdge) {
      const baseOpacity = opacityMin + pulse * (opacityMax - opacityMin);
      outerRef.current.material.opacity = baseOpacity * outerOpacityMult * fadeMult;
    }
  });

  return (
    <group ref={groupRef} position={[0, yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Inner glow — wide, soft */}
      {innerGlow && (
        <mesh ref={innerRef} geometry={innerGeo} material={innerMat} />
      )}
      {/* Outer edge — thin, sharp */}
      {outerEdge && (
        <mesh ref={outerRef} geometry={outerGeo} material={outerMat} />
      )}
    </group>
  );
});

export default GroundRing;
