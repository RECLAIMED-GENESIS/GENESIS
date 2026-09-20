import * as THREE from 'three';

/**
 * AnimationController
 * A simple state machine on top of THREE.AnimationMixer.
 *
 * States are strings matching keys in the clips object from CharacterLoader.
 * Transitions cross-fade between clips with a configurable blend time.
 *
 * Priority system:
 *   - "locked" states (attack, hurt, death) play to completion before
 *     the machine can transition away. Pass { lock: true } when adding.
 *   - All other states can be interrupted any time.
 *
 * Example:
 *   const ac = new AnimationController(model, clips);
 *   ac.play('idle');
 *   ac.play('punch');   // plays to end, then returns to 'idle'
 *   ac.update(delta);   // call every frame
 */
export class AnimationController {
  /**
   * @param {THREE.Object3D} model  - The skinned character model
   * @param {Object} clips          - { stateName: THREE.AnimationClip }
   * @param {Object} options
   * @param {number} options.defaultFade  - Cross-fade duration in seconds (default 0.2)
   * @param {string} options.defaultState - State to return to after locked states
   */
  constructor(model, clips, options = {}) {
    this._mixer = new THREE.AnimationMixer(model);
    this._clips = clips;
    this._actions = {}; // stateName -> AnimationAction
    this._current = null;         // current state name
    this._locked = false;         // true while a locked anim plays
    this._lockedReturnTo = null;  // state to return to after lock ends
    this._defaultFade = options.defaultFade ?? 0.2;
    this._defaultState = options.defaultState ?? 'idle';

    // Pre-create all actions so we can cross-fade smoothly
    this._buildActions();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Request a state change.
   * @param {string}  state       - Clip name to play
   * @param {Object}  opts
   * @param {boolean} opts.lock   - If true, anim plays to completion before any new state
   * @param {number}  opts.fade   - Override cross-fade duration
   * @param {string}  opts.returnTo - After locked anim finishes, go to this state
   * @returns {boolean} Whether the transition was accepted
   */
  play(state, opts = {}) {
    if (!this._actions[state]) {
      console.warn(`[AnimationController] Unknown state: "${state}"`);
      return false;
    }

    // If we're mid-lock and this isn't a higher-priority override, reject
    if (this._locked && !opts.force) return false;

    // If already playing this state, do nothing
    if (this._current === state && !opts.restart) return false;

    const fadeDuration = opts.fade ?? this._defaultFade;

    // Fade out the current action
    if (this._current && this._actions[this._current]) {
      this._actions[this._current].fadeOut(fadeDuration);
    }

    // Set up and fade in the new action
    const action = this._actions[state];
    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.fadeIn(fadeDuration);
    action.play();

    this._current = state;

    if (opts.lock) {
      this._locked = true;
      this._lockedReturnTo = opts.returnTo ?? this._defaultState;

      // Unlock when the clip finishes
      const onFinish = (e) => {
        if (e.action === action) {
          this._locked = false;
          this._mixer.removeEventListener('finished', onFinish);
          this.play(this._lockedReturnTo);
        }
      };
      action.clampWhenFinished = true;
      action.loop = THREE.LoopOnce;
      this._mixer.addEventListener('finished', onFinish);
    } else {
      action.loop = THREE.LoopRepeat;
    }

    return true;
  }

  /**
   * Force a transition even if currently locked (e.g. stagger/death).
   */
  forcePlay(state, opts = {}) {
    this._locked = false;
    return this.play(state, { ...opts, force: true });
  }

  /**
   * Call this every frame with the frame delta time.
   */
  update(delta) {
    this._mixer.update(delta);
  }

  /**
   * Get the name of the currently playing state.
   */
  get current() {
    return this._current;
  }

  /**
   * Is the controller mid-lock (i.e. playing a one-shot anim)?
   */
  get isLocked() {
    return this._locked;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _buildActions() {
    for (const [name, clip] of Object.entries(this._clips)) {
      if (!clip) continue;
      const action = this._mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0); // start invisible
      action.play();               // preload on GPU
      this._actions[name] = action;
    }
  }
}
