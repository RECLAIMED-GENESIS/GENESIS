// src/audio/loadAudio.js
// Registers all audio assets with the AudioManager.
// All paths are RELATIVE (start with './') so they work on the LAMP server
// when the game is served from a subdirectory.

export function loadAllAudio(audioManager) {
  // ── MUSIC ──
  audioManager.loadSound('level_1_chiptune', {
    src: './assets/audio/music/level_1_chiptune.mp3',
    loop: true, volume: 0.5,
  });
  audioManager.loadSound('level_2_orchestral', {
    src: './assets/audio/music/level_2_orchestral.mp3',
    loop: true, volume: 0.5,
  });
  audioManager.loadSound('level_3_electronic', {
    src: './assets/audio/music/level_3_electronic.mp3',
    loop: true, volume: 0.5,
  });

  // ── SFX ──
  audioManager.loadSound('punch_hit', {
    src: './assets/audio/sfx/punch_hit.wav', volume: 0.6,
  });
  audioManager.loadSound('enemy_death', {
    src: './assets/audio/sfx/enemy_death.ogg', volume: 0.5,
  });
  audioManager.loadSound('fragment_collected', {
    src: './assets/audio/sfx/fragment_collected.mp3', volume: 0.5,
  });
  audioManager.loadSound('portal_activate', {
    src: './assets/audio/sfx/portal_activate.wav', volume: 0.6,
  });
  audioManager.loadSound('boss_hit', {
    src: './assets/audio/sfx/boss_hit.wav', volume: 0.6,
  });
  audioManager.loadSound('boss_phase_change', {
    src: './assets/audio/sfx/boss_phase_change.wav', volume: 0.5,
  });

  // ── Ambient / environmental ──
  audioManager.loadSound('ship_hum', {
    src: './assets/audio/sfx/ship_hum.wav',
    loop: true, volume: 0.3,
  });

    // ── VOICES ──
  audioManager.loadSound('l1_intro', {
    src: './assets/audio/voices/l1_intro.mp3', volume: 1.0,
  });

    // ── AXIOM REVELATION VOICES ──
  audioManager.loadSound('l1_axiom_1', { src: './assets/audio/voices/l1_axiom_1.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_2', { src: './assets/audio/voices/l1_axiom_2.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_3', { src: './assets/audio/voices/l1_axiom_3.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_4', { src: './assets/audio/voices/l1_axiom_4.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_5', { src: './assets/audio/voices/l1_axiom_5.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_6', { src: './assets/audio/voices/l1_axiom_6.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_7', { src: './assets/audio/voices/l1_axiom_7.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_8', { src: './assets/audio/voices/l1_axiom_8.mp3', volume: 1.0 });
  audioManager.loadSound('l1_axiom_9', { src: './assets/audio/voices/l1_axiom_9.mp3', volume: 1.0 });

    // ── LEVEL 2 ENFORCER VOICES ──
  audioManager.loadSound('l2_enforcer_1', { src: './assets/audio/voices/l2_enforcer_1.mp3', volume: 1.0 });
  audioManager.loadSound('l2_enforcer_2', { src: './assets/audio/voices/l2_enforcer_2.mp3', volume: 1.0 });
  audioManager.loadSound('l2_enforcer_3', { src: './assets/audio/voices/l2_enforcer_3.mp3', volume: 1.0 });

    // ── LEVEL 3 ARCHITECT VOICE ──
  audioManager.loadSound('l3_architect_1', { src: './assets/audio/voices/l3_architect_1.mp3', volume: 1.0 });

  
  console.log('🎵 Audio system ready —', Object.keys(audioManager.sounds).length, 'files registered');
}