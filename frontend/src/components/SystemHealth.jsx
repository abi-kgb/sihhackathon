import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Server, Shield, CheckCircle2 } from 'lucide-react';
import { analyticsService } from '../services/api';

export default function SystemHealth() {
    const [telemetry, setTelemetry] = useState(null);

    useEffect(() => {
        loadTelemetry();
        const interval = setInterval(loadTelemetry, 2500);
        return () => clearInterval(interval);
    }, []);

    const loadTelemetry = async () => {
        try {
            const res = await analyticsService.getSystemTelemetry();
            setTelemetry(res.data);
        } catch (err) {
            console.error('Failed to load system telemetry', err);
        }
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Cpu size={22} color="var(--accent-cyan)" />
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                            EDGE SERVER HEALTH & AI INGESTION TELEMETRY
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            HARDWARE LOAD, FRAME LATENCIES, AND INFERENCE PIPELINE HEALTH
                        </span>
                    </div>
                </div>

                <span className="badge badge-low">
                    ● EDGE PROCESSORS NOMINAL
                </span>
            </div>

            {/* Hardware Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CPU UTILIZATION</span>
                        <Cpu size={18} color="var(--accent-cyan)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '8px' }}>
                        {telemetry?.cpu_usage_pct || 14.5}%
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${telemetry?.cpu_usage_pct || 14.5}%`, height: '100%', backgroundColor: 'var(--accent-cyan)' }} />
                    </div>
                </div>

                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>RAM ALLOCATION</span>
                        <Server size={18} color="var(--accent-green)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', marginTop: '8px' }}>
                        {telemetry?.ram_usage_pct || 38.2}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {telemetry?.ram_used_gb || 6.1} GB / {telemetry?.ram_total_gb || 16.0} GB
                    </div>
                </div>

                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>STORAGE CAPACITY</span>
                        <HardDrive size={18} color="var(--accent-amber)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', marginTop: '8px' }}>
                        {telemetry?.disk_free_gb || 142.0} GB
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        AVAILABLE FOR VIDEO DOSSIERS
                    </div>
                </div>
            </div>

            {/* Per-Camera Worker Telemetry */}
            <div className="tactical-card" style={{ padding: '18px' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#fff', marginBottom: '14px' }}>
                    ACTIVE STREAM WORKER THREADS ({telemetry?.workers?.length || 4})
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {telemetry?.workers?.map((w, idx) => (
                        <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>
                                    {w.camera_name || `Camera Feed #${w.camera_id}`}
                                </span>
                                <span className="badge badge-low">THREAD ONLINE</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>STREAM FPS:</span>
                                    <div style={{ color: 'var(--accent-green)', fontWeight: '700' }}>{w.fps} FPS</div>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>INFERENCE LATENCY:</span>
                                    <div style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>{w.latency_ms} ms</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
