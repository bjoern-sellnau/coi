import * as THREE from 'three';

// A simple axis-aligned box collider used for level geometry & line-of-sight.
export interface BoxCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
  blocksSight?: boolean; // foliage blocks movement but only partially sight, etc.
}

export function boxFromCenterSize(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  blocksSight = true
): BoxCollider {
  return {
    min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
    blocksSight,
  };
}

// Resolve a vertical cylinder (the player/enemy capsule) against AABB colliders
// in the XZ plane. Returns the corrected position. Keeps it cheap and robust.
export function resolveCircleVsBoxes(
  pos: THREE.Vector3,
  radius: number,
  height: number,
  colliders: BoxCollider[]
): THREE.Vector3 {
  const p = pos.clone();
  const feetY = p.y;
  const headY = p.y + height;

  for (const c of colliders) {
    // Skip if vertically separated (allows stepping over / under nothing here).
    if (headY < c.min.y || feetY > c.max.y) continue;

    // Closest point on the box (XZ) to the circle centre.
    const closestX = Math.max(c.min.x, Math.min(p.x, c.max.x));
    const closestZ = Math.max(c.min.z, Math.min(p.z, c.max.z));
    const dx = p.x - closestX;
    const dz = p.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-5) {
        const push = (radius - dist) / dist;
        p.x += dx * push;
        p.z += dz * push;
      } else {
        // Centre is inside the box: push out along the axis of least penetration.
        const penLeft = p.x - c.min.x;
        const penRight = c.max.x - p.x;
        const penBack = p.z - c.min.z;
        const penFront = c.max.z - p.z;
        const minPen = Math.min(penLeft, penRight, penBack, penFront);
        if (minPen === penLeft) p.x = c.min.x - radius;
        else if (minPen === penRight) p.x = c.max.x + radius;
        else if (minPen === penBack) p.z = c.min.z - radius;
        else p.z = c.max.z + radius;
      }
    }
  }
  return p;
}

// Line-of-sight test: is the straight segment from `a` to `b` clear of any
// sight-blocking collider? Uses a slab (ray vs AABB) intersection test.
export function hasLineOfSight(
  a: THREE.Vector3,
  b: THREE.Vector3,
  colliders: BoxCollider[]
): boolean {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-5) return true;
  dir.divideScalar(len);

  for (const c of colliders) {
    if (c.blocksSight === false) continue;
    if (rayHitsBoxWithin(a, dir, len, c)) return false;
  }
  return true;
}

function rayHitsBoxWithin(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, c: BoxCollider): boolean {
  let tmin = 0;
  let tmax = maxDist;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const mn = [c.min.x, c.min.y, c.min.z];
  const mx = [c.max.x, c.max.y, c.max.z];

  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn[i] || o[i] > mx[i]) return false;
    } else {
      const inv = 1 / d[i];
      let t1 = (mn[i] - o[i]) * inv;
      let t2 = (mx[i] - o[i]) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return tmin <= maxDist && tmax >= 0;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
