// Cinematic title screen for "Covert Operations Instincts".
// Vanilla-DOM recreation of the Claude Design prototype: intro crawl, the
// glitching/claw-ripped "Instincts" wordmark, tactical menu, Beast Mode toggle
// and the full atmosphere stack (fog, grain, scanlines, vignette, HUD).

export interface TitleCallbacks {
  onNewGame: () => void;
  onContinue: () => void;
  onOperations: () => void;
  onArmory: () => void;
  onSettings: () => void;
}

interface MenuItem {
  label: string;
  idx: string;
  action?: () => void;
  locked?: boolean;
  lockLabel?: string;
}

const INTRO_KEY = 'coi_intro';
const BEAST_KEY = 'coi_beast';

export class TitleScreen {
  root: HTMLDivElement;
  private frame!: HTMLElement;
  private intro?: HTMLElement;
  private skipBtn?: HTMLButtonElement;
  private menuNav!: HTMLElement;
  private beastToggle!: HTMLButtonElement;
  private beastState!: HTMLElement;

  private cb: TitleCallbacks;
  private beast = true;
  private introGone: boolean;
  private visible = false;
  private introTimer?: number;
  private focusIndex = 0;

  constructor(cb: TitleCallbacks) {
    this.cb = cb;
    this.introGone = readFlag(INTRO_KEY);
    this.beast = readBeast();

    this.root = document.createElement('div');
    this.root.id = 'coi-title';
    this.root.innerHTML = this.template();
    document.body.appendChild(this.root);

    this.frame = this.root.querySelector('.frame')!;
    this.intro = this.root.querySelector('.intro') ?? undefined;
    this.skipBtn = this.root.querySelector('.skip') ?? undefined;
    this.menuNav = this.root.querySelector('.menu')!;
    this.beastToggle = this.root.querySelector('.beast-toggle')!;
    this.beastState = this.beastToggle.querySelector('.state')!;

    this.applyBeast();
    this.wireMenu();
    this.beastToggle.addEventListener('click', () => this.toggleBeast());
    this.skipBtn?.addEventListener('click', () => this.finishIntro());

    if (this.introGone) {
      this.frame.classList.add('show');
    }

    window.addEventListener('keydown', this.onKey);
  }

  // ----------------------------------------------------------------- lifecycle
  show() {
    this.visible = true;
    this.root.style.display = '';
    // If the player has come back from a session, the intro never replays.
    if (this.introGone && !this.frame.classList.contains('show')) {
      this.frame.classList.add('show');
    }
    if (!this.introGone) this.startIntroTimer();
  }

  hide() {
    this.visible = false;
    this.root.style.display = 'none';
    if (this.introTimer) {
      clearTimeout(this.introTimer);
      this.introTimer = undefined;
    }
  }

  // Re-evaluate the "Continue" availability (save state can change after a run).
  refresh(hasSave: boolean) {
    const cont = this.menuNav.querySelector<HTMLButtonElement>('[data-id="continue"]');
    if (!cont) return;
    cont.classList.toggle('locked', !hasSave);
    cont.disabled = !hasSave;
    const tail = cont.querySelector('.tail');
    if (tail) tail.innerHTML = hasSave ? '<span class="arrow">▸</span>' : '<span class="lock">No Save</span>';
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  // -------------------------------------------------------------------- markup
  private template(): string {
    const crawl = !this.introGone
      ? `<div class="intro">
           <p class="crawl">
             They wiped your name and made you a weapon. The memories are coming back — and with
             them, <em>instincts no human should have.</em> Infiltrate the jungle, the labs, the black
             site. Set your traps. Take your revenge.
           </p>
         </div>
         <button class="skip">Skip &#9654;</button>`
      : '';

    return `
      <div class="stage">
        <div class="bg-base"></div>
        <div class="fog"></div>
        <div class="beast-pulse"></div>
        <div class="scan"></div>
        <div class="grain"></div>
        <div class="vignette"></div>

        ${crawl}

        <div class="frame">
          <div class="chrome-top reveal d1">
            <div class="tick"><span class="dot"></span> Black Site // Online</div>
            <div class="rule"></div>
            <div class="tick right">Operative&nbsp;<span style="color:var(--acc)">UNKNOWN</span></div>
          </div>

          <div class="center">
            <div class="eyebrow reveal d2">Covert Operations</div>
            <div class="herowrap reveal d3">
              <h1 class="hero">
                <span class="layer under" aria-hidden="true">Instincts</span>
                <span class="layer cut">Instincts</span>
                <span class="layer gr ghost" aria-hidden="true">Instincts</span>
                <span class="layer gc ghost" aria-hidden="true">Instincts</span>
                <span class="layer tear" aria-hidden="true">Instincts</span>
                <span class="layer solid" aria-hidden="true">Instincts</span>
              </h1>
              <div class="claws" aria-hidden="true">
                <span class="claw c1"></span>
                <span class="claw c2"></span>
                <span class="claw c3"></span>
              </div>
            </div>
            <div class="slogan-row reveal d3">
              <span class="slogan-bar"></span>
              <p class="slogan">Trust your <b>Instincts</b>.</p>
            </div>

            <nav class="menu reveal d4"></nav>

            <button class="beast-toggle reveal d5">
              <span class="sw"></span>
              Beast Mode
              <span class="state">${this.beast ? 'Engaged' : 'Dormant'}</span>
            </button>
          </div>

          <div class="chrome-bot reveal d5">
            <div class="hud-keys">
              <span><span class="kbd">&#8593;&#8595;</span> Navigate</span>
              <span><span class="kbd">Enter</span> Select</span>
              <span><span class="kbd">B</span> Beast</span>
              <span><span class="kbd">Esc</span> Back</span>
            </div>
            <div>v0.9.4 — Blacksite Build</div>
          </div>
        </div>
      </div>
    `;
  }

  private menuItems(): MenuItem[] {
    const hasSave = readSave();
    return [
      { label: 'New Operation', idx: '01', action: () => this.cb.onNewGame() },
      {
        label: 'Continue',
        idx: '02',
        // Handler is always wired; the disabled/locked state gates activation,
        // so a later refresh() can unlock it without re-binding.
        action: () => this.cb.onContinue(),
        locked: !hasSave,
        lockLabel: 'No Save',
      },
      { label: 'Operations', idx: '03', action: () => this.cb.onOperations() },
      { label: 'Armory', idx: '04', action: () => this.cb.onArmory() },
      { label: 'Settings', idx: '05', action: () => this.cb.onSettings() },
      { label: 'Abort', idx: '06' },
    ];
  }

  private wireMenu() {
    const items = this.menuItems();
    this.menuNav.innerHTML = items
      .map((m) => {
        const id = m.label.toLowerCase().split(' ')[0];
        const tail = m.locked
          ? `<span class="lock">${m.lockLabel}</span>`
          : `<span class="arrow">▸</span>`;
        return `<button class="mi${m.locked ? ' locked' : ''}" data-id="${id}"${m.locked ? ' disabled' : ''}>
                  <span class="idx">${m.idx}</span>${m.label}
                  <span class="tail">${tail}</span>
                </button>`;
      })
      .join('');

    const btns = Array.from(this.menuNav.querySelectorAll<HTMLButtonElement>('.mi'));
    btns.forEach((btn, i) => {
      const item = items[i];
      if (item.action) btn.addEventListener('click', item.action);
      btn.addEventListener('mouseenter', () => (this.focusIndex = i));
    });
  }

  // ------------------------------------------------------------------- beast
  private toggleBeast() {
    this.beast = !this.beast;
    writeBeast(this.beast);
    this.applyBeast();
  }

  private applyBeast() {
    document.body.classList.toggle('beast', this.beast);
    if (this.beastState) this.beastState.textContent = this.beast ? 'Engaged' : 'Dormant';
  }

  // ------------------------------------------------------------------- intro
  private startIntroTimer() {
    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => this.finishIntro(), 6600);
  }

  private finishIntro() {
    if (this.introGone) return;
    this.introGone = true;
    writeFlag(INTRO_KEY);
    this.intro?.classList.add('gone');
    this.skipBtn?.classList.add('gone');
    if (this.skipBtn) this.skipBtn.style.display = 'none';
    if (this.introTimer) {
      clearTimeout(this.introTimer);
      this.introTimer = undefined;
    }
    window.setTimeout(() => this.frame.classList.add('show'), 220);
  }

  // -------------------------------------------------------------------- input
  private onKey = (e: KeyboardEvent) => {
    if (!this.visible) return;
    if (!this.introGone) {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') this.finishIntro();
      return;
    }
    if (e.code === 'KeyB') {
      this.toggleBeast();
      return;
    }
    const btns = Array.from(this.menuNav.querySelectorAll<HTMLButtonElement>('.mi:not(.locked)'));
    if (btns.length === 0) return;

    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      const dir = e.code === 'ArrowDown' ? 1 : -1;
      this.focusIndex = (this.focusIndex + dir + btns.length) % btns.length;
      btns[this.focusIndex]?.focus();
    } else if (e.code === 'Enter') {
      e.preventDefault();
      (btns[this.focusIndex] ?? btns[0])?.click();
    }
  };
}

// --------------------------------------------------------------- persistence
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}
function readBeast(): boolean {
  try {
    const v = localStorage.getItem(BEAST_KEY);
    return v === null ? true : v === '1'; // design default: Beast Mode engaged
  } catch {
    return true;
  }
}
function writeBeast(on: boolean) {
  try {
    localStorage.setItem(BEAST_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
function readSave(): boolean {
  try {
    return (parseInt(localStorage.getItem('coi-progress') ?? '0', 10) || 0) > 0;
  } catch {
    return false;
  }
}
