import * as THREE from 'three';
import { Input } from './Input';
import { Player } from './Player';
import { HUD } from './HUD';
import { AudioManager } from './Audio';
import { Enemy, type EnemyContext } from './Enemy';
import { Trap, type TrapType } from './Trap';
import { buildLevel, type BuiltLevel, Memory } from './Level';
import { LEVELS } from './levels';
import type { BoxCollider } from './physics';
import { clamp } from './physics';

export type GameState = 'menu' | 'playing' | 'paused' | 'dead' | 'complete' | 'victory';

const TRAP_TYPES: TrapType[] = ['mine', 'snare', 'emp'];

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  input: Input;
  hud: HUD;
  audio = new AudioManager();
  player: Player;

  state: GameState = 'menu';
  levelIndex = 0;
  private level?: BuiltLevel;
  private colliders: BoxCollider[] = [];
  private traps: Trap[] = [];
  private tracers: { line: THREE.Line; life: number }[] = [];

  private sun!: THREE.DirectionalLight;
  private ambient!: THREE.AmbientLight;
  private hemi!: THREE.HemisphereLight;

  private trapType: TrapType = 'mine';
  private trapInventory = 6;
  private trapCooldown = 0;
  private fragmentsCollected = 0;

  private alarmLingerTimer = 0;
  private visionOn = false;
  private introQueue: string[] = [];
  private introTimer = 0;

  // Callbacks the menu layer subscribes to.
  onStateChange: (state: GameState, info?: { levelIndex: number; victory?: boolean }) => void = () => {};

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);

    this.input = new Input(this.renderer.domElement);
    this.player = new Player(this.camera);
    this.hud = new HUD(this.player.instincts);

    this.setupLights();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.pointerLocked && this.state === 'playing') {
        this.pause();
      }
    });

    this.clock.start();
    this.loop();
  }

  private setupLights() {
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x88aaff, 0x223322, 0.4);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 0.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    const s = 70;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------------------------------------------------------------- level flow
  startLevel(index: number) {
    this.levelIndex = clamp(index, 0, LEVELS.length - 1);
    this.clearLevel();

    const def = LEVELS[this.levelIndex];
    this.level = buildLevel(def);
    this.colliders = this.level.colliders;
    this.scene.add(this.level.group);

    // Environment
    const cfg = this.level.config;
    this.scene.background = new THREE.Color(cfg.sky);
    this.scene.fog = new THREE.Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far);
    this.ambient.intensity = cfg.ambient;
    this.hemi.intensity = cfg.hemi ?? 0.4;
    this.sun.color.setHex(cfg.sun.color);
    this.sun.intensity = cfg.sun.intensity;
    this.sun.position.set(...cfg.sun.pos);
    this.sun.target.position.set(0, 0, 0);

    // Player spawn
    this.player.spawn(new THREE.Vector3(cfg.spawn.pos[0], 0, cfg.spawn.pos[1]), cfg.spawn.yaw);
    this.scene.add(this.player.mesh);

    // Reset run state (keep instinct unlocks across levels = persistent powers).
    this.traps = [];
    this.trapInventory = 6;
    this.trapType = 'mine';
    this.fragmentsCollected = 0;
    this.alarmLingerTimer = 0;
    this.visionOn = false;

    // HUD
    this.hud.show();
    this.hud.setLevel(`${cfg.name} — ${cfg.tag}`, cfg.objectiveText);
    this.hud.setFragments(0, this.level.memories.length);
    this.hud.setTrap(this.trapType, this.trapInventory);
    this.hud.showBanner(cfg.name, cfg.tag.toUpperCase(), 'neutral', 3);

    // Intro narration
    this.introQueue = [...cfg.intro];
    this.introTimer = 1.2;

    this.setState('playing');
    this.input.enabled = true;
    this.input.requestPointerLock();
    this.audio.resumeFromGesture();
  }

  private clearLevel() {
    if (this.level) {
      this.scene.remove(this.level.group);
      this.scene.remove(this.player.mesh);
    }
    for (const t of this.traps) this.scene.remove(t.mesh);
    for (const tr of this.tracers) this.scene.remove(tr.line);
    this.traps = [];
    this.tracers = [];
    this.setVision(false);
  }

  restartLevel() {
    this.startLevel(this.levelIndex);
  }

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) {
      this.startLevel(this.levelIndex + 1);
    } else {
      this.setState('victory', { levelIndex: this.levelIndex, victory: true });
      this.hud.hide();
      this.input.exitPointerLock();
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.input.exitPointerLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.setState('playing');
    this.input.requestPointerLock();
  }

  returnToMenu() {
    this.clearLevel();
    this.hud.hide();
    this.input.exitPointerLock();
    this.setState('menu');
  }

  private setState(s: GameState, info?: { levelIndex: number; victory?: boolean }) {
    this.state = s;
    this.onStateChange(s, info ?? { levelIndex: this.levelIndex });
  }

  // -------------------------------------------------------------------- update
  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.update(dt);
    }
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private update(dt: number) {
    const level = this.level!;

    // Camera view toggle
    if (this.input.wasPressed('KeyV')) this.player.thirdPerson = !this.player.thirdPerson;

    // Trap type cycle / placement
    if (this.input.wasPressed('KeyG')) {
      const i = TRAP_TYPES.indexOf(this.trapType);
      this.trapType = TRAP_TYPES[(i + 1) % TRAP_TYPES.length];
      this.hud.setTrap(this.trapType, this.trapInventory);
    }
    if (this.trapCooldown > 0) this.trapCooldown -= dt;
    if (this.input.wasPressed('KeyQ')) this.tryPlaceTrap();

    // Instinct powers (also ticks cooldowns/durations)
    this.applyPowers(dt);

    // Player
    this.player.update(dt, this.input, this.colliders);

    // Slow-mo for the world while Adrenaline Surge is active.
    const worldScale = this.player.instincts.isActive('adrenaline') ? 0.35 : 1;
    const worldDt = dt * worldScale;

    // Enemies
    const anyAlertBefore = level.enemies.some((e) => e.state === 'alert');
    const globalAlarm = anyAlertBefore || this.alarmLingerTimer > 0;
    const ctx: EnemyContext = {
      player: this.player,
      colliders: this.colliders,
      dt: worldDt,
      globalAlarm,
      raiseAlarm: (pos) => {
        if (this.alarmLingerTimer <= 0) this.audio.alarm();
        this.alarmLingerTimer = 8;
      },
      damagePlayer: (amt) => {
        this.player.takeDamage(amt);
        this.audio.hurt();
      },
      onShoot: (from, to) => this.spawnTracer(from, to),
    };
    for (const e of level.enemies) e.update(ctx);

    // Predator Vision x-ray
    this.setVision(this.player.instincts.isActive('vision'));

    // Traps
    for (const t of this.traps) {
      const wasTriggered = t.triggered;
      t.update(worldDt, level.enemies);
      if (!wasTriggered && t.triggered) {
        this.audio[t.type === 'mine' ? 'explosion' : 'trap']();
      }
    }
    this.traps = this.traps.filter((t) => {
      if (t.finished) {
        this.scene.remove(t.mesh);
        return false;
      }
      return true;
    });

    // Tracers
    for (const tr of this.tracers) {
      tr.life -= dt;
      (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.life / 0.12);
    }
    this.tracers = this.tracers.filter((tr) => {
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        return false;
      }
      return true;
    });

    // Memories
    level.memories.forEach((m) => m.update(worldDt));
    this.checkMemoryPickup();

    // Extraction marker
    level.extraction.update(dt);

    // Interaction prompt (takedown / extraction)
    this.updateInteraction();

    // Alarm linger
    if (this.alarmLingerTimer > 0) this.alarmLingerTimer -= dt;
    const anyAlert = level.enemies.some((e) => e.state === 'alert');

    // Intro narration pacing
    this.tickIntro(dt);

    // HUD sync
    this.syncHud(anyAlert, level);

    // Win / lose
    if (this.player.dead) {
      this.onDeath();
      return;
    }
    if (this.player.pos.distanceTo(level.extraction.pos) < 3.2) {
      this.onExtract();
    }
  }

  private syncHud(anyAlert: boolean, level: BuiltLevel) {
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setEnergy(this.player.suit.energy, this.player.suit.maxEnergy);
    this.hud.setSuit(this.player.suit.mode, this.player.suit.isCloaked);
    const maxDet = level.enemies.reduce((m, e) => Math.max(m, e.dead ? 0 : e.detection), 0);
    this.hud.setDetection(maxDet, anyAlert);
    this.hud.updatePowers(this.player.instincts);
    this.hud.setVignette(this.player.hurtFlash, anyAlert || this.alarmLingerTimer > 0);
  }

  // Instinct activation: read key presses, apply effects.
  private applyPowers(dt: number) {
    const inst = this.player.instincts;
    inst.update(dt);
    for (const p of inst.powers) {
      if (!p.unlocked) continue;
      if (this.input.wasPressed(p.keyCode)) {
        const fired = inst.tryActivate(p.id, this.player.suit);
        if (fired) {
          this.audio.power();
          this.onPowerFired(fired.id);
        }
      }
    }
  }

  private onPowerFired(id: string) {
    if (id === 'mindspike') {
      // Stun the best target in front of the player.
      const target = this.pickTargetEnemy(13, 0.4);
      if (target) {
        target.stun(5.5);
        this.hud.showBanner('MIND SPIKE', 'Target neutralised', 'good', 1.4);
      }
    } else if (id === 'phase') {
      this.player.requestDash(6.5);
    } else if (id === 'adrenaline') {
      this.hud.showBanner('ADRENALINE SURGE', 'Time bends', 'good', 1.4);
    }
  }

  private pickTargetEnemy(maxDist: number, minDot: number): Enemy | undefined {
    const eye = this.player.eyePosition();
    const aim = this.player.aimDir;
    let best: Enemy | undefined;
    let bestScore = -Infinity;
    for (const e of this.level!.enemies) {
      if (e.dead) continue;
      const to = new THREE.Vector3().subVectors(e.eyePos(), eye);
      const dist = to.length();
      if (dist > maxDist) continue;
      to.normalize();
      const dot = aim.dot(to);
      if (dot < minDot) continue;
      const score = dot - dist / maxDist;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private tryPlaceTrap() {
    if (this.trapInventory <= 0 || this.trapCooldown > 0) return;
    const eye = this.player.eyePosition();
    const dir = this.player.aimDir;
    let point: THREE.Vector3;
    if (dir.y < -0.05) {
      const t = clamp(-eye.y / dir.y, 0, 9);
      point = eye.clone().addScaledVector(dir, t);
    } else {
      const flat = this.player.forward;
      point = new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z).addScaledVector(flat, 2.5);
    }
    point.y = 0;
    const trap = new Trap(this.trapType, point);
    this.traps.push(trap);
    this.scene.add(trap.mesh);
    this.trapInventory--;
    this.trapCooldown = 0.4;
    this.audio.trap();
    this.hud.setTrap(this.trapType, this.trapInventory);
  }

  private updateInteraction() {
    const level = this.level!;
    // Extraction proximity hint
    const distExtract = this.player.pos.distanceTo(level.extraction.pos);
    if (distExtract < 7) {
      this.hud.showPrompt('Reach the <kbd>extraction</kbd> marker');
      return;
    }
    // Stealth takedown availability
    const target = this.findTakedownTarget();
    if (target) {
      this.hud.showPrompt('<kbd>E</kbd> Silent Takedown');
      if (this.input.wasPressed('KeyE')) {
        target.kill();
        this.audio.takedown();
        this.hud.showBanner('TAKEDOWN', '', 'good', 1);
      }
      return;
    }
    // Melee strike
    if (this.input.mouseWasPressed(0)) this.tryMelee();

    this.hud.hidePrompt();
  }

  private findTakedownTarget(): Enemy | undefined {
    for (const e of this.level!.enemies) {
      if (e.dead || e.state === 'alert') continue;
      const to = new THREE.Vector3().subVectors(e.pos, this.player.pos).setY(0);
      const dist = to.length();
      if (dist > 1.8) continue;
      to.normalize();
      const enemyFwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
      // Player should be behind the enemy: enemy faces away from player, so the
      // direction from player to enemy roughly aligns with the enemy's forward.
      if (enemyFwd.dot(to) > 0.3) return e;
    }
    return undefined;
  }

  private tryMelee() {
    const target = this.pickTargetEnemy(2.2, 0.3);
    if (target) {
      target.damage(45);
      this.player.noise = 0.7;
      this.audio.takedown();
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    this.audio.shoot();
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  private checkMemoryPickup() {
    const level = this.level!;
    for (const m of level.memories) {
      if (m.collected) continue;
      if (this.player.pos.distanceTo(m.pos) < 1.9) {
        this.collectMemory(m);
      }
    }
  }

  private collectMemory(m: Memory) {
    m.collected = true;
    m.mesh.visible = false;
    this.fragmentsCollected++;
    this.audio.pickup();
    this.hud.setFragments(this.fragmentsCollected, this.level!.memories.length);

    const unlocked = this.player.instincts.unlockNext();
    if (unlocked) {
      this.audio.power();
      this.hud.showBanner('INSTINCT RECOVERED', unlocked.name, 'good', 3);
      this.hud.showSubtitle(`${m.text}  —  [${unlocked.name}: press ${unlocked.keyLabel}] ${unlocked.description}`, 'Memory', 8);
    } else {
      this.hud.showSubtitle(m.text, 'Memory', 7);
    }
  }

  private setVision(on: boolean) {
    if (on === this.visionOn) return;
    this.visionOn = on;
    if (!this.level) return;
    for (const e of this.level.enemies) {
      e.mesh.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (mat && (mat as any).isMeshStandardMaterial) {
          mat.depthTest = !on;
          if (on) {
            mat.emissive = new THREE.Color(0xff5566);
            mat.emissiveIntensity = 0.9;
          } else {
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
        mesh.renderOrder = on ? 999 : 0;
      });
    }
  }

  private tickIntro(dt: number) {
    if (this.introQueue.length === 0) return;
    this.introTimer -= dt;
    if (this.introTimer <= 0) {
      const line = this.introQueue.shift()!;
      this.hud.showSubtitle(line, '', 5);
      this.introTimer = 5.2;
    }
  }

  private onDeath() {
    this.setState('dead');
    this.hud.hide();
    this.input.exitPointerLock();
  }

  private onExtract() {
    this.setState('complete');
    this.hud.hide();
    this.input.exitPointerLock();
  }
}
