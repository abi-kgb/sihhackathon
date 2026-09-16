import React, { useState } from 'react';
import { Moon, Sun, Eye, EyeOff, Maximize2, Sliders, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cameraService } from '../services/api';

export default function CameraCard({
    camera,
    telemetry,
    onConfigureZones,
    onSelectFocus,
    isFocused = false
}) {
    const [annotated, setAnnotated] = useState(true);
    const [nightMode, setNightMode] = useState(camera.night_mode_enabled || false);
    const [streamError, setStreamError] = useState(false);

    const streamUrl = cameraService.getStreamUrl(camera.id, annotated);
    const hasAlert = telemetry?.active_alerts && telemetry.active_alerts.length > 0;

    const handleToggleNightMode = async (e) => {
        e.stopPropagation();
        try {
            const res = await cameraService.toggleNightMode(camera.id);
            setNightMode(res.data.night_mode_enabled);
        } catch (err) {
            console.error('Failed to toggle night mode', err);
        }
    };

    return (
        <div
            className={`tactical-card tactical-corner ${hasAlert ? 'alert-pulse' : ''}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderColor: hasAlert ? 'var(--accent-crimson)' : 'var(--border-color)',
                backgroundColor: '#000',
                position: 'relative'
            }}
        >
            {/* Camera Header Bar */}
            <div style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(11, 16, 26, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: hasAlert ? 'var(--accent-crimson)' : 'var(--accent-green)',
                        boxShadow: hasAlert ? '0 0 8px var(--accent-crimson)' : '0 0 8px var(--accent-green)'
                    }} />
                    <span style={{ fontWeight: '600', fontSize: '0.82rem', color: '#fff', letterSpacing: '0.5px' }}>
                        {camera.name}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-medium" style={{ fontSize: '0.65rem' }}>
                        {camera.location_bop}
                    </span>
                    {hasAlert && (
                        <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>
                            BREACH
                        </span>
                    )}
                </div>
            </div>

            {/* Live Video Stream Frame */}
            <div style={{
                position: 'relative',
                width: '100%',
                height: isFocused ? '600px' : '280px',
                backgroundColor: '#04070a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                {!streamError ? (
                    <img
                        src={streamUrl}
                        alt={`Stream ${camera.name}`}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }}
                        onError={() => setStreamError(true)}
                    />
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <AlertTriangle size={32} color="var(--accent-amber)" style={{ marginBottom: '8px' }} />
                        <div style={{ fontSize: '0.85rem' }}>Connecting to Camera Stream...</div>
                        <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{camera.stream_url}</div>
                    </div>
                )}

                {/* Scanline CRT overlay effect */}
                <div className="scanline-overlay" />

                {/* Corner Crosshair HUD Overlay */}
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(0, 0, 0, 0.65)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    border: '1px solid rgba(0, 240, 255, 0.25)'
                }}>
                    FPS: {telemetry?.fps || 25.0} | LATENCY: {telemetry?.latency_ms || 12}ms
                </div>

                {/* Tracked Objects Counter */}
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--accent-green)',
                    background: 'rgba(0, 0, 0, 0.65)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    border: '1px solid rgba(0, 255, 157, 0.25)'
                }}>
                    TRACKS: {telemetry?.tracked_objects_count || 0}
                </div>

                {/* Active Breach Warning Banner */}
                {hasAlert && (
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(255, 42, 95, 0.85)',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        <AlertTriangle size={14} />
                        <span>ALERT: {telemetry.active_alerts.join(', ')}</span>
                    </div>
                )}
            </div>

            {/* Camera Control Footer */}
            <div style={{
                padding: '6px 10px',
                backgroundColor: 'rgba(11, 16, 26, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border-color)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={handleToggleNightMode}
                        className={`btn-tactical ${nightMode ? '' : 'btn-secondary'}`}
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title="Toggle Low-Light / Night Enhancement"
                    >
                        {nightMode ? <Moon size={13} color="var(--accent-cyan)" /> : <Sun size={13} />}
                        <span>{nightMode ? 'NIGHT IR ON' : 'NIGHT MODE'}</span>
                    </button>

                    <button
                        onClick={() => setAnnotated(!annotated)}
                        className={`btn-tactical ${annotated ? '' : 'btn-secondary'}`}
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title="Toggle AI Bounding Boxes & Zones"
                    >
                        {annotated ? <Eye size={13} /> : <EyeOff size={13} />}
                        <span>{annotated ? 'AI OVERLAY' : 'RAW FEED'}</span>
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => onConfigureZones(camera)}
                        className="btn-tactical btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title="Draw Virtual Fence / Tripwires"
                    >
                        <Sliders size={13} />
                        <span>ZONES</span>
                    </button>

                    <button
                        onClick={() => onSelectFocus(camera)}
                        className="btn-tactical"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title="Focus Fullscreen"
                    >
                        <Maximize2 size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}
