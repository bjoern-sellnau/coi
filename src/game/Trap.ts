import * as THREE from 'three';
import type { Enemy } from './Enemy';

export type TrapType = 'mine' | 'snare' | 'emp';

export const TRAP_INFO: Record<TrapType, { name: string; color: number; radius: number; icon: string }> = {
  mine: { name: 'Frag Mine', color: 0xff5a2e, radius: 2.4, icon: '✷' },
  snare: { name: 'Snare', color: 0x9be23a, radius: 1.8, icon: '✕' },
  emp: { name: 'EMP Charge', color: 0x38b6ff, radius: 3.0, icon: '◌' },
};

export class Trap {
  type: TrapType;
  pos: THREE.Vector3;
  radius: number;
  armed = true;
  triggered = false;
  mesh: THREE.Group;
  private light: THREE.Mesh;
  private lightMat: THREE.MeshStandardMaterial;
  private blink = 0;
  private fxTime = 0;
  private fx?: THREE.Mesh;

  constructor(type: TrapType, pos: THREE.Vector3) {
    this.type = type;
    this.pos = pos.clone();
    this.radius = TRAP_INFO[type].radius;
    const color = TRAP_INFO[type].color;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.pos);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.6, metalness: 0.5 })
    );
    base.position.y = 0.05;
    base.castShadow = true;
    this.mesh.add(base);

    this.lightMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 });
    this.light = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), this.lightMat);
    this.light.position.y = 0.12;
    this.mesh.add(this.light);

    // Faint radius ring so the player can see the trigger area.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(this.radius - 0.06, this.radius, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.mesh.add(ring);
  }

  update(dt: number, enemies: Enemy[]) {
    if (this.triggered) {
      this.fxTime -= dt;
      if (this.fx) {
        const t = 1 - this.fxTime / 0.5;
        this.fx.scale.setScalar(0.4 + t * this.radius * 1.4);
        (this.fx.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - t));
      }
      return;
    }

    this.blink += dt;
    this.lightMat.emissiveIntensity = 0.7 + Math.sin(this.blink * 6) * 0.5;

    if (!this.armed) return;
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.pos.distanceTo(this.pos) <= this.radius) {
        this.trigger(enemies);
        break;
      }
    }
  }

  private trigger(enemies: Enemy[]) {
    this.triggered = true;
    this.armed = false;
    this.fxTime = 0.5;

    for (const e of enemies) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d > this.radius) continue;
      if (this.type === 'mine') {
        e.damage(120); // lethal
      } else if (this.type === 'snare') {
        e.stun(6);
      } else if (this.type === 'emp') {
        e.stun(4.5);
      }
    }

    // Visual burst.
    const color = TRAP_INFO[this.type].color;
    this.fx = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false })
    );
    this.fx.position.y = 0.4;
    this.mesh.add(this.fx);
    this.lightMat.emissiveIntensity = 0;
    this.light.visible = false;
  }

  get finished(): boolean {
    return this.triggered && this.fxTime <= 0;
  }
}
