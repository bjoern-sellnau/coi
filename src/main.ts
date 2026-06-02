import './styles.css';
import { Game, type GameState } from './game/Game';
import { LEVELS } from './game/levels';

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

// ---- Overlay layer -----------------------------------------------------------
const overlay = document.createElement('div');
overlay.className = 'overlay';
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

// ---- Screens -----------------------------------------------------------------
function titleScreen() {
  clearOverlay();
  const unlocked = loadProgress();

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="title">
      <span class="t-co">Covert Operations</span>
      <span class="t-inst">Instincts</span>
    </div>
    <p class="tagline">
      They wiped your name and made you a weapon. The memories are coming back —
      and with them, instincts no human should have. Infiltrate the jungle, the
      labs, the black site. Set your traps. Take your revenge.
    </p>
  `;
  overlay.appendChild(wrap);

  const btns = document.createElement('div');
  btns.className = 'menu-btns';

  const begin = button(unlocked > 0 ? 'Continue Operation' : 'Begin Operation', true);
  begin.onclick = () => game.startLevel(unlocked);
  btns.appendChild(begin);

  const select = button('Mission Select');
  select.onclick = missionSelectScreen;
  btns.appendChild(select);

  const help = button('How to Play');
  help.onclick = controlsScreen;
  btns.appendChild(help);

  overlay.appendChild(btns);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Best played on desktop with mouse + keyboard. Click "Begin" to lock the mouse; press Esc to pause.';
  overlay.appendChild(hint);
}

function missionSelectScreen() {
  clearOverlay();
  const unlocked = loadProgress();

  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '40px';
  h.innerHTML = '<span class="t-co">Mission Select</span>';
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
  back.onclick = titleScreen;
  overlay.appendChild(back);
}

function controlsScreen() {
  clearOverlay();
  const h = document.createElement('div');
  h.className = 'title';
  h.style.fontSize = '40px';
  h.innerHTML = '<span class="t-co">How to Play</span>';
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
  back.onclick = titleScreen;
  overlay.appendChild(back);
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
  const select = button('Mission Select');
  select.onclick = () => game.returnToMenu();
  const menu = button('Main Menu');
  menu.onclick = () => game.returnToMenu();
  btns.append(resume, restart, select, menu);
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
    fin.onclick = () => game.nextLevel(); // triggers victory
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
  menu.onclick = titleScreen;
  overlay.appendChild(menu);
}

// ---- Wire game state -> overlay ----------------------------------------------
game.onStateChange = (state: GameState, info) => {
  switch (state) {
    case 'menu':
      titleScreen();
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

// Boot to title.
titleScreen();
