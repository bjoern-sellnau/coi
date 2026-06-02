import type { LevelDefinition } from './Level';

// ----------------------------------------------------------------------------
// LEVEL 1 — JUNGLE: "Site Echo"
// You wake in the jungle outside the facility that made you. Get out.
// ----------------------------------------------------------------------------
const jungle: LevelDefinition = {
  config: {
    id: 'jungle',
    name: 'Site Echo',
    tag: 'Jungle',
    brief: 'Escape the research perimeter under the jungle canopy. Stay unseen.',
    sky: 0x0a1f17,
    fog: { color: 0x0c2a1d, near: 12, far: 78 },
    ground: 0x1c3a22,
    ground2: 0x14301c,
    ambient: 0.45,
    sun: { color: 0xbfe6a0, intensity: 0.7, pos: [40, 50, 20] },
    hemi: 0.5,
    spawn: { pos: [-52, 48], yaw: Math.PI * 1.15 },
    extraction: [50, -48],
    objectiveText: 'Reach the extraction point at the far ridge. Recover any memory fragments you find.',
    intro: [
      'Rain. Mud. A taste of copper. You are awake — though you do not remember falling asleep.',
      'A voice, not your own, hums at the back of your skull: run.',
    ],
  },
  construct: (b) => {
    // Dense scattered jungle.
    const rng = mulberry(1337);
    for (let i = 0; i < 90; i++) {
      const x = (rng() - 0.5) * 130;
      const z = (rng() - 0.5) * 130;
      if (Math.hypot(x + 52, z - 48) < 8) continue; // keep spawn clear
      if (Math.hypot(x - 50, z + 48) < 8) continue; // keep extraction clear
      if (rng() > 0.55) b.tree(x, z, 0.8 + rng() * 0.9);
      else b.bush(x, z, 0.8 + rng() * 0.8);
    }

    // Ruined outpost structures.
    b.wall(-20, -10, -20, 8, 4, 0x3a4034);
    b.wall(-20, 8, -2, 8, 4, 0x3a4034);
    b.wall(-2, 8, -2, -2, 4, 0x3a4034);
    b.crate(-12, 0, 1.2);
    b.crate(-10.6, 0.2, 1.0);
    b.crate(-12.5, -1.4, 1.1);

    // Supply huts.
    b.box(14, 10, 6, 6, 3.2, 0x2e3a2c);
    b.box(22, -16, 7, 5, 3.4, 0x2e3a2c);

    // Watchtower (just a tall blocker).
    b.box(4, -30, 3, 3, 7, 0x2a2a26);
    b.box(4, -30, 5, 5, 0.4, 0x33352c, 7);

    // A river-bed of crates / cover toward extraction.
    b.crate(34, -34, 1.2);
    b.crate(36, -38, 1.2);
    b.crate(40, -42, 1.2);
    b.box(46, -46, 5, 5, 3, 0x2e3a2c); // guard shack at extraction
  },
  enemies: [
    { pos: [-10, 0], patrol: [[-10, 0], [10, 4], [12, -10], [-6, -8]] },
    { pos: [18, -14], patrol: [[18, -14], [24, -18], [30, -8], [16, -4]] },
    { pos: [4, -28], facing: Math.PI, patrol: [[4, -28], [4, -20], [-6, -24]] },
    { pos: [40, -40], patrol: [[40, -40], [46, -46], [38, -50]] },
    { pos: [0, 20], patrol: [[0, 20], [-14, 14], [10, 18]] },
  ],
  memories: [
    { pos: [-12, 0], text: '"Subject E-7 shows... unprecedented neural plasticity." Whose voice is that? Yours? Theirs?' },
    { pos: [4, -22], text: 'A flash: a steel table, restraints, a cold blue light. They called you an asset. You had a name once.' },
  ],
};

// ----------------------------------------------------------------------------
// LEVEL 2 — LAB: "Subject Wing"
// Inside the facility. Sterile corridors, containment cells. The memories sharpen.
// ----------------------------------------------------------------------------
const lab: LevelDefinition = {
  config: {
    id: 'lab',
    name: 'Subject Wing',
    tag: 'Laboratory',
    brief: 'Infiltrate the lab that made you. Cut the power to the containment grid and get out.',
    sky: 0x05080c,
    fog: { color: 0x070a10, near: 16, far: 60 },
    ground: 0x20242b,
    ground2: 0x2c313a,
    ambient: 0.55,
    sun: { color: 0x8fa8c8, intensity: 0.25, pos: [10, 40, -10] },
    hemi: 0.3,
    spawn: { pos: [-50, 0], yaw: Math.PI / 2 },
    extraction: [48, 2],
    objectiveText: 'Move through the Subject Wing to the extraction stairwell. Avoid the guards and cameras of your old keepers.',
    intro: [
      'You know this place. The smell of antiseptic. The hum of the containment field.',
      'Every door is a memory. Every memory is a reason.',
    ],
  },
  construct: (b) => {
    const wallC = 0xd8dde6;
    const floorGlow = 0x1b6a78;

    // Long central corridor with branching rooms.
    // Outer shell of the wing.
    b.wall(-58, -16, 58, -16, 5, wallC, 0.5);
    b.wall(-58, 16, 58, 16, 5, wallC, 0.5);

    // Corridor guide lights.
    for (let x = -50; x <= 50; x += 10) {
      b.light(x, 4.2, 0, 0xbfe9ff, 0.5, 16);
      b.glowStrip(x, 0, 1.2, 5, floorGlow);
    }

    // Room dividers creating a stealth maze.
    const seg = (x1: number, z1: number, x2: number, z2: number) => b.wall(x1, z1, x2, z2, 4.2, wallC, 0.5);
    seg(-36, -16, -36, -4);
    seg(-36, 16, -36, 6);
    seg(-18, -16, -18, 2);
    seg(-2, 16, -2, 0);
    seg(14, -16, 14, -2);
    seg(30, 16, 30, 4);
    seg(30, -16, 30, -6);

    // Lab tables / equipment (low cover).
    const table = (x: number, z: number) => b.box(x, z, 2.4, 1, 1, 0x3a4654, 0, { metalness: 0.4, roughness: 0.4 });
    table(-44, 8);
    table(-26, -9);
    table(-26, 9);
    table(-8, -8);
    table(8, 9);
    table(22, -9);
    table(40, 9);

    // Containment pods (glowing, full-height blockers).
    const pod = (x: number, z: number) =>
      b.box(x, z, 1.6, 1.6, 3.6, 0x123640, 0, { emissive: 0x2bd6e0, metalness: 0.6, roughness: 0.2 });
    pod(-30, 11);
    pod(-12, 11);
    pod(6, -11);
    pod(24, 11);
    pod(42, -11);

    // Server / power core near the middle (story beat).
    b.box(0, -11, 3, 3, 4, 0x14202a, 0, { emissive: 0x38e0c4, metalness: 0.7 });
  },
  enemies: [
    { pos: [-30, 0], patrol: [[-30, 0], [-30, 12], [-18, 12], [-18, -12]], facing: 0 },
    { pos: [-6, 6], patrol: [[-6, 6], [-6, -12], [10, -12], [10, 6]] },
    { pos: [18, 0], patrol: [[18, 0], [28, 0], [28, 12], [16, 12]] },
    { pos: [40, -6], patrol: [[40, -6], [44, -12], [34, -12], [44, 8]] },
    { pos: [-44, -8], facing: Math.PI / 2, patrol: [[-44, -8], [-44, 10], [-34, 10]] },
    { pos: [10, 12], patrol: [[10, 12], [-2, 12], [-2, -8]] },
  ],
  memories: [
    { pos: [-44, 8], text: 'The power core hums. A memory cracks open: you watched them do this to others. None of them walked out.' },
    { pos: [0, -8], text: 'A name surfaces like a body in water — yours. And beside it, the name of the man who signed the order.' },
    { pos: [42, 9], text: 'You feel time itself flex around you. You did this before, on the table, when they thought you were sedated.' },
  ],
};

// ----------------------------------------------------------------------------
// LEVEL 3 — BLACK SITE: "Omega"
// The director's compound. End of the line. Take what you came for.
// ----------------------------------------------------------------------------
const blacksite: LevelDefinition = {
  config: {
    id: 'blacksite',
    name: 'Black Site Omega',
    tag: 'Compound',
    brief: 'Breach the director\'s compound. Reach his bunker. Finish it.',
    sky: 0x0b0c12,
    fog: { color: 0x0a0b11, near: 18, far: 85 },
    ground: 0x26262c,
    ground2: 0x3a3a44,
    ambient: 0.4,
    sun: { color: 0xc9d4ff, intensity: 0.4, pos: [-30, 45, -25] },
    hemi: 0.35,
    spawn: { pos: [-54, -50], yaw: Math.PI * 0.25 },
    extraction: [50, 52],
    objectiveText: 'Cross the compound to the director\'s bunker. They know what you can do now — so do you.',
    intro: [
      'You remember everything now. The face. The signature. The word "terminate" in a tidy font.',
      'The suit answers your thoughts like an old friend. Tonight, you collect.',
    ],
  },
  construct: (b) => {
    const concrete = 0x44464e;
    const metal = 0x33353d;

    // Perimeter buildings forming a courtyard.
    b.box(-30, -30, 14, 10, 5, concrete);
    b.box(10, -34, 12, 8, 5, concrete);
    b.box(34, -20, 10, 14, 6, concrete);
    b.box(-34, 6, 10, 16, 5, concrete);
    b.box(0, 8, 16, 8, 4.5, concrete);
    b.box(30, 24, 14, 10, 6, concrete);

    // Shipping containers (cover lanes).
    const container = (x: number, z: number, rot = false, color = 0x5a4a2e) => {
      if (rot) b.box(x, z, 2.6, 6.2, 2.6, color, 0, { metalness: 0.3, roughness: 0.6 });
      else b.box(x, z, 6.2, 2.6, 2.6, color, 0, { metalness: 0.3, roughness: 0.6 });
    };
    container(-10, -8, false, 0x6a2e2e);
    container(-2, 0, true, 0x2e5a6a);
    container(12, -6, false, 0x5a4a2e);
    container(8, 12, true, 0x3a5a2e);
    container(-18, 18, false, 0x4a4a5a);
    container(22, 6, false, 0x6a2e2e);
    container(40, 38, true, 0x2e5a6a);

    // Floodlit walls splitting the courtyard.
    b.wall(-20, 30, 18, 30, 5, metal, 0.6);
    b.wall(-46, -10, -46, 30, 5, metal, 0.6);

    // The bunker entrance at extraction.
    b.box(48, 46, 12, 10, 5, 0x1a1c22, 0, { metalness: 0.5 });
    b.box(48, 40, 6, 1, 3.5, 0x0e0f14, 0, { emissive: 0xff3b4e }); // ominous door

    // Floodlights.
    b.light(0, 8, 0, 0xfff2cc, 0.8, 40);
    b.light(-30, 7, -10, 0xfff2cc, 0.7, 30);
    b.light(30, 8, 20, 0xfff2cc, 0.7, 30);
  },
  enemies: [
    { pos: [-30, -18], patrol: [[-30, -18], [-14, -18], [-14, -2], [-34, -2]] },
    { pos: [4, -20], patrol: [[4, -20], [18, -20], [18, -4], [2, -4]] },
    { pos: [-8, 14], patrol: [[-8, 14], [-24, 22], [-8, 24]] },
    { pos: [20, 14], patrol: [[20, 14], [34, 14], [34, 30], [18, 26]] },
    { pos: [40, 30], facing: Math.PI, patrol: [[40, 30], [44, 44], [34, 44]] },
    { pos: [-44, 20], patrol: [[-44, 20], [-44, 0], [-30, 10]] },
    { pos: [12, 2], patrol: [[12, 2], [24, 6], [12, 12]] },
  ],
  memories: [
    { pos: [-30, -30], text: '"If E-7 ever regains continuity of self, terminate." His handwriting. You memorize the loops of it.' },
    { pos: [0, 8], text: 'You see the others now — the ones who did not survive the chair. You carry them. You will spend them carefully.' },
    { pos: [30, 24], text: 'The last lock in your mind opens. Space folds when you ask it to. He has nowhere left to put a wall.' },
  ],
};

export const LEVELS: LevelDefinition[] = [jungle, lab, blacksite];

// Tiny seeded PRNG so jungle scatter is deterministic across reloads.
function mulberry(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
