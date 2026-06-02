import * as THREE from 'three';
import { Enemy } from './Enemy';
import { boxFromCenterSize, type BoxCollider } from './physics';

export interface LevelConfig {
  id: string;
  name: string;
  tag: string;
  brief: string;
  sky: number;
  fog: { color: number; near: number; far: number };
  ground: number;
  ground2?: number; // checker / accent color
  ambient: number;
  sun: { color: number; intensity: number; pos: [number, number, number] };
  hemi?: number;
  spawn: { pos: [number, number]; yaw: number };
  extraction: [number, number];
  objectiveText: string;
  intro: string[];
}

export interface EnemySpawnDef {
  pos: [number, number];
  patrol?: [number, number][];
  facing?: number;
}

export interface MemoryDef {
  pos: [number, number];
  text: string;
}

export interface LevelDefinition {
  config: LevelConfig;
  construct: (b: Builder) => void;
  enemies: EnemySpawnDef[];
  memories: MemoryDef[];
}

export interface BuiltLevel {
  config: LevelConfig;
  group: THREE.Group;
  colliders: BoxCollider[];
  enemies: Enemy[];
  memories: Memory[];
  extraction: Memory; // reuse the pickup visuals for the extraction marker
}

// A floating collectible (memory fragment) or extraction marker.
export class Memory {
  pos: THREE.Vector3;
  text: string;
  collected = false;
  mesh: THREE.Group;
  private core: THREE.Mesh;
  private ring: THREE.Mesh;
  private t = Math.random() * 10;

  constructor(pos: THREE.Vector3, text: string, color = 0x38e0c4, big = false) {
    this.pos = pos.clone();
    this.text = text;
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.pos);

    const s = big ? 0.9 : 0.32;
    this.core = new THREE.Mesh(
      new THREE.OctahedronGeometry(s, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.2 })
    );
    this.core.position.y = big ? 1.4 : 1.1;
    this.mesh.add(this.core);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(big ? 1.3 : 0.55, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = big ? 1.4 : 1.1;
    this.mesh.add(this.ring);

    const light = new THREE.PointLight(color, big ? 2 : 0.8, big ? 10 : 5);
    light.position.y = big ? 1.4 : 1.1;
    this.mesh.add(light);
  }

  update(dt: number) {
    this.t += dt;
    this.core.rotation.y += dt * 1.2;
    this.core.rotation.x += dt * 0.5;
    this.core.position.y += Math.sin(this.t * 2) * dt * 0.2;
    this.ring.rotation.z += dt * 0.6;
  }
}

// Helper for assembling level geometry + colliders.
export class Builder {
  group = new THREE.Group();
  colliders: BoxCollider[] = [];

  private addMesh(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  box(cx: number, cz: number, w: number, d: number, h: number, color: number, y = 0, opts: { blocksSight?: boolean; metalness?: number; roughness?: number; emissive?: number } = {}) {
    const cy = y + h / 2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: opts.roughness ?? 0.85,
        metalness: opts.metalness ?? 0.05,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissive ? 0.6 : 0,
      })
    );
    mesh.position.set(cx, cy, cz);
    this.addMesh(mesh);
    this.colliders.push(boxFromCenterSize(cx, cy, cz, w, h, d, opts.blocksSight ?? true));
    return mesh;
  }

  // Wall between two points.
  wall(x1: number, z1: number, x2: number, z2: number, height: number, color: number, thickness = 0.4) {
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, height, thickness),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    mesh.position.set(cx, height / 2, cz);
    mesh.rotation.y = -angle;
    this.addMesh(mesh);

    // Approximate collider with an AABB (good enough for axis-ish walls).
    const minX = Math.min(x1, x2) - thickness;
    const maxX = Math.max(x1, x2) + thickness;
    const minZ = Math.min(z1, z2) - thickness;
    const maxZ = Math.max(z1, z2) + thickness;
    this.colliders.push({
      min: new THREE.Vector3(minX, 0, minZ),
      max: new THREE.Vector3(maxX, height, maxZ),
      blocksSight: true,
    });
    return mesh;
  }

  crate(cx: number, cz: number, size = 1.1, color = 0x6b5a3a) {
    return this.box(cx, cz, size, size, size, color, 0, { roughness: 0.7, metalness: 0.1 });
  }

  pillar(cx: number, cz: number, r: number, h: number, color: number) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    mesh.position.set(cx, h / 2, cz);
    this.addMesh(mesh);
    this.colliders.push(boxFromCenterSize(cx, h / 2, cz, r * 2, h, r * 2, true));
    return mesh;
  }

  tree(cx: number, cz: number, scale = 1) {
    const trunkH = 4 * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * scale, 0.32 * scale, trunkH, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b2c1d, roughness: 1 })
    );
    trunk.position.set(cx, trunkH / 2, cz);
    this.addMesh(trunk);
    this.colliders.push(boxFromCenterSize(cx, trunkH / 2, cz, 0.6 * scale, trunkH, 0.6 * scale, true));

    for (let i = 0; i < 3; i++) {
      const r = (1.8 - i * 0.4) * scale;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(r, 2.2 * scale, 7),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x1f5d2a : 0x2a7a37, roughness: 1 })
      );
      canopy.position.set(cx, trunkH - 0.5 + i * 1.3 * scale, cz);
      canopy.castShadow = true;
      this.group.add(canopy);
      // Canopy is above head height — don't block body-level sight.
    }
  }

  bush(cx: number, cz: number, scale = 1) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7 * scale, 0),
      new THREE.MeshStandardMaterial({ color: 0x1d5a2b, roughness: 1, flatShading: true })
    );
    m.position.set(cx, 0.5 * scale, cz);
    m.castShadow = true;
    this.group.add(m);
    // Light cover: blocks sight but is low.
    this.colliders.push(boxFromCenterSize(cx, 0.5 * scale, cz, 1.3 * scale, 1.3 * scale, 1 * scale, true));
  }

  light(x: number, y: number, z: number, color: number, intensity: number, dist: number) {
    const l = new THREE.PointLight(color, intensity, dist);
    l.position.set(x, y, z);
    this.group.add(l);
    return l;
  }

  glowStrip(cx: number, cz: number, w: number, d: number, color: number, y = 0.02) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, y, cz);
    this.group.add(m);
  }
}

export function buildLevel(def: LevelDefinition): BuiltLevel {
  const b = new Builder();

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: def.config.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  b.group.add(ground);

  // Outer boundary walls so the player can't wander off the map.
  const R = 70;
  const wallH = 8;
  const bColor = def.config.ground2 ?? 0x222222;
  b.wall(-R, -R, R, -R, wallH, bColor, 1);
  b.wall(-R, R, R, R, wallH, bColor, 1);
  b.wall(-R, -R, -R, R, wallH, bColor, 1);
  b.wall(R, -R, R, R, wallH, bColor, 1);

  def.construct(b);

  const enemies = def.enemies.map((e) => {
    const spawn = new THREE.Vector3(e.pos[0], 0, e.pos[1]);
    const wps = (e.patrol ?? [e.pos]).map((p) => new THREE.Vector3(p[0], 0, p[1]));
    return new Enemy(spawn, wps, e.facing ?? 0);
  });
  enemies.forEach((e) => b.group.add(e.mesh));

  const memories = def.memories.map((m) => new Memory(new THREE.Vector3(m.pos[0], 0, m.pos[1]), m.text));
  memories.forEach((m) => b.group.add(m.mesh));

  const extraction = new Memory(
    new THREE.Vector3(def.config.extraction[0], 0, def.config.extraction[1]),
    'extraction',
    0x9be23a,
    true
  );
  b.group.add(extraction.mesh);

  return { config: def.config, group: b.group, colliders: b.colliders, enemies, memories, extraction };
}
