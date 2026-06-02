# CLAUDE.md

Guidance for working in this repository.

## What this is

**Covert Operations: Instincts** — a 3D FPS stealth game running in the browser,
built with **vanilla Three.js + TypeScript + Vite** (no game engine, no React).
Deployed to GitHub Pages from the `gh-pages` branch via GitHub Actions.

## Commands

- `npm run dev` — local dev server (Vite).
- `npm run typecheck` — `tsc --noEmit`. Run this after changes; the project is
  written to pass strict type-checking.
- `npm run build` — production build into `dist/`. The gh-pages workflow builds
  with `--base=/coi/`; for local builds the base is `/`.

## Architecture notes

- `Game.ts` owns the renderer, scene, camera and the single `requestAnimationFrame`
  loop. It only simulates while `state === 'playing'`. All other systems are
  plain classes it updates each frame.
- The world is simulated with simple **circle-vs-AABB** collision in the XZ plane
  (`physics.ts`); the ground is a flat plane at `y = 0`. There is no full 3D
  physics — enemies and the player are vertical capsules that slide along walls.
- **Line of sight** (enemy vision, third-person camera clipping) uses a ray-vs-AABB
  slab test against the level's box colliders, not Three's raycaster, so it stays
  decoupled from the render graph.
- Levels are **hand-authored data** in `levels.ts` and assembled by `buildLevel`
  in `Level.ts` using the `Builder` helper (which creates a mesh AND its collider
  together). Add geometry by calling `Builder` methods so colliders stay in sync.
- The HUD is **DOM**, not in-canvas (`HUD.ts` + `styles.css`). Menus/overlays live
  in `main.ts` and react to `game.onStateChange`.
- Instinct unlocks persist across levels within a run; mission progress is saved
  to `localStorage` (`coi-progress`).

## Conventions

- Keep new gameplay geometry going through `Builder` so it both renders and
  collides.
- Forward vector convention: `forward = (-sin(yaw), 0, -cos(yaw))` (yaw 0 looks
  down −Z, matching the Three.js camera default).
- Prefer adding tuning constants at the top of the relevant system file.
