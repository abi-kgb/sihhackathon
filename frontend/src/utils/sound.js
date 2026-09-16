// Web Audio API Tactical Sound Synthesizer (No external mp3/wav files required)

class TacticalSoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this._initUserGestureUnlock();
    }

    _initUserGestureUnlock() {
        if (typeof window !== 'undefined') {
            const unlock = () => {
                this._getAudioContext();
                ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => 
                    window.removeEventListener(ev, unlock)
                );
            };
            ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => 
                window.addEventListener(ev, unlock, { once: true, passive: true })
            );
        }
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

    playCriticalAlarm() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        try {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            const now = ctx.currentTime;
            
            // Pulsing emergency warble siren
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(1500, now + 0.15);
            osc.frequency.linearRampToValueAtTime(800, now + 0.30);
            osc.frequency.linearRampToValueAtTime(1500, now + 0.45);
            osc.frequency.linearRampToValueAtTime(800, now + 0.60);

            // Louder, clear audible volume
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.65);
        } catch (err) {
            console.error('[Audio] Critical alarm playback error:', err);
        }
    }

    playWarningBeep() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        try {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.exponentialRampToValueAtTime(1100, now + 0.18);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.22);
        } catch (err) {
            console.error('[Audio] Warning beep error:', err);
        }
    }

    playRadarPing() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        try {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.35);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

    playAccessGrantedChime() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        try {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const now = ctx.currentTime;
            
            // First chime tone (587Hz / D5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(587, now);
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.25);

            // Second higher chime tone (880Hz / A5)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(880, now + 0.12);
            gain2.gain.setValueAtTime(0.35, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.45);
        } catch (err) {
            console.error('[Audio] Access granted chime error:', err);
        }
    }
}

export const tacticalSound = new TacticalSoundEngine();

