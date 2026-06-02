// Centralised keyboard + mouse + pointer-lock input manager.

export class Input {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private mousePressedThisFrame = new Set<number>();

  mouseDX = 0;
  mouseDY = 0;
  mouseButtons = new Set<number>();
  pointerLocked = false;

  // Mobile virtual joystick / look deltas, fed in externally.
  touchMoveX = 0;
  touchMoveY = 0;
  touchLookDX = 0;
  touchLookDY = 0;

  private dom: HTMLElement;
  enabled = true;

  constructor(dom: HTMLElement) {
    this.dom = dom;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const code = e.code;
      if (!this.keys.has(code)) this.pressedThisFrame.add(code);
      this.keys.add(code);
      // Prevent page scroll on space / arrows while playing.
      if (this.pointerLocked && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    this.dom.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouseButtons.add(e.button);
      this.mousePressedThisFrame.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(e.button);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
    });

    // Lose all keys if window blurs (alt-tab) to avoid stuck movement.
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseButtons.clear();
    });
  }

  requestPointerLock() {
    this.dom.requestPointerLock?.();
  }

  exitPointerLock() {
    document.exitPointerLock?.();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  mouseWasPressed(button: number): boolean {
    return this.mousePressedThisFrame.has(button);
  }

  isMouseDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  // Consume per-frame state. Call at the end of each frame.
  endFrame() {
    this.pressedThisFrame.clear();
    this.mousePressedThisFrame.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.touchLookDX = 0;
    this.touchLookDY = 0;
  }
}
