import type { TacticSuit } from './TacticSuit';

// Supernatural "Instincts" — powers the subject slowly remembers having.
// Unlocked one by one as memory fragments are recovered.

export type InstinctId = 'vision' | 'adrenaline' | 'mindspike' | 'phase';

export interface InstinctPower {
  id: InstinctId;
  name: string;
  keyCode: string;
  keyLabel: string;
  icon: string;
  description: string;
  cooldown: number; // seconds
  duration: number; // seconds (0 = instant)
  energyCost: number;
  toggle: boolean;
  unlocked: boolean;
  cd: number; // remaining cooldown
  active: boolean;
  activeTime: number; // remaining active time
}

export class Instincts {
  powers: InstinctPower[] = [
    {
      id: 'vision',
      name: 'Predator Vision',
      keyCode: 'Digit1',
      keyLabel: '1',
      icon: '◉', // ◉
      description: 'See heat signatures through walls.',
      cooldown: 0,
      duration: 0,
      energyCost: 0,
      toggle: true,
      unlocked: false,
      cd: 0,
      active: false,
      activeTime: 0,
    },
    {
      id: 'adrenaline',
      name: 'Adrenaline Surge',
      keyCode: 'Digit2',
      keyLabel: '2',
      icon: '◈', // ◈
      description: 'Bend time. The world crawls; you do not.',
      cooldown: 18,
      duration: 6,
      energyCost: 25,
      toggle: false,
      unlocked: false,
      cd: 0,
      active: false,
      activeTime: 0,
    },
    {
      id: 'mindspike',
      name: 'Mind Spike',
      keyCode: 'Digit3',
      keyLabel: '3',
      icon: '⚡', // ⚡
      description: 'Overload a nearby mind. Stuns and disorients.',
      cooldown: 12,
      duration: 0,
      energyCost: 30,
      toggle: false,
      unlocked: false,
      cd: 0,
      active: false,
      activeTime: 0,
    },
    {
      id: 'phase',
      name: 'Phase Dash',
      keyCode: 'Digit4',
      keyLabel: '4',
      icon: '➤', // ➤
      description: 'Slip through space — a short burst of teleportation.',
      cooldown: 7,
      duration: 0,
      energyCost: 20,
      toggle: false,
      unlocked: false,
      cd: 0,
      active: false,
      activeTime: 0,
    },
  ];

  get unlockedCount(): number {
    return this.powers.filter((p) => p.unlocked).length;
  }

  byId(id: InstinctId): InstinctPower {
    return this.powers.find((p) => p.id === id)!;
  }

  // Unlock the next still-locked power. Returns it (for the story callout) or null.
  unlockNext(): InstinctPower | null {
    const next = this.powers.find((p) => !p.unlocked);
    if (next) next.unlocked = true;
    return next ?? null;
  }

  isActive(id: InstinctId): boolean {
    return this.byId(id).active;
  }

  // Attempt to activate a power. Returns the power if it actually fired this
  // call (so the Game can apply instantaneous effects), else null.
  tryActivate(id: InstinctId, suit: TacticSuit): InstinctPower | null {
    const p = this.byId(id);
    if (!p.unlocked) return null;

    if (p.toggle) {
      // Toggling off is always allowed and free.
      if (p.active) {
        p.active = false;
        return null;
      }
      p.active = true;
      return p;
    }

    if (p.cd > 0) return null;
    if (!suit.spend(p.energyCost)) return null;

    p.cd = p.cooldown;
    if (p.duration > 0) {
      p.active = true;
      p.activeTime = p.duration;
    }
    return p;
  }

  update(dt: number) {
    for (const p of this.powers) {
      if (p.cd > 0) p.cd = Math.max(0, p.cd - dt);
      if (p.active && p.duration > 0) {
        p.activeTime -= dt;
        if (p.activeTime <= 0) {
          p.activeTime = 0;
          p.active = false;
        }
      }
    }
  }
}
