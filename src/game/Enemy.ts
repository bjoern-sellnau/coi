import * as THREE from 'three';
import { resolveCircleVsBoxes, hasLineOfSight, clamp, damp, type BoxCollider } from './physics';
import type { Player } from './Player';

export type EnemyState = 'patrol' | 'suspicious' | 'alert' | 'search' | 'stunned' | 'dead';

export interface EnemyContext {
  player: Player;
  colliders: BoxCollider[];
  dt: number;
  raiseAlarm: (pos: THREE.Vector3) => void;
  damagePlayer: (amount: number) => void;
  onShoot: (from: THREE.Vector3, to: THREE.Vector3) => void;
  globalAlarm: boolean; // someone else is alert -> heighten awareness
}

const ENEMY_RADIUS = 0.4;
const VIEW_DISTANCE = 18;
const VIEW_HALF_ANGLE = Math.PI / 4; // 45° -> 90° cone
const HEAR_RADIUS = 14;
const SHOOT_RANGE = 16;

export class Enemy {
  pos = new THREE.Vector3();
  yaw = 0;
  health = 60;
  state: EnemyState = 'patrol';
  detection = 0; // 0..1

  private waypoints: THREE.Vector3[];
  private wpIndex = 0;
  private waitTimer = 0;
  private lastKnown = new THREE.Vector3();
  private searchTimer = 0;
  private stunTimer = 0;
  private shootCd = 0;
  private lookTimer = 0;
  private lookYawTarget = 0;
  private stuckTimer = 0;
  private prevPos = new THREE.Vector3();

  mesh: THREE.Group;
  private cone: THREE.Mesh;
  private coneMat: THREE.MeshBasicMaterial;
  private bodyMats: THREE.MeshStandardMaterial[] = [];
  private eyeMat: THREE.MeshStandardMaterial;

  constructor(spawn: THREE.Vector3, waypoints: THREE.Vector3[], facing = 0) {
    this.pos.copy(spawn);
    this.yaw = facing;
    this.waypoints = waypoints.length ? waypoints : [spawn.clone()];
    this.lookYawTarget = facing;

    this.mesh = new THREE.Group();
    this.buildBody();

    // Vision cone (flat ground wedge)
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0x38e0c4,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cone = new THREE.Mesh(buildSectorGeometry(VIEW_DISTANCE, VIEW_HALF_ANGLE, 24), this.coneMat);
    this.cone.rotation.x = -Math.PI / 2;
    this.cone.position.y = 0.05;
    this.mesh.add(this.cone);

    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3b4e, emissive: 0xff3b4e, emissiveIntensity: 1 });
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.02), this.eyeMat);
    eye.position.set(0, 1.62, 0.16);
    this.mesh.add(eye);

    this.prevPos.copy(spawn);
  }

  private buildBody() {
    const armor = 0x2a2f36;
    const trim = 0x4a525c;
    const mat = (c: number) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.3 });
      this.bodyMats.push(m);
      return m;
    };
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.34), mat(armor));
    torso.position.y = 1.05;
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), mat(trim));
    pelvis.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), mat(0x1a1d22));
    head.position.y = 1.6;
    this.mesh.add(torso, pelvis, head);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), mat(armor));
      arm.position.set(side * 0.36, 1.0, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), mat(trim));
      leg.position.set(side * 0.15, 0.3, 0);
      this.mesh.add(arm, leg);
    }
    // Rifle
    const rifle = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.6 })
    );
    rifle.position.set(0.3, 1.05, 0.3);
    this.mesh.add(rifle);
    this.mesh.traverse((o) => (o.castShadow = true));
  }

  get dead(): boolean {
    return this.state === 'dead';
  }

  eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  kill() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.detection = 0;
    this.coneMat.opacity = 0;
    // Topple the body.
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y = 0.4;
    for (const m of this.bodyMats) {
      m.color.multiplyScalar(0.5);
    }
  }

  stun(duration: number) {
    if (this.state === 'dead') return;
    this.state = 'stunned';
    this.stunTimer = duration;
    this.detection = Math.min(this.detection, 0.3);
  }

  damage(amount: number, ctx?: EnemyContext) {
    if (this.state === 'dead') return;
    this.health -= amount;
    if (this.health <= 0) {
      this.kill();
    } else if (ctx) {
      // Being hurt makes them instantly alert.
      this.detection = 1;
      this.lastKnown.copy(ctx.player.pos);
    }
  }

  // Is the player currently visible to this enemy? Returns a 0..1 perception rate.
  private perceptionRate(ctx: EnemyContext): number {
    const player = ctx.player;
    const eye = this.eyePos();
    const target = player.centerPosition();
    const to = new THREE.Vector3().subVectors(target, eye);
    const dist = to.length();
    if (dist > VIEW_DISTANCE) return 0;
    to.normalize();

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const flatTo = to.clone().setY(0).normalize();
    const dot = fwd.dot(flatTo);
    const cosHalf = Math.cos(VIEW_HALF_ANGLE);
    // Close-range "peripheral" awareness in a wider arc.
    const inCone = dot > cosHalf;
    const inPeripheral = dist < 4 && dot > -0.2;
    if (!inCone && !inPeripheral) return 0;

    if (!hasLineOfSight(eye, target, ctx.colliders)) return 0;

    const vis = player.visibilityFactor();
    if (vis <= 0.001) return 0;

    const distFactor = 1 - dist / VIEW_DISTANCE; // closer = faster
    const angleFactor = inPeripheral ? 1 : clamp((dot - cosHalf) / (1 - cosHalf), 0.3, 1);
    const alertBoost = ctx.globalAlarm ? 1.6 : 1;
    return 1.5 * distFactor * angleFactor * vis * alertBoost;
  }

  private hearingRate(ctx: EnemyContext): number {
    const player = ctx.player;
    if (player.noise <= 0.01) return 0;
    const dist = this.pos.distanceTo(player.pos);
    const audible = HEAR_RADIUS * player.noise;
    if (dist > audible) return 0;
    const occluded = hasLineOfSight(this.eyePos(), player.centerPosition(), ctx.colliders) ? 1 : 0.4;
    return 0.9 * (1 - dist / audible) * player.noise * occluded;
  }

  update(ctx: EnemyContext) {
    const dt = ctx.dt;
    if (this.state === 'dead') return;

    if (this.shootCd > 0) this.shootCd -= dt;

    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      this.detection = damp(this.detection, 0.25, 2, dt);
      this.syncMesh(dt);
      if (this.stunTimer <= 0) this.state = this.detection > 0.5 ? 'alert' : 'search';
      return;
    }

    const see = this.perceptionRate(ctx);
    const hear = this.hearingRate(ctx);
    const sensed = Math.max(see, hear);

    if (sensed > 0) {
      this.detection = clamp(this.detection + sensed * dt, 0, 1);
      // Record where the stimulus came from.
      this.lastKnown.copy(see > 0 ? ctx.player.centerPosition() : ctx.player.pos);
    } else {
      const decay = this.state === 'alert' ? 0.25 : 0.4;
      this.detection = clamp(this.detection - decay * dt, 0, 1);
    }

    // ---- State machine ----
    if (this.detection >= 1) {
      if (this.state !== 'alert') ctx.raiseAlarm(this.lastKnown);
      this.state = 'alert';
    } else if (this.detection >= 0.35) {
      if (this.state === 'alert') {
        this.state = 'search';
        this.searchTimer = 6;
      } else if (this.state !== 'search') {
        this.state = 'suspicious';
      }
    } else if (this.detection < 0.05) {
      this.state = 'patrol';
    }

    switch (this.state) {
      case 'patrol':
        this.doPatrol(ctx);
        break;
      case 'suspicious':
        this.doInvestigate(ctx, 2.2);
        break;
      case 'search':
        this.doSearch(ctx);
        break;
      case 'alert':
        this.doCombat(ctx, see > 0);
        break;
    }

    this.syncMesh(dt);
  }

  private moveToward(target: THREE.Vector3, speed: number, ctx: EnemyContext): boolean {
    const to = new THREE.Vector3().subVectors(target, this.pos).setY(0);
    const dist = to.length();
    if (dist < 0.4) return true;
    to.normalize();
    this.faceDir(to, ctx.dt, 10);

    const before = this.pos.clone();
    this.pos.addScaledVector(to, speed * ctx.dt);
    const resolved = resolveCircleVsBoxes(this.pos, ENEMY_RADIUS, 1.6, ctx.colliders);
    this.pos.copy(resolved);

    // Simple stuck handling: nudge sideways if barely moving.
    const moved = this.pos.distanceTo(before);
    if (moved < speed * ctx.dt * 0.3) {
      this.stuckTimer += ctx.dt;
      if (this.stuckTimer > 0.2) {
        const side = new THREE.Vector3(-to.z, 0, to.x);
        this.pos.addScaledVector(side, speed * ctx.dt * (Math.random() > 0.5 ? 1 : -1));
        this.pos.copy(resolveCircleVsBoxes(this.pos, ENEMY_RADIUS, 1.6, ctx.colliders));
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    return false;
  }

  private faceDir(dir: THREE.Vector3, dt: number, rate = 8) {
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    this.yaw = dampAngle(this.yaw, targetYaw, rate, dt);
  }

  private doPatrol(ctx: EnemyContext) {
    if (this.waitTimer > 0) {
      this.waitTimer -= ctx.dt;
      // idle look-around
      return;
    }
    const target = this.waypoints[this.wpIndex];
    if (this.moveToward(target, 1.7, ctx)) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.waitTimer = 1.2 + Math.random() * 1.5;
    }
  }

  private doInvestigate(ctx: EnemyContext, speed: number) {
    this.moveToward(this.lastKnown, speed, ctx);
  }

  private doSearch(ctx: EnemyContext) {
    this.searchTimer -= ctx.dt;
    const reached = this.moveToward(this.lastKnown, 2.4, ctx);
    if (reached) {
      // Look around the last known spot.
      this.lookTimer -= ctx.dt;
      if (this.lookTimer <= 0) {
        this.lookYawTarget = this.yaw + (Math.random() - 0.5) * Math.PI * 1.2;
        this.lookTimer = 0.8 + Math.random() * 0.6;
      }
      this.yaw = dampAngle(this.yaw, this.lookYawTarget, 5, ctx.dt);
    }
    if (this.searchTimer <= 0) {
      this.state = 'patrol';
      this.detection = 0;
    }
  }

  private doCombat(ctx: EnemyContext, canSee: boolean) {
    const player = ctx.player;
    const dist = this.pos.distanceTo(player.pos);
    if (canSee) this.lastKnown.copy(player.centerPosition());

    if (dist > SHOOT_RANGE * 0.7 || !canSee) {
      this.moveToward(this.lastKnown, 3.3, ctx);
    } else {
      // Hold position and face the player.
      const to = new THREE.Vector3().subVectors(player.pos, this.pos).setY(0).normalize();
      this.faceDir(to, ctx.dt, 14);
    }

    if (canSee && dist < SHOOT_RANGE && this.shootCd <= 0) {
      this.shootCd = 0.9 + Math.random() * 0.4;
      const from = this.eyePos();
      const to = player.centerPosition();
      ctx.onShoot(from, to);
      // Hit chance falls off with distance & player evasion.
      const hitChance = clamp(0.85 - dist / SHOOT_RANGE * 0.5, 0.2, 0.9);
      if (Math.random() < hitChance) {
        ctx.damagePlayer(8 + Math.random() * 6);
      }
    }
  }

  private syncMesh(dt: number) {
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    if (this.state !== 'dead') this.mesh.rotation.y = this.yaw;

    // Cone color reflects state.
    let color = 0x38e0c4; // patrol teal
    let opacity = 0.1;
    if (this.state === 'suspicious' || this.state === 'search') {
      color = 0xffb02e;
      opacity = 0.16;
    } else if (this.state === 'alert') {
      color = 0xff3b4e;
      opacity = 0.22;
    } else if (this.state === 'stunned') {
      color = 0x7a7f88;
      opacity = 0.08;
    }
    this.coneMat.color.setHex(color);
    this.coneMat.opacity = damp(this.coneMat.opacity, opacity, 6, dt);
    this.eyeMat.color.setHex(color);
    this.eyeMat.emissive.setHex(color);
  }
}

// Build a flat circular-sector geometry (apex at origin, opening down +Z).
function buildSectorGeometry(radius: number, halfAngle: number, segments: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [0, 0, 0];
  for (let i = 0; i <= segments; i++) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    // Forward is +Z in local space (rotated by mesh.rotation.x = -90° to lie flat,
    // and parented to enemy whose yaw aligns -Z forward; we negate to match).
    verts.push(Math.sin(a) * radius, Math.cos(a) * radius, 0);
  }
  const idx: number[] = [];
  for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}
