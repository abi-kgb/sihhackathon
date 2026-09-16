import React, { useState, useEffect } from 'react';
import { Shield, Radio, Volume2, VolumeX, AlertTriangle, Activity, Cpu } from 'lucide-react';
import { tacticalSound } from '../utils/sound';

export default function Navbar({ stats, isMuted, onToggleMute, activeThreatsCount }) {
    const [timeStr, setTimeStr] = useState('');
    const [utcStr, setUtcStr] = useState('');

    useEffect(() => {
        const updateClocks = () => {
            const now = new Date();
            setTimeStr(now.toLocaleTimeString());
            setUtcStr(now.toUTCString().split(' ')[4] + ' UTC');
        };
        updateClocks();
        const interval = setInterval(updateClocks, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header style={{
            height: '65px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'relative',
            zIndex: 50
        }}>
            {/* Left: Brand / Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '6px',
                    background: 'rgba(0, 240, 255, 0.12)',
                    border: '1px solid var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 10px rgba(0, 240, 255, 0.25)'
                }}>
                    <Shield size={22} color="var(--accent-cyan)" />
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '1px', color: '#fff' }}>
                            IBVAP
                        </span>
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            background: 'rgba(0, 255, 157, 0.15)',
                            color: 'var(--accent-green)',
                            border: '1px solid rgba(0, 255, 157, 0.3)',
                            borderRadius: '3px',
                            fontWeight: '600'
                        }}>
                            DEFENSE AI v1.0
                        </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.6px' }}>
                        INTELLIGENT BORDER VIDEO ANALYTICS PLATFORM
                    </span>
                </div>
            </div>

            {/* Center: Live Telemetry Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="tactical-card" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={16} color="var(--accent-green)" />
                    <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CCTV STREAMS</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                            {stats?.active_cameras || 4} / {stats?.total_cameras || 4} ONLINE
                        </div>
                    </div>
                </div>

                <div className="tactical-card" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Cpu size={16} color="var(--accent-cyan)" />
                    <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>AI PIPELINE</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                            {stats?.fps_average || 25.0} FPS AVG
                        </div>
                    </div>
                </div>

                <div className={`tactical-card ${activeThreatsCount > 0 ? 'alert-pulse' : ''}`} style={{
                    padding: '6px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    borderColor: activeThreatsCount > 0 ? 'var(--accent-crimson)' : 'var(--border-color)'
                }}>
                    <AlertTriangle size={16} color={activeThreatsCount > 0 ? 'var(--accent-crimson)' : 'var(--accent-amber)'} />
                    <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ACTIVE THREATS</div>
                        <div style={{
                            fontSize: '0.88rem',
                            fontWeight: '700',
                            fontFamily: 'var(--font-mono)',
                            color: activeThreatsCount > 0 ? 'var(--accent-crimson)' : 'var(--accent-amber)'
                        }}>
                            {activeThreatsCount} INCIDENTS
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Sound Toggle, Test Siren, Clock, Connection Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                    onClick={onToggleMute}
                    className="btn-secondary"
                    style={{
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                    title={isMuted ? "Unmute Alarm" : "Mute Alarm"}
                >
                    {isMuted ? <VolumeX size={16} color="var(--accent-crimson)" /> : <Volume2 size={16} color="var(--accent-green)" />}
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {isMuted ? 'MUTED' : 'AUDIO ON'}
                    </span>
                </button>

                <button
                    onClick={() => tacticalSound.playCriticalAlarm()}
                    className="btn-tactical"
                    style={{
                        padding: '5px 9px',
                        fontSize: '0.72rem',
                        background: 'rgba(255, 42, 95, 0.15)',
                        borderColor: 'rgba(255, 42, 95, 0.4)',
                        color: 'var(--accent-crimson)',
                        cursor: 'pointer'
                    }}
                    title="Test Alarm Sound Siren"
                >
                    TEST SIREN 🔊
                </button>

                <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: '14px' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        {timeStr}
                    </div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {utcStr}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-green)',
                        boxShadow: '0 0 8px var(--accent-green)'
                    }} />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                        SECURE
                    </span>
                </div>
            </div>
        </header>
    );
}
