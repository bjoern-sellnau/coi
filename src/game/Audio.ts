// Minimal procedural sound effects via the Web Audio API (no asset files needed).
export class AudioManager {
  private ctx?: AudioContext;
  enabled = true;

  private ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        this.enabled = false;
      }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain = 0.15, slideTo?: number) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  resumeFromGesture() {
    this.ensure();
  }

  shoot() {
    this.blip(220, 0.12, 'square', 0.06, 90);
  }
  pickup() {
    this.blip(520, 0.12, 'sine', 0.12, 880);
    setTimeout(() => this.blip(880, 0.18, 'sine', 0.1, 1320), 90);
  }
  power() {
    this.blip(180, 0.3, 'sawtooth', 0.12, 720);
  }
  trap() {
    this.blip(140, 0.18, 'square', 0.1, 60);
  }
  explosion() {
    this.blip(90, 0.4, 'sawtooth', 0.18, 30);
  }
  alarm() {
    this.blip(660, 0.25, 'square', 0.12);
    setTimeout(() => this.blip(440, 0.3, 'square', 0.12), 220);
  }
  hurt() {
    this.blip(160, 0.2, 'triangle', 0.14, 80);
  }
  takedown() {
    this.blip(300, 0.1, 'square', 0.1, 120);
  }
  cloak() {
    this.blip(400, 0.25, 'sine', 0.08, 120);
  }
}
