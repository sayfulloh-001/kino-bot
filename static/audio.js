/**
 * Web Audio API Retro Sound Synthesizer.
 */
import { saveManager } from './save.js';

class AudioManager {
    constructor() {
        this.ctx = null;
        this.bgmVolumeNode = null;
        this.sfxVolumeNode = null;
        this.bgmInterval = null;
        this.bgmPlaying = false;
        
        // Melodies
        this.notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C major scale
    }

    // Lazy initialization on user interaction to comply with browser autoplay policies
    init() {
        if (this.ctx) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Set up BGM volume node
            this.bgmVolumeNode = this.ctx.createGain();
            this.bgmVolumeNode.gain.setValueAtTime(saveManager.data.settings.bgmVolume, this.ctx.currentTime);
            this.bgmVolumeNode.connect(this.ctx.destination);

            // Set up SFX volume node
            this.sfxVolumeNode = this.ctx.createGain();
            this.sfxVolumeNode.gain.setValueAtTime(saveManager.data.settings.sfxVolume, this.ctx.currentTime);
            this.sfxVolumeNode.connect(this.ctx.destination);
        } catch (e) {
            console.error("Web Audio API not supported:", e);
        }
    }

    playBGM() {
        this.init();
        if (!this.ctx || this.bgmPlaying) return;

        this.bgmPlaying = true;
        let noteIndex = 0;
        const melody = [4, 4, 5, 6, 5, 4, 3, 2, 4, 4, 5, 4, 3, 2, 1, 1];
        const tempo = 150; // Milliseconds per note

        this.bgmInterval = setInterval(() => {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            
            const note = melody[noteIndex];
            const freq = this.notes[note % this.notes.length];
            
            this.playSynthNote(freq, 0.12);
            noteIndex = (noteIndex + 1) % melody.length;
        }, tempo);
    }

    stopBGM() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
        this.bgmPlaying = false;
    }

    setBGMVolume(val) {
        saveManager.data.settings.bgmVolume = val;
        saveManager.save();
        if (this.bgmVolumeNode) {
            this.bgmVolumeNode.gain.setValueAtTime(val, this.ctx.currentTime);
        }
    }

    setSFXVolume(val) {
        saveManager.data.settings.sfxVolume = val;
        saveManager.save();
        if (this.sfxVolumeNode) {
            this.sfxVolumeNode.gain.setValueAtTime(val, this.ctx.currentTime);
        }
    }

    playSynthNote(freq, duration) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.bgmVolumeNode);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playSFX(type) {
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        switch (type) {
            case 'jump': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.connect(gain);
                gain.connect(this.sfxVolumeNode);
                osc.start();
                osc.stop(now + 0.2);
                break;
            }
            case 'footstep': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(80, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.05);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.connect(gain);
                gain.connect(this.sfxVolumeNode);
                osc.start();
                osc.stop(now + 0.05);
                break;
            }
            case 'coin': {
                const osc = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(987.77, now); // B5
                osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
                
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.51, now);
                osc2.frequency.setValueAtTime(1975.53, now + 0.08); // B6
                
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                
                osc.connect(gain);
                osc2.connect(gain);
                gain.connect(this.sfxVolumeNode);
                
                osc.start();
                osc2.start();
                osc.stop(now + 0.3);
                osc2.stop(now + 0.3);
                break;
            }
            case 'powerup': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.1);
                osc.frequency.linearRampToValueAtTime(450, now + 0.2);
                osc.frequency.linearRampToValueAtTime(900, now + 0.4);
                
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                
                osc.connect(gain);
                gain.connect(this.sfxVolumeNode);
                osc.start();
                osc.stop(now + 0.4);
                break;
            }
            case 'crash': {
                // Synthesize explosion noise buffer
                const bufferSize = this.ctx.sampleRate * 0.4;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                const noiseNode = this.ctx.createBufferSource();
                noiseNode.buffer = buffer;
                
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, now);
                filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
                
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.8, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                
                noiseNode.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxVolumeNode);
                
                noiseNode.start();
                noiseNode.stop(now + 0.4);
                break;
            }
            case 'shield_break': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.linearRampToValueAtTime(220, now + 0.25);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(this.sfxVolumeNode);
                osc.start();
                osc.stop(now + 0.25);
                break;
            }
            case 'shoot': {
                // Short retro laser gun sound (descending oscillator)
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(this.sfxVolumeNode);
                osc.start();
                osc.stop(now + 0.12);
                break;
            }
            case 'shatter': {
                // Quick block break sound
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(30, now + 0.18);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc.connect(gain);
                gain.connect(this.sfxVolumeNode);
                osc.start();
                osc.stop(now + 0.18);
                break;
            }
        }
    }
}

export const audioManager = new AudioManager();
export default audioManager;
