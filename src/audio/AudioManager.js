import { Howl, Howler } from 'howler';

export class AudioManager {
    constructor() {
        this.sounds = {};
        this.currentMusic = null;
        this.currentMusicId = null;
        this.ambience = null;
        this.ambienceId = null;
        this.isMuted = false;
        this.masterVolume = 1.0;
        this.musicVolume = 0.7;
        this.sfxVolume = 0.8;
        this.currentTrack = null;
    }

    loadSound(key, config) {
        if (this.sounds[key]) {
            console.warn(`Sound "${key}" already loaded, skipping`);
            return;
        }
        const sound = new Howl({
            src: [config.src],
            volume: config.volume || 1.0,
            loop: config.loop || false,
            autoplay: false,
            preload: true,
            onload: () => {
                console.log(`✅ Sound loaded: ${key}`);
            },
            onloaderror: (id, error) => {
                console.error(`❌ Failed to load sound: ${key}`, error);
            }
        });
        this.sounds[key] = sound;
        return sound;
    }

    playSfx(key) {
        if (this.isMuted) return;
        const sound = this.sounds[key];
        if (!sound) {
            console.warn(`Sound "${key}" not found`);
            return;
        }
        sound.stop();
        const id = sound.play();
        sound.volume(this.sfxVolume, id);
        return id;
    }

    playMusic(key) {
        if (this.isMuted) return;
        const sound = this.sounds[key];
        if (!sound) {
            console.warn(`Music "${key}" not found`);
            return;
        }
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
            this.currentMusicId = null;
        }
        sound.loop(true);
        const id = sound.play();
        sound.volume(this.musicVolume, id);
        this.currentMusic = sound;
        this.currentMusicId = id;
        this.currentTrack = key;
        return id;
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
            this.currentMusicId = null;
            this.currentTrack = null;
        }
    }

    // ---- user settings (persisted by the caller) ----
    setMusicVolume(v) {
        this.musicVolume = Math.max(0, Math.min(1, v));
        if (this.currentMusic && this.currentMusicId != null) {
            this.currentMusic.volume(this.isMuted ? 0 : this.musicVolume, this.currentMusicId);
        }
        if (this.ambience && this.ambienceId != null) {
            this.ambience.volume(this.isMuted ? 0 : this.musicVolume * 0.5, this.ambienceId);
        }
    }

    setSfxVolume(v) {
        this.sfxVolume = Math.max(0, Math.min(1, v));
    }

    setMuted(m) {
        this.isMuted = !!m;
        try { Howler.mute(this.isMuted); } catch (e) {}
    }

    reset() {
        this.stopMusic();
        this.stopAmbience();
        Object.values(this.sounds).forEach(sound => {
            sound.stop();
        });
        this.currentTrack = null;
    }

    // ---- looping ambience bed (runs under the music, follows its volume) ----
    playAmbience(key) {
        if (this.isMuted) return;
        const sound = this.sounds[key];
        if (!sound) {
            console.warn(`Ambience "${key}" not found`);
            return;
        }
        if (this.ambience === sound) return;      // already bedded
        this.stopAmbience();
        sound.loop(true);
        const id = sound.play();
        sound.volume(this.musicVolume * 0.5, id);
        this.ambience = sound;
        this.ambienceId = id;
    }

    stopAmbience() {
        if (this.ambience) {
            this.ambience.stop();
            this.ambience = null;
            this.ambienceId = null;
        }
    }

    playLevelMusic(level) {
        const musicMap = {
            1: 'level_1_chiptune',
            2: 'level_2_orchestral',
            3: 'level_3_electronic'
        };
        const track = musicMap[level];
        if (track && this.sounds[track]) {
            this.playMusic(track);
        }
    }
}
