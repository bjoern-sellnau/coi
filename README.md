# Covert Operations: Instincts

A browser-based **3D first-person stealth game** (with an optional third-person
view) built with **Three.js + TypeScript + Vite**.

You were a lab subject — a test "rat" they experimented on and then wiped. Now
you're awake, free, and remembering. Piece by piece your memories return, and
with them **instincts** no human should have. Infiltrate the jungle perimeter,
the labs that made you, and the director's black site. Stay in the shadows, set
traps, and take your revenge.

> The name says it: **Covert Operations** for the stealth infiltration,
> **Instincts** for the supernatural powers you rediscover along the way.

## Features

- **First- & third-person view** — toggle any time with `V`.
- **Stealth AI** — guards with vision cones, hearing, and alert states
  (patrol → suspicious → search → combat). A global alarm ramps up their
  awareness once you're spotted.
- **Tactic Suit** (inspired by the Crysis Nanosuit) running on one energy pool:
  - **Armor** — soaks incoming damage.
  - **Cloak** — near-invisibility (drains energy).
  - **Speed** — sprint assist.
  - **Power** — higher jumps and stronger strikes.
- **Instincts** — supernatural powers unlocked by recovering memory fragments:
  - ◉ **Predator Vision** — see enemies through walls.
  - ◈ **Adrenaline Surge** — bullet-time.
  - ⚡ **Mind Spike** — stun an enemy with your mind.
  - ➤ **Phase Dash** — short-range teleport.
- **Traps** — place **Mines**, **Snares**, and **EMP charges**; swap with `G`.
- **Silent takedowns** from behind, plus a melee strike.
- **Three settings**: a jungle research site, a sterile laboratory wing, and a
  black-site compound, each with its own story beats.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / Arrows | Move |
| Mouse | Look / aim |
| `Shift` | Sprint |
| `Ctrl` / `C` | Crouch |
| `Space` | Jump |
| `F` | Toggle Cloak |
| `V` | Toggle first / third person |
| `E` | Silent takedown (from behind, unseen) |
| Left click | Melee strike |
| `Q` | Place trap |
| `G` | Swap trap type |
| `1` `2` `3` `4` | Instinct powers |
| `Esc` | Pause |

Best played on desktop with mouse + keyboard.

### Touch (iPhone / iPad)

On phones and tablets the game shows on-screen controls automatically:

- **Left joystick** — move.
- **Drag anywhere else** — look / aim.
- **JUMP · ✊ melee · E** takedown/interact (bottom-right thumb cluster).
- **CLOAK · SPRINT · CROUCH** (right column; sprint & crouch are hold-toggles).
- **TRAP · SWAP** (near the joystick), **VIEW** (top-right) toggles first/third
  person, **❚❚** (top-left) pauses.
- Tap the **instinct icons** (bottom-centre) to fire unlocked powers.

Landscape orientation is recommended; a hint appears in portrait.

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run build      # production build into dist/
npm run preview    # preview the production build
```

## Deployment (GitHub Pages)

Pushing to the configured branch triggers
`.github/workflows/deploy.yml`, which builds with the correct base path
(`--base=/coi/`) and force-pushes `dist/` to the `gh-pages` branch.

In the repository settings, set **Pages → Source → Deploy from a branch →
`gh-pages` / root**. The game will then be live at:

```
https://bjoern-sellnau.github.io/coi/
```

## Project structure

```
src/
  main.ts            Bootstrap + menus / overlays (title, mission select, pause…)
  styles.css         HUD + menu styling
  game/
    Game.ts          Engine: scene, loop, level flow, glue between systems
    Player.ts        Movement, FP/TP camera, suit & instinct usage, visibility
    TacticSuit.ts    Energy, Armor/Cloak modes, Speed/Power assists
    Instincts.ts     Supernatural powers + progressive unlocks
    Enemy.ts         Guard AI: vision cone, hearing, state machine, combat
    Trap.ts          Mine / Snare / EMP traps
    Level.ts         Level builder, geometry helpers, memory pickups
    levels.ts        The three hand-built missions
    HUD.ts           DOM heads-up display
    Input.ts         Keyboard / mouse / pointer-lock input
    Audio.ts         Procedural Web Audio sound effects
    physics.ts       Collision (circle-vs-AABB) and line-of-sight helpers
```
