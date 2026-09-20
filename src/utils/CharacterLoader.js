import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/**
 * CharacterLoader
 * Loads and caches Mixamo FBX characters and their animation clips.
 *
 * Usage:
 *   const loader = new CharacterLoader();
 *   const { model, clips } = await loader.loadCharacter('assets/models/player.fbx', [
 *     'assets/models/anims/idle.fbx',
 *     'assets/models/anims/punch.fbx',
 *     'assets/models/anims/kick.fbx',
 *   ]);
 *
 * Mixamo FBX notes:
 *   - Download base character in T-pose, no skin, 60fps
 *   - Download each anim on the SAME character skeleton, "with skin"
 *   - The anim FBXs contain a full skeleton + one AnimationClip
 *   - We rip the clip from each anim FBX and apply it to the base skeleton
 */
export class CharacterLoader {
  constructor() {
    this._loader = new FBXLoader();
    this._cache = new Map(); // path -> loaded FBX object
    this._clipCache = new Map(); // path -> AnimationClip
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Load a character model + a list of animation FBX paths.
   * Returns { model: THREE.Group, clips: { [name]: AnimationClip } }
   *
   * @param {string} modelPath   - Path to base T-pose FBX
   * @param {Object} animPaths   - { stateName: 'path/to/anim.fbx', ... }
   * @param {Object} options     - { scale: 0.01, castShadow: true }
   */
  async loadCharacter(modelPath, animPaths = {}, options = {}) {
    const { scale = 0.01, castShadow = true } = options;

    // Load base model
    const model = await this._loadFBX(modelPath);
    model.scale.setScalar(scale);

    // Configure shadows and materials on the base mesh
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = false;

        // Keep Mixamo materials but tweak for better look
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            mat.depthWrite = true;
            // Prevent z-fighting on skinned meshes
            if (child.isSkinnedMesh) {
              mat.skinning = true;
            }
          });
        }
      }
    });

    // Load all animation clips
    const clips = {};
    await Promise.all(
      Object.entries(animPaths).map(async ([name, path]) => {
        try {
          const clip = await this._loadClip(path);
          if (clip) {
            clip.name = name; // rename to our state name
            clips[name] = clip;
          }
        } catch (err) {
          console.warn(`[CharacterLoader] Could not load anim "${name}" from ${path}:`, err);
        }
      })
    );

    return { model, clips };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * Load (or return cached) a raw FBX object.
   * Uses fetch + FBXLoader.parse so we can surface 404/HTML errors with
   * actionable diagnostics instead of the opaque
   * "Cannot find the version number for the file given." message.
   */
  async _loadFBX(path) {
    if (this._cache.has(path)) {
      // Clone so each character gets its own scene graph
      return this._cache.get(path).clone(true);
    }

    const url = encodeURI(path);
    let buffer;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} ${res.statusText} — failed to fetch FBX "${path}" (encoded as "${url}"). ` +
          `Check that the file exists in public/assets/ (copied to dist/assets/ on build) and that vite.config.js has base:'./'. ` +
          `Current location: ${window.location.href}`
        );
      }
      // Detect HTML 404 page masquerading as FBX (common when file missing)
      const contentType = res.headers.get('content-type') || '';
      buffer = await res.arrayBuffer();
      // Quick sniff: if first bytes are '<' or '!' or 'd' (html/doctype), it's HTML not FBX
      const head = new TextDecoder().decode(buffer.slice(0, 100));
      if (head.trim().startsWith('<') || head.includes('<!DOCTYPE') || head.includes('<html')) {
        throw new Error(
          `Fetched "${path}" but got HTML instead of FBX (likely 404). ` +
          `Ensure file exists at public/${path} and is not being redirected. ` +
          `If filename has spaces, use the sanitized underscore version (e.g., Hit_To_Body.fbx) or let CharacterLoader encodeURI it.`
        );
      }
      if (contentType.includes('text/html')) {
        throw new Error(`Fetched "${path}" returned content-type text/html — expected model/fbx. Likely 404.`);
      }
    } catch (err) {
      // Network / fetch failure — rethrow with context
      if (err.message.includes('HTTP') || err.message.includes('HTML')) throw err;
      throw new Error(`[CharacterLoader] Network error fetching "${path}" (encoded "${url}"): ${err.message}. ` +
        `Hint: check vite dev server is running and file is in public/${path}`);
    }

    try {
      const fbx = this._loader.parse(buffer, url);
      this._cache.set(path, fbx);
      // Clone for caller so cache stays pristine
      return fbx.clone(true);
    } catch (parseErr) {
      const msg = parseErr?.message || String(parseErr);
      if (msg.includes('version number')) {
        throw new Error(
          `[CharacterLoader] FBXLoader: Cannot find the version number for "${path}". ` +
          `This almost always means the fetch returned HTML (404) instead of FBX. ` +
          `Checked URL "${url}" — verify file exists at public/${path} and public/ is copied to dist/. ` +
          `Original error: ${msg}`
        );
      }
      throw parseErr;
    }
  }

  /**
   * Load a Mixamo animation FBX and extract its AnimationClip.
   * Mixamo animation FBXs contain the skeleton + one clip in fbx.animations[0].
   */
  async _loadClip(path) {
    if (this._clipCache.has(path)) {
      return this._clipCache.get(path).clone();
    }

    const url = encodeURI(path);
    let buffer;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} ${res.statusText} — failed to fetch anim FBX "${path}" (encoded "${url}").`
        );
      }
      buffer = await res.arrayBuffer();
      const head = new TextDecoder().decode(buffer.slice(0, 100));
      if (head.trim().startsWith('<') || head.includes('<!DOCTYPE') || head.includes('<html')) {
        throw new Error(`Fetched anim "${path}" returned HTML (likely 404). Ensure file exists at public/${path}.`);
      }
    } catch (err) {
      // Bubble up to loadCharacter's catch which will warn and continue
      throw err;
    }

    try {
      const fbx = this._loader.parse(buffer, url);
      const clip = fbx.animations[0] || null;
      if (clip) {
        this._clipCache.set(path, clip);
        return clip.clone();
      } else {
        console.warn(`[CharacterLoader] No animation found in ${path}`);
        return null;
      }
    } catch (parseErr) {
      const msg = parseErr?.message || String(parseErr);
      if (msg.includes('version number')) {
        throw new Error(
          `[CharacterLoader] FBXLoader: Cannot find version number for anim "${path}" (URL "${url}"). ` +
          `Got HTML instead of FBX — check file exists at public/${path}. Original: ${msg}`
        );
      }
      throw parseErr;
    }
  }
}

// Singleton — share one loader across Player and Enemy
export const characterLoader = new CharacterLoader();
