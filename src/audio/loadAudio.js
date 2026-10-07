import { AudioManager } from './AudioManager.js';

export function loadAllAudio(audioManager) {
    // Music
    audioManager.loadSound('level_1_chiptune', {
        src: './assets/audio/music/level_1_chiptune.mp3',
        loop: true,
        volume: 0.7
    });

    audioManager.loadSound('level_2_orchestral', {
        src: './assets/audio/music/level_2_orchestral.mp3',
        loop: true,
        volume: 0.7
    });

    audioManager.loadSound('level_3_electronic', {
        src: './assets/audio/music/level_3_electronic.mp3',
        loop: true,
        volume: 0.7
    });

           // SFX
    audioManager.loadSound('punch_hit', {
        src: './assets/audio/sfx/punch_hit.wav',
        volume: 0.6
    });
    audioManager.loadSound('enemy_death', {
        src: './assets/audio/sfx/enemy_death.ogg',
        volume: 0.5
    });
    audioManager.loadSound('fragment_collected', {
        src: './assets/audio/sfx/fragment_collected.mp3',
        volume: 0.4
    });
    audioManager.loadSound('portal_activate', {
        src: './assets/audio/sfx/portal_activate.wav',
        volume: 0.5
    });
    audioManager.loadSound('boss_hit', {
        src: './assets/audio/sfx/boss_hit.wav',
        volume: 0.8
    });
    audioManager.loadSound('boss_phase_change', {
        src: './assets/audio/sfx/boss_phase_change.wav',
        volume: 0.8
    });

    console.log('🎵 All audio assets registered');
}