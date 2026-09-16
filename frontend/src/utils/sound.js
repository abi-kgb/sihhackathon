// Ultra-Reliable Tactical Sound Engine with WebAudio API & HTML5 Audio fallback

class TacticalSoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.unlocked = false;
        this._setupAutoUnlock();
    }

    _setupAutoUnlock() {
        if (typeof window === 'undefined') return;
        const unlock = () => {
            this.unlocked = true;
            this._getAudioContext();
            ['click', 'mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach((e) => {
                window.removeEventListener(e, unlock);
            });
        };
        ['click', 'mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach((e) => {
            window.addEventListener(e, unlock, { once: true, passive: true });
        });
    }

    _getAudioContext() {
        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return this.ctx;
        } catch (e) {
            return null;
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
    }

    // High-impact Critical Intrusion Alarm (Loud alternating dual-tone emergency siren)
    playCriticalAlarm() {
        if (this.isMuted) return;

        const ctx = this._getAudioContext();
        if (ctx) {
            try {
                if (ctx.state === 'suspended') ctx.resume();

                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                // Sawtooth gives aggressive military/police alarm timbre
                osc.type = 'sawtooth';

                // Alternating fast siren sweep (900Hz -> 1800Hz -> 900Hz -> 1800Hz)
                osc.frequency.setValueAtTime(900, now);
                osc.frequency.linearRampToValueAtTime(1800, now + 0.18);
                osc.frequency.linearRampToValueAtTime(900, now + 0.36);
                osc.frequency.linearRampToValueAtTime(1800, now + 0.54);
                osc.frequency.linearRampToValueAtTime(900, now + 0.72);

                // High Volume
                gain.gain.setValueAtTime(0.65, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.78);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.80);
                return;
            } catch (err) {
                console.warn('[Audio] WebAudio siren failed, trying WAV fallback', err);
            }
        }

        // Fallback: Synthesized beep buzzer
        this._playFallbackBuzzer(1200, 0.6);
    }

    // Warning Beep for moderate alerts
    playWarningBeep() {
        if (this.isMuted) return;

        const ctx = this._getAudioContext();
        if (ctx) {
            try {
                if (ctx.state === 'suspended') ctx.resume();

                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18);

                gain.gain.setValueAtTime(0.45, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.22);
                return;
            } catch (err) {
                console.warn('[Audio] Warning beep fallback', err);
            }
        }

        this._playFallbackBuzzer(800, 0.2);
    }

    // Access Granted / Authorized Whitelist Chime
    playAccessGrantedChime() {
        if (this.isMuted) return;

        const ctx = this._getAudioContext();
        if (ctx) {
            try {
                if (ctx.state === 'suspended') ctx.resume();

                const now = ctx.currentTime;

                // Positive 2-tone chime
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(659.25, now); // E5
                gain1.gain.setValueAtTime(0.4, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.25);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1046.50, now + 0.14); // C6
                gain2.gain.setValueAtTime(0.45, now + 0.14);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(now + 0.14);
                osc2.stop(now + 0.45);
                return;
            } catch (err) {
                console.warn('[Audio] Chime fallback', err);
            }
        }
    }

    // Standalone PCM WAV Data-URI Synthesizer Fallback
    _playFallbackBuzzer(freq, durationSec) {
        try {
            const sampleRate = 8000;
            const numSamples = Math.floor(sampleRate * durationSec);
            const buffer = new Uint8Array(44 + numSamples);

            // WAV Header
            const writeStr = (offset, str) => {
                for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
            };
            const writeUint32 = (offset, val) => {
                buffer[offset] = val & 0xff;
                buffer[offset + 1] = (val >> 8) & 0xff;
                buffer[offset + 2] = (val >> 16) & 0xff;
                buffer[offset + 3] = (val >> 24) & 0xff;
            };
            const writeUint16 = (offset, val) => {
                buffer[offset] = val & 0xff;
                buffer[offset + 1] = (val >> 8) & 0xff;
            };

            writeStr(0, 'RIFF');
            writeUint32(4, 36 + numSamples);
            writeStr(8, 'WAVE');
            writeStr(12, 'fmt ');
            writeUint32(16, 16);
            writeUint16(20, 1); // PCM
            writeUint16(22, 1); // Mono
            writeUint32(24, sampleRate);
            writeUint32(28, sampleRate);
            writeUint16(32, 1);
            writeUint16(34, 8); // 8-bit
            writeStr(36, 'data');
            writeUint32(40, numSamples);

            // Generate Square Waveform
            for (let i = 0; i < numSamples; i++) {
                const t = i / sampleRate;
                const sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 220 : 35;
                buffer[44 + i] = sample;
            }

            let binary = '';
            for (let i = 0; i < buffer.length; i++) {
                binary += String.fromCharCode(buffer[i]);
            }
            const base64 = btoa(binary);
            const audio = new Audio('data:audio/wav;base64,' + base64);
            audio.volume = 0.8;
            audio.play().catch(() => {});
        } catch (e) {
            console.error('[Audio] WAV buzzer fallback failed', e);
        }
    }
}

export const tacticalSound = new TacticalSoundEngine();

