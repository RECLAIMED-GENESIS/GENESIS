// src/physics/CollisionSystem.js
import * as THREE from 'three';

// ============================================================
// SHARED COLLIDER REGISTRY
// main.js fills this once per level switch. Every enemy system
// (streetEnemies, grunts, commander, enforcer, guardians) resolves
// against it, so enemy AI no longer needs a reference to the level.
// ============================================================
export const worldColliders = [];

// Scratch object — avoids allocating {pos,R,H} every call.
const _entity = { pos: null, R: 0.4, H: 1.8 };

/**
 * Pushes any world position out of static colliders.
 * Works for the player AND enemies — pass the Vector3 you want corrected.
 *
 * @param {THREE.Vector3} pos - position to correct (mutated in place)
 * @param {THREE.Box3[]}  colliders - defaults to the shared worldColliders
 * @param {number} radius - cylinder radius (enemy ~0.45, big bosses ~0.7)
 * @param {number} height - cylinder height
 */
export function resolveEntity(pos, colliders = worldColliders, radius = 0.45, height = 2.0) {
  if (!colliders || !colliders.length || !pos) return;
  _entity.pos = pos;
  _entity.R = radius;
  _entity.H = height;
  _resolveCylinder(_entity, colliders);
}

/**
 * Pushes `pos` out of a circle (XZ plane) centred on `center`.
 * Used to stop enemies standing inside the player (and vice versa).
 *
 * @param {THREE.Vector3} pos - position to push (mutated in place)
 * @param {THREE.Vector3} center - the other entity's position
 * @param {number} minDist - minimum allowed centre-to-centre distance
 */
const _sep = new THREE.Vector3();
export function pushOutOfCircle(pos, center, minDist) {
  if (!pos || !center) return;
  const dx = pos.x - center.x;
  const dz = pos.z - center.z;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist || distSq === 0) return;
  const dist = Math.sqrt(distSq);
  const push = (minDist - dist) / dist;
  pos.x += dx * push;
  pos.z += dz * push;
}

/**
 * Core 2.5D cylinder-vs-AABB resolution. Mutates entity.pos in place.
 * @param {Object} entity - { pos: THREE.Vector3, R: number, H: number }
 * @param {THREE.Box3[]} colliders
 */
function _resolveCylinder(entity, colliders) {
  const pr = entity.R;
  const ph = entity.H;
  const pos = entity.pos;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (!box) continue;

    // Vertical overlap check (entity occupies [pos.y, pos.y + ph])
    if (pos.y + ph < box.min.y || pos.y > box.max.y) continue;

    // Closest point on the AABB in the XZ plane
    const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));

    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;

    if (distSq > 0 && distSq < pr * pr) {
      // Perimeter touches wall/corner -> smooth slide pushback
      const dist = Math.sqrt(distSq);
      const overlap = pr - dist;
      pos.x += (dx / dist) * overlap;
      pos.z += (dz / dist) * overlap;
    } else if (distSq === 0) {
      // Centre is INSIDE the box -> eject along shortest axis.
      // Run the check twice so a corner ejection that lands in a
      // neighbouring box still gets cleaned up in the same frame.
      for (let pass = 0; pass < 2; pass++) {
        const dLeft  = pos.x - box.min.x;
        const dRight = box.max.x - pos.x;
        const dBack  = pos.z - box.min.z;
        const dFront = box.max.z - pos.z;
        const minDist = Math.min(dLeft, dRight, dBack, dFront);

        if (minDist === dLeft)       pos.x = box.min.x - pr;
        else if (minDist === dRight) pos.x = box.max.x + pr;
        else if (minDist === dBack)  pos.z = box.min.z - pr;
        else                         pos.z = box.max.z + pr;
      }
    }
  }
}

/**
 * 2.5D Cylinder vs. AABB Collision & Object Detection System
 */
export class CollisionSystem {
  constructor() {
    this._raycaster = new THREE.Raycaster();
  }

  /**
   * Resolves an entity position against an array of THREE.Box3 colliders.
   * @param {Object} player - Object containing position { pos: THREE.Vector3, R: number, H: number }
   * @param {THREE.Box3[]} colliders
   */
  resolveCollisions(player, colliders) {
    if (!colliders || !colliders.length || !player || !player.pos) return;
    _resolveCylinder(player, colliders);
  }

  /**
   * Scans a scene/graph for objects flagged with userData.isCollider
   * and builds a Box3 for each. Call once after a level is built.
   *
   * @param {THREE.Object3D} root
   * @returns {THREE.Box3[]}
   */
  collectColliders(root) {
    const colliders = [];
    if (!root || !root.traverse) return colliders;
    root.traverse((obj) => {
      if (obj.userData && obj.userData.isCollider) {
        // Skip if an ancestor is also a collider (would create a duplicate box)
        let p = obj.parent;
        while (p) {
          if (p.userData && p.userData.isCollider) return;
          p = p.parent;
        }
        const box = new THREE.Box3().setFromObject(obj);
        box.name = obj.name || obj.userData.colliderName || 'ObjectCollider';
        colliders.push(box);
      }
    });
    return colliders;
  }

  /**
   * Detects solid objects directly in front of or near the player.
   * (unchanged from original)
   */
  detectNearbyObject(playerPos, playerYaw, colliders, maxDistance = 3.0) {
    if (!colliders || !colliders.length || !playerPos) return null;

    const forward = new THREE.Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw)).normalize();
    const rayOrigin = playerPos.clone();
    rayOrigin.y += 1.0;

    let closest = null;
    let minDistance = maxDistance;

    for (const box of colliders) {
      if (!box) continue;

      const boxCenter = new THREE.Vector3();
      box.getCenter(boxCenter);

      this._raycaster.set(rayOrigin, forward);
      this._raycaster.far = maxDistance;

      const hitPoint = new THREE.Vector3();
      const intersects = this._raycaster.ray.intersectBox(box, hitPoint);

      if (intersects) {
        const hitDist = rayOrigin.distanceTo(hitPoint);
        if (hitDist < minDistance) {
          minDistance = hitDist;
          closest = { box, point: hitPoint, distance: hitDist, name: box.name || 'Structure' };
        }
      } else {
        const distToCenter = playerPos.distanceTo(boxCenter);
        if (distToCenter < maxDistance && distToCenter < minDistance) {
          minDistance = distToCenter;
          closest = { box, point: boxCenter, distance: distToCenter, name: box.name || 'Structure' };
        }
      }
    }

    return closest;
  }

  /**
   * Level 1 collider builder.
   *
   * Now MERGES: the level already populates `level.colliders` inside its
   * own constructor via `_buildColliders()`, so we must not replace that
   * list — only append scene-graph-flagged boxes on top.
   */
  buildLevel1Colliders(level) {
    if (!level) return [];
    if (!Array.isArray(level.colliders)) level.colliders = [];

    const root = level.root || level.group || level;
    for (const box of this.collectColliders(root)) {
      if (!level.colliders.includes(box)) level.colliders.push(box);
    }
    return level.colliders;
  }

  /**
   * Level 2 collider builder.
   *
   * Merges (a) the hardcoded cover boxes for the burned car and dumpsters,
   * (b) the level's own `level.colliders` list built by
   * `AlienLevel._buildColliders()`, and (c) any scene-graph-flagged
   * `userData.isCollider` meshes. Returns a fresh array because main.js
   * assigns it back into `level.colliders`.
   */
  buildLevel2Colliders(level = null) {
    const colliders = [];

    const carBox = new THREE.Box3(
      new THREE.Vector3(-5.2, 0, 17.8),
      new THREE.Vector3(-2.8, 2.0, 22.2)
    );
    carBox.name = 'Burned Car';
    colliders.push(carBox);

    const d1 = new THREE.Box3(
      new THREE.Vector3(3.8, 0, 34.4),
      new THREE.Vector3(6.2, 1.8, 35.6)
    );
    d1.name = 'Dumpster 1';
    colliders.push(d1);

    const d2 = new THREE.Box3(
      new THREE.Vector3(-6.7, 0, 49.4),
      new THREE.Vector3(-4.3, 1.8, 50.6)
    );
    d2.name = 'Dumpster 2';
    colliders.push(d2);

    if (level) {
      // Preserve whatever the level already built
      if (Array.isArray(level.colliders)) {
        for (const b of level.colliders) if (!colliders.includes(b)) colliders.push(b);
      }
      const root = level.root || level.level || level.group || level;
      for (const b of this.collectColliders(root)) {
        if (!colliders.includes(b)) colliders.push(b);
      }
    }

    return colliders;
  }

  /**
   * Collects colliders for Level 3 (Interior / Monument).
   *
   * Returns the level's OWN array, not a copy — Level 3 registers
   * colliders asynchronously (spaceship FBX/GLB loads) and they
   * must reach the player's collision loop the moment they land.
   */
  buildLevel3Colliders(level) {
    if (!level) return [];
    if (typeof level._buildColliders === 'function' && !Array.isArray(level.colliders)) {
      level._buildColliders();
    }
    return Array.isArray(level.colliders) ? level.colliders : [];
  }
}
