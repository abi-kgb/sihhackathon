// Web Audio API Tactical Sound Synthesizer (No external mp3/wav files required)

class TacticalSoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    _getAudioContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    setMuted(muted) {
        this.isMuted = muted;
    }

    playCriticalAlarm() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        // Warbling dual-tone siren
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.15);
        osc.frequency.linearRampToValueAtTime(880, now + 0.3);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.45);
        osc.frequency.linearRampToValueAtTime(880, now + 0.6);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.65);
    }

    playWarningBeep() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(950, now + 0.15);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    playRadarPing() {
        if (this.isMuted) return;
        const ctx = this._getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.35);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
    }
}

export const tacticalSound = new TacticalSoundEngine();
