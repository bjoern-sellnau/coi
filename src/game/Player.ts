import * as THREE from 'three';
import type { Input } from './Input';
import { TacticSuit } from './TacticSuit';
import { Instincts } from './Instincts';
import { resolveCircleVsBoxes, clamp, damp, type BoxCollider } from './physics';

const GRAVITY = 24;
const WALK_SPEED = 4.2;
const CROUCH_SPEED = 2.1;
const EYE_STAND = 1.65;
const EYE_CROUCH = 1.0;
const PLAYER_RADIUS = 0.4;

export class Player {
  pos = new THREE.Vector3(0, 0, 0);
  velY = 0;
  yaw = 0;
  pitch = 0;

  health = 100;
  maxHealth = 100;

  suit = new TacticSuit();
  instincts = new Instincts();

  crouching = false;
  sprinting = false;
  moving = false;
  onGround = true;
  noise = 0; // 0..1 how much sound the player is making this frame

  thirdPerson = false;

  mesh: THREE.Group;
  private bodyMats: THREE.MeshStandardMaterial[] = [];
  private eyeHeight = EYE_STAND;

  // phase-dash request flag consumed by Game (needs collider context applied here)
  private dashImpulse = 0;

  camera: THREE.PerspectiveCamera;
  hurtFlash = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.mesh = this.buildMesh();
  }

  private buildMesh(): THREE.Group {
    const g = new THREE.Group();
    const suitColor = 0x14323a;
    const accent = 0x38e0c4;

    const mat = (color: number, emissive = 0x000000, emInt = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: emInt,
        roughness: 0.5,
        metalness: 0.4,
      });
      this.bodyMats.push(m);
      return m;
    };

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), mat(suitColor, accent, 0.15));
    torso.position.y = 1.05;
    g.add(torso);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), mat(suitColor));
    pelvis.position.y = 0.62;
    g.add(pelvis);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), mat(0x0c1a1e, accent, 0.25));
    head.position.y = 1.62;
    g.add(head);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.2 })
    );
    visor.position.set(0, 1.64, 0.14);
    g.add(visor);

    const limbMat = () => mat(0x0e2227);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), limbMat());
      arm.position.set(side * 0.36, 1.0, 0);
      g.add(arm);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), limbMat());
      leg.position.set(side * 0.15, 0.3, 0);
      g.add(leg);
    }

    // Spine light accent
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.02),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9 })
    );
    spine.position.set(0, 1.05, -0.17);
    g.add(spine);

    g.traverse((o) => {
      o.castShadow = true;
    });
    return g;
  }

  spawn(pos: THREE.Vector3, yaw: number) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.pitch = 0;
    this.velY = 0;
    this.health = this.maxHealth;
    this.suit.energy = this.suit.maxEnergy;
    this.suit.mode = 'armor';
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get aimDir(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  centerPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight * 0.55, this.pos.z);
  }

  requestDash(strength: number) {
    this.dashImpulse = strength;
  }

  // How visible the player is to enemy vision this frame (0 hidden .. 1 lit up).
  visibilityFactor(): number {
    let v = 1;
    if (this.suit.isCloaked) v *= this.moving ? 0.14 : 0.04;
    if (this.crouching) v *= 0.55;
    if (!this.moving && !this.suit.isCloaked) v *= 0.8;
    if (this.sprinting && this.moving) v *= 1.25;
    return clamp(v, 0, 1);
  }

  takeDamage(amount: number) {
    const real = this.suit.absorbDamage(amount);
    this.health = Math.max(0, this.health - real);
    this.hurtFlash = 1;
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get dead(): boolean {
    return this.health <= 0;
  }

  update(dt: number, input: Input, colliders: BoxCollider[], lookScale = 1) {
    // ---- Look ----
    const sens = 0.0022 * lookScale;
    this.yaw -= (input.mouseDX + input.touchLookDX) * sens;
    this.pitch -= (input.mouseDY + input.touchLookDY) * sens;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

    // ---- Suit mode toggles ----
    if (input.wasPressed('KeyF')) this.suit.toggleCloak();

    // ---- Crouch ----
    this.crouching = input.isDown('ControlLeft') || input.isDown('KeyC');
    const targetEye = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeHeight = damp(this.eyeHeight, targetEye, 12, dt);

    // ---- Movement input ----
    let ix = 0;
    let iz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iz += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iz -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    // Mobile joystick
    ix += input.touchMoveX;
    iz += -input.touchMoveY;

    const inputLen = Math.hypot(ix, iz);
    this.moving = inputLen > 0.05 && this.onGround;
    if (inputLen > 1) {
      ix /= inputLen;
      iz /= inputLen;
    }

    this.sprinting =
      (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && !this.crouching && iz > 0.1;

    let speed = this.crouching ? CROUCH_SPEED : WALK_SPEED;
    if (this.sprinting) speed *= this.suit.sprintMultiplier();

    const forward = this.forward;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3()
      .addScaledVector(forward, iz)
      .addScaledVector(right, ix);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

    // Phase-dash impulse
    if (this.dashImpulse > 0) {
      move.addScaledVector(this.aimDir.clone().setY(0).normalize(), this.dashImpulse / dt);
      this.dashImpulse = 0;
    }

    // ---- Jump & gravity ----
    if ((input.wasPressed('Space')) && this.onGround) {
      this.velY = this.suit.hasPower() ? 9.5 : 7.0;
      if (this.suit.hasPower()) this.suit.spend(4);
      this.onGround = false;
    }
    this.velY -= GRAVITY * dt;

    // ---- Integrate ----
    this.pos.x += move.x * dt;
    this.pos.z += move.z * dt;
    this.pos.y += this.velY * dt;

    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.velY = 0;
      this.onGround = true;
    }

    // ---- Collisions (XZ) ----
    const radius = this.crouching ? PLAYER_RADIUS * 0.9 : PLAYER_RADIUS;
    const resolved = resolveCircleVsBoxes(this.pos, radius, this.eyeHeight, colliders);
    this.pos.copy(resolved);

    // ---- Noise ----
    let targetNoise = 0;
    if (this.moving) targetNoise = this.crouching ? 0.12 : 0.45;
    if (this.sprinting) targetNoise = 0.9;
    if (this.suit.isCloaked) targetNoise *= 0.6;
    this.noise = damp(this.noise, targetNoise, 10, dt);

    // ---- Suit energy ----
    this.suit.update(dt, { moving: this.moving, sprinting: this.sprinting });

    // ---- Hurt flash decay ----
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);

    // ---- Visuals ----
    this.updateMesh(dt);
    this.updateCamera(colliders);
  }

  private updateMesh(dt: number) {
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    // crouch squash
    const sy = clamp((this.eyeHeight - EYE_CROUCH) / (EYE_STAND - EYE_CROUCH), 0.7, 1) * 0.6 + 0.4;
    this.mesh.scale.y = sy;

    const cloaked = this.suit.isCloaked;
    const targetOpacity = cloaked ? 0.18 : 1;
    for (const m of this.bodyMats) {
      m.transparent = cloaked;
      m.opacity = damp(m.opacity ?? 1, targetOpacity, 10, dt);
      m.emissiveIntensity = damp(m.emissiveIntensity, cloaked ? 0.4 : 0.15, 8, dt);
    }
    // Hide self-body in first person (but the arms could clip the camera).
    this.mesh.visible = this.thirdPerson;
  }

  private updateCamera(colliders: BoxCollider[]) {
    const eye = this.eyePosition();
    if (!this.thirdPerson) {
      this.camera.position.copy(eye);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      // Orbit camera behind the player.
      const dist = 4.2;
      const dir = this.aimDir;
      const desired = eye.clone().addScaledVector(dir, -dist).add(new THREE.Vector3(0, 0.5, 0));
      // Pull camera in if it would clip a wall.
      const camPos = this.clampCameraToWalls(eye, desired, colliders);
      this.camera.position.copy(camPos);
      this.camera.lookAt(eye.clone().addScaledVector(dir, 2));
    }
  }

  private clampCameraToWalls(eye: THREE.Vector3, desired: THREE.Vector3, colliders: BoxCollider[]): THREE.Vector3 {
    const dir = new THREE.Vector3().subVectors(desired, eye);
    const maxDist = dir.length();
    if (maxDist < 1e-4) return desired;
    dir.normalize();
    let best = maxDist;
    for (const c of colliders) {
      if (c.blocksSight === false) continue;
      const t = rayBox(eye, dir, c, maxDist);
      if (t !== null && t < best) best = Math.max(0.4, t - 0.3);
    }
    return eye.clone().addScaledVector(dir, best);
  }
}

function rayBox(origin: THREE.Vector3, dir: THREE.Vector3, c: BoxCollider, maxDist: number): number | null {
  let tmin = 0;
  let tmax = maxDist;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const mn = [c.min.x, c.min.y, c.min.z];
  const mx = [c.max.x, c.max.y, c.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn[i] || o[i] > mx[i]) return null;
    } else {
      const inv = 1 / d[i];
      let t1 = (mn[i] - o[i]) * inv;
      let t2 = (mx[i] - o[i]) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : null;
}
