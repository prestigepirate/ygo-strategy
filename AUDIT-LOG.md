# ygo-strategy — Full Code Audit Log

> **Generated:** 2026-05-04 15:45 ET
> **Backup:** ~/ygo-strategy-backup-20260504-1543
> **Files Scanned:** 44 (315K total)
> **Scope:** All .jsx, .js, .css, .html, .json files (excl. node_modules, dist, .git)

---

## CHANGE LOG — Fixes Applied

### BATCH 1 — Data Layer (traps + package)
| Status | File | Line(s) | Description | Severity |
|--------|------|---------|-------------|----------|
| | `src/data/traps.js` | 38-73 | Add resolver for magic-cylinder, widespread-ruin, dust-tornado | P0 Critical |
| | `package.json` | — | Add zustand to dependencies | P1 High |
| | `src/data/gameState.js` | 78 | Fix default activeMap to valid map ID | P1 High |

### BATCH 2 — Core Engine (gameState.js)
| Status | File | Line(s) | Description | Severity |
|--------|------|---------|-------------|----------|
| | `src/data/gameState.js` | 750-754 | Fix duplicate creatures after battle | P0 Critical |
| | `src/data/gameState.js` | 1020-1030 | Fix AI double SP budget | P0 Critical |
| | `src/data/gameState.js` | 1332-1349 | Fix AI turn state discard on empty deck | P0 Critical |
| | `src/components/GameMap.jsx` | 411 | Fix `result.result?.trapId` double-dot typo | P0 Critical |

### BATCH 3 — Component Fixes
| Status | File | Line(s) | Description | Severity |
|--------|------|---------|-------------|----------|
| | `src/components/CreatureModel.jsx` | 36 | useMemo for scene.clone() | P0 Critical |
| | `src/components/Ironwood.jsx` | 111 | useMemo for random rotations | P0 Critical |
| | `src/components/TrapEffect.jsx` | 49,61 | Fix fragile child indexing + type guard | P0 Critical |
| | `src/components/BattlefieldBoundary.jsx` | 122 | useMemo for GlowTube geometry | P1 High |
| | `src/components/GameHUD.jsx` | 36 | Null guard on hand.map() | P1 High |
| | `src/components/MoveTargets.jsx` | 90 | Fix incomplete state proxy | P1 High |
| | `src/shaders/terrainShaders.js` | 196 | Fix water shader Fresnel to use perturbed normals | P1 High |

### BATCH 4 — Performance + Leaks
| Status | File | Line(s) | Description | Severity |
|--------|------|---------|-------------|----------|
| | Multiple components | various | Add geometry/material disposal (AzureSpire, TheSpire, CrystalLake, ObsidianMarsh, Tower) | P2 Medium |
| | Multiple components | various | Per-frame allocations → pre-allocated (HexRegion, UnitToken, GameMap CameraController) | P2 Medium |
| | `src/data/gameState.js` | 814-818 | Fix auto-play setTimeout leaks | P2 Medium |

### BATCH 5 — Minor/Cleanup
| Status | File | Line(s) | Description | Severity |
|--------|------|---------|-------------|----------|
| | `src/data/terrainTextures.js` | 50 | Remove dead `getPixels` function | P3 Minor |
| | `src/data/gameState.js` | 1489-1491 | Remove `isMainTowerRegion` stub | P3 Minor |
| | `src/components/GameHUD.jsx` | 315 | Move injected `<style>` to CSS file | P3 Minor |
| | `src/components/NotificationToast.jsx` | 47 | Move injected `<style>` to CSS file | P3 Minor |
| | `src/data/themedDecks.js` | 2 | Fix Dragon's Fury card count comment (19→19, was incorrectly stated as 20) | P3 Minor |
| | `src/components/DeckBuilder.jsx` | 236 | Fix "undefined" rendering for missing card fields | P3 Minor |
| | `src/components/RegionPanel.jsx` | 132 | Fix hardcoded single tower-owner mapping | P3 Minor |
| | `src/data/gameState.js` | 1189-1190 | Fix `remainingSP < 0` → `<= 0` for consistency | P3 Minor |

---

## DRAMATIC CHANGES LOG

Changes that significantly alter behavior or architecture. If something breaks, check these first:

1. **`traps.js`** — 3 new trap resolvers added. GameState expects `resolveTrap()` return shape with `survivors` and `triggered`. Any mismatch will break movement/battle flow.

2. **`gameState.js:750-754`** — Battle survivor dedup. Changed how the creature array is rebuilt after combat. If creatures start disappearing or appearing in wrong regions, this is the root cause.

3. **`gameState.js:1020-1030`** — AI SP calculation. Changed from double-SP to single-SP. AI will have half the resources it previously had — may appear weaker.

4. **`gameState.js:1332-1349`** — AI turn early return removed. Changed control flow so all accumulated state is applied before regenerating deck. If AI starts taking actions it shouldn't, check here.

5. **`CreatureModel.jsx:36`** — scene.clone() memoized. If creatures show wrong models or stale geometry, this is the cause.

6. **`GameMap.jsx:411`** — trap result display fixed. If trap notifications show wrong data or crash, revert this.

---

## ARCHITECTURAL NOTES (No Fix Applied — User Decision Needed)

| Note | Detail |
|------|--------|
| `battlefieldMap.js` (285 lines) | Completely dead code. Either wire it in or remove it. |
| Dual map system | `regions.js` (5 maps, 61 hex) is active. `battlefieldMap.js` (~180 hex, landmarks) is unused but has better design. Decision needed. |
| AI spell duplication | `processAITurn` duplicates 6 spell resolution functions already in `castSpell`. DRY violation. |
| Six identical terrain generators | `terrainTextures.js` has 6 near-identical ~60-line functions. Could be parameterized. |
| Editor <-> Game store separation | Two independent Zustand stores — deliberately separate, no conflict. Keeping as-is. |
