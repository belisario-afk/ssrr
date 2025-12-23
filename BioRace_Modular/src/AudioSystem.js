/**
 * AudioSystem - Manages all game audio including music and sound effects
 */
export class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        
        this.sounds = {};
        this.music = null;
        this.musicPlaying = false;
        
        // Volume settings
        this.volumes = {
            master: 0.7,
            music: 0.5,
            sfx: 0.8
        };
        
        this.loadSettings();
        this.initAudioContext();
    }
    
    initAudioContext() {
        // Audio context is created on user interaction to avoid autoplay issues
        this.pendingInit = true;
    }
    
    ensureContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.volumes.master;
            this.masterGain.connect(this.audioContext.destination);
            
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = this.volumes.music;
            this.musicGain.connect(this.masterGain);
            
            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = this.volumes.sfx;
            this.sfxGain.connect(this.masterGain);
            
            this.pendingInit = false;
        }
        
        // Resume if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    /**
     * Generate a simple sound effect using Web Audio API
     * This creates procedural sounds without needing audio files
     */
    generateSound(type) {
        this.ensureContext();
        
        switch(type) {
            case 'boost':
                return this.createBoostSound();
            case 'pickup':
                return this.createPickupSound();
            case 'hit':
                return this.createHitSound();
            case 'gift':
                return this.createGiftSound();
            case 'win':
                return this.createWinSound();
            case 'countdown':
                return this.createCountdownSound();
            default:
                return null;
        }
    }
    
    createBoostSound() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    }
    
    createPickupSound() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
        
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    }
    
    createHitSound() {
        // Create noise burst
        const bufferSize = this.audioContext.sampleRate * 0.2;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        noise.start();
    }
    
    createGiftSound() {
        // Create magical chime sound
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.5);
        });
    }
    
    createWinSound() {
        // Victory fanfare
        const melody = [
            { freq: 523.25, time: 0, duration: 0.2 },     // C5
            { freq: 523.25, time: 0.2, duration: 0.1 },   // C5
            { freq: 523.25, time: 0.3, duration: 0.1 },   // C5
            { freq: 523.25, time: 0.4, duration: 0.2 },   // C5
            { freq: 415.30, time: 0.6, duration: 0.2 },   // Ab4
            { freq: 466.16, time: 0.8, duration: 0.2 },   // Bb4
            { freq: 523.25, time: 1.0, duration: 0.2 },   // C5
            { freq: 466.16, time: 1.25, duration: 0.1 },  // Bb4
            { freq: 523.25, time: 1.4, duration: 0.6 }    // C5
        ];
        
        melody.forEach(note => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'square';
            osc.frequency.value = note.freq;
            
            const startTime = this.audioContext.currentTime + note.time;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.setValueAtTime(0.15, startTime + note.duration - 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.start(startTime);
            osc.stop(startTime + note.duration);
        });
    }
    
    createCountdownSound() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.value = 440;
        
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.1);
    }
    
    /**
     * Play a procedural sound effect
     */
    playSFX(type) {
        this.ensureContext();
        this.generateSound(type);
    }
    
    /**
     * Create procedural background music
     */
    startMusic() {
        this.ensureContext();
        
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        
        // Create a simple ambient drone with pulsing bass
        this.createAmbientMusic();
    }
    
    createAmbientMusic() {
        // Bass drone
        this.bassDrone = this.audioContext.createOscillator();
        this.bassDrone.type = 'sine';
        this.bassDrone.frequency.value = 55; // A1
        
        const bassGain = this.audioContext.createGain();
        bassGain.gain.value = 0.15;
        
        // LFO for pulsing effect
        this.bassLFO = this.audioContext.createOscillator();
        this.bassLFO.frequency.value = 0.5;
        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 0.05;
        
        this.bassLFO.connect(lfoGain);
        lfoGain.connect(bassGain.gain);
        
        this.bassDrone.connect(bassGain);
        bassGain.connect(this.musicGain);
        
        // Pad synth
        this.padOsc1 = this.audioContext.createOscillator();
        this.padOsc2 = this.audioContext.createOscillator();
        this.padOsc1.type = 'triangle';
        this.padOsc2.type = 'triangle';
        this.padOsc1.frequency.value = 110; // A2
        this.padOsc2.frequency.value = 165; // E3
        
        const padGain = this.audioContext.createGain();
        padGain.gain.value = 0.08;
        
        const padFilter = this.audioContext.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 500;
        padFilter.Q.value = 2;
        
        // LFO for filter sweep
        this.filterLFO = this.audioContext.createOscillator();
        this.filterLFO.frequency.value = 0.1;
        const filterLfoGain = this.audioContext.createGain();
        filterLfoGain.gain.value = 200;
        
        this.filterLFO.connect(filterLfoGain);
        filterLfoGain.connect(padFilter.frequency);
        
        this.padOsc1.connect(padFilter);
        this.padOsc2.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(this.musicGain);
        
        // Start everything
        this.bassDrone.start();
        this.bassLFO.start();
        this.padOsc1.start();
        this.padOsc2.start();
        this.filterLFO.start();
    }
    
    stopMusic() {
        if (!this.musicPlaying) return;
        this.musicPlaying = false;
        
        try {
            if (this.bassDrone) this.bassDrone.stop();
            if (this.bassLFO) this.bassLFO.stop();
            if (this.padOsc1) this.padOsc1.stop();
            if (this.padOsc2) this.padOsc2.stop();
            if (this.filterLFO) this.filterLFO.stop();
        } catch (e) {}
    }
    
    /**
     * Set volume levels
     */
    setMasterVolume(value) {
        this.volumes.master = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.value = this.volumes.master;
        }
        this.saveSettings();
    }
    
    setMusicVolume(value) {
        this.volumes.music = Math.max(0, Math.min(1, value));
        if (this.musicGain) {
            this.musicGain.gain.value = this.volumes.music;
        }
        this.saveSettings();
    }
    
    setSFXVolume(value) {
        this.volumes.sfx = Math.max(0, Math.min(1, value));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.volumes.sfx;
        }
        this.saveSettings();
    }
    
    /**
     * Toggle mute
     */
    toggleMute() {
        if (this.masterGain) {
            if (this.masterGain.gain.value > 0) {
                this.previousVolume = this.masterGain.gain.value;
                this.masterGain.gain.value = 0;
                return true; // Now muted
            } else {
                this.masterGain.gain.value = this.previousVolume || this.volumes.master;
                return false; // Now unmuted
            }
        }
        return false;
    }
    
    /**
     * Save/Load settings
     */
    saveSettings() {
        try {
            localStorage.setItem('biorace_audio', JSON.stringify(this.volumes));
        } catch (e) {}
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('biorace_audio');
            if (saved) {
                this.volumes = { ...this.volumes, ...JSON.parse(saved) };
            }
        } catch (e) {}
    }
}

// Singleton instance
let audioInstance = null;

export function getAudioSystem() {
    if (!audioInstance) {
        audioInstance = new AudioSystem();
    }
    return audioInstance;
}
