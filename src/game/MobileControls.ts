import type { Input } from './Input';

// On-screen touch controls for phones & tablets (iPhone / iPad).
// - Left virtual joystick drives movement.
// - A full-screen "look" surface behind the buttons turns drags into camera look.
// - Buttons feed the same Input the keyboard does (via virtual keys / taps).
// - The HUD instinct tray is made tappable to fire powers 1–4.

export interface MobileHooks {
  onPause: () => void;
}

interface TapButton {
  el: HTMLElement;
}

export class MobileControls {
  private input: Input;
  private look: HTMLDivElement;
  private buttons: HTMLDivElement;
  private joyBase: HTMLDivElement;
  private joyKnob: HTMLDivElement;
  private lookTouchId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private joyTouchId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private joyRadius = 56;

  constructor(input: Input, hooks: MobileHooks) {
    this.input = input;

    // ---- look surface (sits above the canvas, below the HUD & buttons) ----
    this.look = document.createElement('div');
    this.look.id = 'mb-look';
    document.body.appendChild(this.look);
    this.look.addEventListener('touchstart', this.onLookStart, { passive: false });
    this.look.addEventListener('touchmove', this.onLookMove, { passive: false });
    this.look.addEventListener('touchend', this.onLookEnd);
    this.look.addEventListener('touchcancel', this.onLookEnd);

    // ---- button layer ----
    this.buttons = document.createElement('div');
    this.buttons.id = 'mb-buttons';
    document.body.appendChild(this.buttons);

    // Joystick
    this.joyBase = document.createElement('div');
    this.joyBase.id = 'mb-joy';
    this.joyKnob = document.createElement('div');
    this.joyKnob.id = 'mb-joy-knob';
    this.joyBase.appendChild(this.joyKnob);
    this.buttons.appendChild(this.joyBase);
    this.joyBase.addEventListener('touchstart', this.onJoyStart, { passive: false });
    this.joyBase.addEventListener('touchmove', this.onJoyMove, { passive: false });
    this.joyBase.addEventListener('touchend', this.onJoyEnd);
    this.joyBase.addEventListener('touchcancel', this.onJoyEnd);

    // Corner buttons
    this.tap('mb-pause', 'corner tl', '❚❚', () => hooks.onPause());
    this.tap('mb-view', 'corner tr', 'VIEW', () => this.input.tapKey('KeyV'));

    // Mode column (right, upper): cloak + held toggles
    const modes = this.group('mb-modes');
    this.tap('', 'mode', 'CLOAK', () => this.input.tapKey('KeyF'), modes);
    this.hold('', 'mode', 'SPRINT', 'ShiftLeft', modes);
    this.hold('', 'mode', 'CROUCH', 'KeyC', modes);

    // Trap row (bottom, left-centre above joystick area)
    const traps = this.group('mb-traps');
    this.tap('', 'trap', 'TRAP', () => this.input.tapKey('KeyQ'), traps);
    this.tap('', 'trap', 'SWAP', () => this.input.tapKey('KeyG'), traps);

    // Action cluster (bottom-right thumb)
    const acts = this.group('mb-actions');
    this.tap('', 'act act-melee', '✊', () => this.input.tapMouse(0), acts);
    this.tap('', 'act act-take', 'E', () => this.input.tapKey('KeyE'), acts);
    this.tap('', 'act act-jump', 'JUMP', () => this.input.tapKey('Space'), acts);

    // Make the HUD instinct tray tappable (powers 1–4).
    this.wirePowerTray();

    // Rotate-to-landscape hint (shown by CSS only in portrait while playing).
    const rot = document.createElement('div');
    rot.id = 'mb-rotate';
    rot.innerHTML = `<div class="rot-icon">▭</div><div>Rotate your device<br>Landscape recommended</div>`;
    document.body.appendChild(rot);

    this.hide();
  }

  // ---- element builders ----
  private group(id: string): HTMLDivElement {
    const g = document.createElement('div');
    g.id = id;
    g.className = 'mb-group';
    this.buttons.appendChild(g);
    return g;
  }

  private tap(id: string, cls: string, label: string, action: () => void, parent?: HTMLElement): TapButton {
    const el = document.createElement('button');
    if (id) el.id = id;
    el.className = 'mb-btn ' + cls;
    el.innerHTML = `<span>${label}</span>`;
    (parent ?? this.buttons).appendChild(el);
    const down = (e: Event) => {
      e.preventDefault();
      el.classList.add('down');
      action();
    };
    const up = () => el.classList.remove('down');
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return { el };
  }

  private hold(id: string, cls: string, label: string, code: string, parent?: HTMLElement): TapButton {
    const el = document.createElement('button');
    if (id) el.id = id;
    el.className = 'mb-btn ' + cls;
    el.innerHTML = `<span>${label}</span>`;
    (parent ?? this.buttons).appendChild(el);
    // Tap to toggle the held state (so a thumb can hold sprint while looking).
    el.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const on = this.input.toggleHeld(code);
        el.classList.toggle('on', on);
      },
      { passive: false }
    );
    return { el };
  }

  private wirePowerTray() {
    const slots = document.querySelectorAll<HTMLElement>('#powers .power');
    slots.forEach((slot, i) => {
      slot.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.input.tapKey('Digit' + (i + 1));
        },
        { passive: false }
      );
    });
  }

  // ---- look drag ----
  private onLookStart = (e: TouchEvent) => {
    if (this.lookTouchId !== null) return;
    const t = e.changedTouches[0];
    this.lookTouchId = t.identifier;
    this.lookLast = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  };
  private onLookMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.lookTouchId) continue;
      this.input.touchLookDX += t.clientX - this.lookLast.x;
      this.input.touchLookDY += t.clientY - this.lookLast.y;
      this.lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }
  };
  private onLookEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.lookTouchId) this.lookTouchId = null;
    }
  };

  // ---- joystick ----
  private onJoyStart = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    this.joyTouchId = t.identifier;
    const r = this.joyBase.getBoundingClientRect();
    this.joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this.joyRadius = r.width / 2;
    this.updateJoy(t.clientX, t.clientY);
    e.preventDefault();
  };
  private onJoyMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.joyTouchId) continue;
      this.updateJoy(t.clientX, t.clientY);
      e.preventDefault();
    }
  };
  private onJoyEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.joyTouchId) continue;
      this.joyTouchId = null;
      this.input.touchMoveX = 0;
      this.input.touchMoveY = 0;
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
    }
  };
  private updateJoy(x: number, y: number) {
    let dx = x - this.joyCenter.x;
    let dy = y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    const max = this.joyRadius;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.input.touchMoveX = dx / max;
    this.input.touchMoveY = dy / max;
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // ---- lifecycle ----
  show() {
    this.look.style.display = 'block';
    this.buttons.style.display = 'block';
  }
  hide() {
    this.look.style.display = 'none';
    this.buttons.style.display = 'none';
    // Release anything held so state doesn't stick when leaving play.
    this.input.touchMoveX = 0;
    this.input.touchMoveY = 0;
    this.lookTouchId = null;
    this.joyTouchId = null;
  }
}
