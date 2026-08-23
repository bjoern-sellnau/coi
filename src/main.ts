import './styles.css';
import './ui/title.css';
import { Game, IS_TOUCH, type GameState } from './game/Game';
import { LEVELS } from './game/levels';
import { TitleScreen } from './ui/TitleScreen';
import { MobileControls } from './game/MobileControls';

const PROGRESS_KEY = 'coi-progress';

function loadProgress(): number {
  const v = parseInt(localStorage.getItem(PROGRESS_KEY) ?? '0', 10);
  return isNaN(v) ? 0 : v;
}
function saveProgress(idx: number) {
  const cur = loadProgress();
  if (idx > cur) localStorage.setItem(PROGRESS_KEY, String(idx));
}

const app = document.getElementById('app')!;
const game = new Game(app);

// On-screen controls for touch devices (iPhone / iPad).
let mobile: MobileControls | undefined;
if (IS_TOUCH) {
  document.body.classList.add('touch');
  mobile = new MobileControls(game.input, { onPause: () => game.pause() });
}

// ---- Secondary overlay layer (mission select / controls / pause / end cards) -
const overlay = document.createElement('div');
overlay.className = 'overlay hidden';
document.body.appendChild(overlay);

function clearOverlay() {
  overlay.innerHTML = '';
  overlay.classList.remove('hidden');
}
function hideOverlay() {
  overlay.classList.add('hidden');
}
function button(label: string, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn' + (primary ? ' primary' : '');
  b.textContent = label;
  return b;
}

// ---- Cinematic title screen --------------------------------------------------
const title = new TitleScreen({
  onNewGame: () => game.startLevel(0),
  onContinue: () => game.startLevel(loadProgress()),
  onOperations: () => openSubScreen(missionSelectScreen),
  onArmory: () => openSubScreen(controlsScreen),
  onSettings: () => openSubScreen(settingsScreen),
});
title.hide();

function showTitle() {
  hideOverlay();
  title.refresh(loadProgress() > 0);
  title.show();
}

// Open a menu sub-screen (built into the shared overlay), hiding the title.
function openSubScreen(render: () => void) {
  title.hide();
  render();
}

// ---- Sub-screens -------------------------------------------------------------
function missionSelectScreen() {
  clearOverlay();
  const unlocked = loadProgress();

  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '40px';
  h.innerHTML = '<span class="t-co">Operations</span>';
  overlay.appendChild(h);

  const grid = document.createElement('div');
  grid.className = 'levels';
  LEVELS.forEach((lvl, i) => {
    const card = document.createElement('div');
    const locked = i > unlocked;
    card.className = 'level-card' + (locked ? ' locked' : '');
    card.innerHTML = `
      <div class="lc-tag">${lvl.config.tag}${locked ? ' · Locked' : ''}</div>
      <h3>${lvl.config.name}</h3>
      <p>${lvl.config.brief}</p>
    `;
    if (!locked) card.onclick = () => game.startLevel(i);
    grid.appendChild(card);
  });
  overlay.appendChild(grid);

  const back = button('Back');
  back.style.marginTop = '24px';
  back.onclick = showTitle;
  overlay.appendChild(back);
}

function controlsScreen() {
  clearOverlay();
  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '40px';
  h.innerHTML = '<span class="t-co">Armory &amp; Field Manual</span>';
  overlay.appendChild(h);

  const rows: [string, string][] = [
    ['W A S D / Arrows', 'Move'],
    ['Mouse', 'Look / Aim'],
    ['Shift', 'Sprint (Suit Speed)'],
    ['Ctrl / C', 'Crouch (quieter, harder to spot)'],
    ['Space', 'Jump (Suit Power = higher)'],
    ['F', 'Toggle Cloak (Tactic Suit)'],
    ['V', 'Toggle First / Third person'],
    ['E', 'Silent takedown (from behind, unseen)'],
    ['Left Click', 'Melee strike'],
    ['Q', 'Place trap'],
    ['G', 'Swap trap type (Mine / Snare / EMP)'],
    ['1 2 3 4', 'Instinct powers (unlocked via memories)'],
    ['Esc', 'Pause'],
  ];
  const grid = document.createElement('div');
  grid.className = 'controls-grid';
  for (const [k, d] of rows) {
    const kd = document.createElement('kbd');
    kd.textContent = k;
    const dv = document.createElement('div');
    dv.textContent = d;
    grid.appendChild(kd);
    grid.appendChild(dv);
  }
  overlay.appendChild(grid);

  const tip = document.createElement('p');
  tip.className = 'tagline';
  tip.style.marginTop = '20px';
  tip.innerHTML = `
    <b>Tactic Suit:</b> Armor soaks damage; Cloak hides you but drains energy.
    Energy also powers sprint, big jumps and your instincts.<br>
    <b>Instincts</b> (recover memory fragments to unlock):
    ◉ Predator Vision · ◈ Adrenaline Surge · ⚡ Mind Spike · ➤ Phase Dash.
  `;
  overlay.appendChild(tip);

  const back = button('Back');
  back.style.marginTop = '8px';
  back.onclick = showTitle;
  overlay.appendChild(back);
}

function settingsScreen() {
  clearOverlay();
  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '40px';
  h.innerHTML = '<span class="t-co">Settings</span>';
  overlay.appendChild(h);

  const btns = document.createElement('div');
  btns.className = 'menu-btns';

  const audio = button(game.audio.enabled ? 'Sound: On' : 'Sound: Off');
  audio.onclick = () => {
    game.audio.enabled = !game.audio.enabled;
    audio.textContent = game.audio.enabled ? 'Sound: On' : 'Sound: Off';
  };

  const replay = button('Replay Intro');
  replay.onclick = () => {
    try {
      localStorage.removeItem('coi_intro');
    } catch {
      /* ignore */
    }
    location.reload();
  };

  const reset = button('Reset Campaign Progress');
  reset.onclick = () => {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      /* ignore */
    }
    reset.textContent = 'Progress Cleared';
  };

  const back = button('Back', true);
  back.onclick = showTitle;

  btns.append(audio, replay, reset, back);
  overlay.appendChild(btns);
}

function pauseScreen() {
  clearOverlay();
  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '46px';
  h.innerHTML = '<span class="t-co">Paused</span>';
  overlay.appendChild(h);

  const btns = document.createElement('div');
  btns.className = 'menu-btns';
  const resume = button('Resume', true);
  resume.onclick = () => game.resume();
  const restart = button('Restart Mission');
  restart.onclick = () => game.restartLevel();
  const menu = button('Main Menu');
  menu.onclick = () => game.returnToMenu();
  btns.append(resume, restart, menu);
  overlay.appendChild(btns);
}

function deathScreen() {
  clearOverlay();
  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '52px';
  h.innerHTML = '<span style="color:#ff3b4e;text-shadow:0 0 30px #ff3b4e">Terminated</span>';
  overlay.appendChild(h);
  const p = document.createElement('p');
  p.className = 'tagline';
  p.textContent = 'The asset is down. But the asset does not stay down.';
  overlay.appendChild(p);

  const btns = document.createElement('div');
  btns.className = 'menu-btns';
  const retry = button('Retry Mission', true);
  retry.onclick = () => game.restartLevel();
  const menu = button('Main Menu');
  menu.onclick = () => game.returnToMenu();
  btns.append(retry, menu);
  overlay.appendChild(btns);
}

function completeScreen(levelIndex: number) {
  saveProgress(levelIndex + 1);
  clearOverlay();
  const last = levelIndex + 1 >= LEVELS.length;

  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '44px';
  h.innerHTML = '<span class="t-co" style="color:#38e0c4">Extraction Successful</span>';
  overlay.appendChild(h);

  const p = document.createElement('p');
  p.className = 'tagline';
  p.textContent = `${LEVELS[levelIndex].config.name} cleared. The memories are sharper now. So is the rage.`;
  overlay.appendChild(p);

  const btns = document.createElement('div');
  btns.className = 'menu-btns';
  if (!last) {
    const next = button('Next Mission', true);
    next.onclick = () => game.nextLevel();
    btns.appendChild(next);
  } else {
    const fin = button('Finish', true);
    fin.onclick = () => game.nextLevel();
    btns.appendChild(fin);
  }
  const menu = button('Main Menu');
  menu.onclick = () => game.returnToMenu();
  btns.appendChild(menu);
  overlay.appendChild(btns);
}

function victoryScreen() {
  saveProgress(LEVELS.length);
  clearOverlay();
  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '50px';
  h.innerHTML = '<span class="t-co">Operation</span><span class="t-inst">Complete</span>';
  overlay.appendChild(h);
  const p = document.createElement('p');
  p.className = 'tagline';
  p.innerHTML = `
    The director's bunker is quiet now. You remember all of it — every name, every
    face, every door. The suit powers down; the instincts stay. You were their
    experiment. Now you are their reckoning.<br><br>
    <i>Thank you for playing Covert Operations: Instincts.</i>
  `;
  overlay.appendChild(p);
  const menu = button('Return to Menu', true);
  menu.onclick = () => game.returnToMenu();
  overlay.appendChild(menu);
}

// ---- Wire game state -> UI ---------------------------------------------------
game.onStateChange = (state: GameState, info) => {
  if (state !== 'menu') title.hide();
  // Mobile controls & the rotate hint are only live during play.
  if (state === 'playing') {
    mobile?.show();
    document.body.classList.add('playing');
  } else {
    mobile?.hide();
    document.body.classList.remove('playing');
  }
  switch (state) {
    case 'menu':
      showTitle();
      break;
    case 'playing':
      hideOverlay();
      break;
    case 'paused':
      pauseScreen();
      break;
    case 'dead':
      deathScreen();
      break;
    case 'complete':
      completeScreen(info?.levelIndex ?? game.levelIndex);
      break;
    case 'victory':
      victoryScreen();
      break;
  }
};

// Boot to the cinematic title.
showTitle();

// Dev-only debug handle (stripped from production builds).
if (import.meta.env.DEV) (window as unknown as { __coiGame: Game }).__coiGame = game;
