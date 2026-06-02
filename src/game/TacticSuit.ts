// The Tactic Suit — inspired by the Crysis Nanosuit.
// Two switchable modes (Armor / Cloak) plus passive Speed & Power assists,
// all running off a shared energy pool.

export type SuitMode = 'armor' | 'cloak';

export class TacticSuit {
  energy = 100;
  maxEnergy = 100;
  mode: SuitMode = 'armor';

  private regenDelay = 0; // seconds until regen resumes after spending energy
  private cloakBrokenTimer = 0; // brief lockout after energy depletes during cloak

  // Tuning
  private readonly cloakDrain = 16; // per second while cloaked & moving
  private readonly cloakDrainIdle = 7; // per second while cloaked & still
  private readonly sprintDrain = 9; // per second while sprinting
  private readonly regenRate = 22; // per second
  private readonly regenRateArmor = 34; // faster regen in armor mode

  get isCloaked(): boolean {
    return this.mode === 'cloak' && this.energy > 0 && this.cloakBrokenTimer <= 0;
  }

  get isArmor(): boolean {
    return this.mode === 'armor';
  }

  setMode(mode: SuitMode) {
    if (mode === 'cloak' && this.cloakBrokenTimer > 0) return;
    this.mode = mode;
  }

  toggleCloak() {
    this.setMode(this.mode === 'cloak' ? 'armor' : 'cloak');
  }

  // Returns true if the suit could afford a one-off cost (used by powers/jumps).
  spend(amount: number): boolean {
    if (this.energy < amount) return false;
    this.energy -= amount;
    this.regenDelay = 1.1;
    return true;
  }

  update(dt: number, opts: { moving: boolean; sprinting: boolean }) {
    if (this.cloakBrokenTimer > 0) this.cloakBrokenTimer -= dt;

    let spent = false;

    if (this.mode === 'cloak' && this.cloakBrokenTimer <= 0) {
      const drain = (opts.moving ? this.cloakDrain : this.cloakDrainIdle) * dt;
      this.energy -= drain;
      spent = true;
      if (this.energy <= 0) {
        this.energy = 0;
        this.mode = 'armor';
        this.cloakBrokenTimer = 1.4; // can't re-cloak immediately
      }
    }

    if (opts.sprinting && opts.moving) {
      this.energy -= this.sprintDrain * dt;
      if (this.energy < 0) this.energy = 0;
      spent = true;
    }

    if (spent) {
      this.regenDelay = 1.0;
    } else {
      if (this.regenDelay > 0) {
        this.regenDelay -= dt;
      } else {
        const rate = this.isArmor ? this.regenRateArmor : this.regenRate;
        this.energy = Math.min(this.maxEnergy, this.energy + rate * dt);
      }
    }
  }

  // Armor mode soaks part of incoming damage using energy. Returns the damage
  // that should actually reach the player's health.
  absorbDamage(damage: number): number {
    if (this.mode !== 'armor' || this.energy <= 0) {
      // Cloak offers no protection; full damage (and cloak shatters).
      if (this.mode === 'cloak') {
        this.mode = 'armor';
        this.cloakBrokenTimer = 1.0;
      }
      return damage;
    }
    const absorbCapacity = this.energy * 0.6; // energy units -> hp soaked
    const soaked = Math.min(damage * 0.6, absorbCapacity);
    this.energy = Math.max(0, this.energy - soaked / 0.6);
    this.regenDelay = 1.5;
    return Math.max(0, damage - soaked);
  }

  // Sprint speed multiplier — the suit's "Speed" assist when energy is available.
  sprintMultiplier(): number {
    return this.energy > 5 ? 1.9 : 1.4;
  }

  // Power assist for jump height / takedowns.
  hasPower(): boolean {
    return this.energy > 12;
  }
}
