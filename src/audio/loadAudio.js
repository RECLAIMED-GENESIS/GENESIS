import { AudioManager } from './AudioManager.js';

export function loadAllAudio(audioManager) {
    // Music
    audioManager.loadSound('menu_theme', {
        src: './assets/audio/music/menutheme.ogg',
        loop: true,
        volume: 0.6
    });

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

    // Ambience — the city street: traffic, cars, trams (loops under Level 2)
    audioManager.loadSound('city_ambience', {
        src: './assets/audio/sfx/city_ambience_-_traffic_-_street_-_cars_and_tram.mp3',
        loop: true,
        volume: 0.4
    });

    // UI
    audioManager.loadSound('button_click', {
        src: './assets/audio/sfx/button_click.wav',
        volume: 0.5
    });

    console.log('🎵 All audio assets registered');
}
