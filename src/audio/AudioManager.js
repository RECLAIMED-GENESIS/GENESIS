// src/audio/AudioManager.js
// Central audio controller — handles music and SFX via Howler.js

import { Howl } from 'howler';

export class AudioManager {
  constructor() {
    this.sounds = {};
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    this.isMuted = false;
  }

  loadSound(key, config) {
    if (this.sounds[key]) return;
    const sound = new Howl({
      src: [config.src],
      loop: config.loop || false,
      volume: config.volume || 1.0,
      preload: true,
      onloaderror: (id, err) => console.warn(`Audio "${key}" failed:`, err),
    });
    this.sounds[key] = sound;
  }

  // ── SFX ──
  playSfx(key) {
    if (this.isMuted) return;
    const s = this.sounds[key];
    if (!s) { console.warn(`SFX "${key}" not loaded`); return; }
    s.stop();
    const id = s.play();
    s.volume(this.sfxVolume, id);
    return id;
  }

  stopSound(key) {
    const s = this.sounds[key];
    if (s) s.stop();
  }

  // ── Music ──
  playMusic(key) {
    if (this.isMuted) return;
    const s = this.sounds[key];
    if (!s) { console.warn(`Music "${key}" not loaded`); return; }
    if (this.currentMusic) this.currentMusic.stop();
    s.loop(true);
    s.volume(this.musicVolume);
    s.play();
    this.currentMusic = s;
    this.currentMusicKey = key;
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  pauseMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause(this.currentMusicId);
    }
  }

  resumeMusic() {
    if (this.currentMusic) {
      this.currentMusic.play(this.currentMusicId);
    }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.currentMusic) this.currentMusic.volume(this.musicVolume);
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMusic();
    } else if (this.currentMusicKey) {
      // Unmuting must bring the level music back, not just clear the flag
      this.playMusic(this.currentMusicKey);
    }
    return this.isMuted;
  }

  reset() {
    this.stopMusic();
    Object.values(this.sounds).forEach(s => s.stop());
  }
}
