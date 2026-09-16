import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Activity, Users, Car, Moon } from 'lucide-react';
import { analyticsService } from '../services/api';

export default function AnalyticsView({ stats }) {
    const [threatData, setThreatData] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await analyticsService.getThreatBreakdown();
            setThreatData(res.data);
        } catch (err) {
            console.error('Failed to load analytics', err);
        }
    };

    const threatCategories = [
        { label: 'VIRTUAL FENCE BREACH', count: threatData?.by_type?.VIRTUAL_FENCE_BREACH || 0, color: '#ff2a5f' },
        { label: 'TRIPWIRE CROSSING', count: threatData?.by_type?.TRIPWIRE_CROSSING || 0, color: '#ffb700' },
        { label: 'FRS POI IDENTIFIED', count: threatData?.by_type?.FRS_WATCHLIST_MATCH || 0, color: '#00f0ff' },
        { label: 'ANPR FLAGGED VEHICLE', count: threatData?.by_type?.ANPR_WATCHLIST_MATCH || 0, color: '#00ff9d' },
        { label: 'NIGHT STEALTH CRAWL', count: threatData?.by_type?.NIGHT_STEALTH_MOVEMENT || 0, color: '#b55fe6' },
        { label: 'SUSPICIOUS LOITERING', count: threatData?.by_type?.SUSPICIOUS_LOITERING || 0, color: '#00f0ff' },
    ];

    const maxCount = Math.max(...threatCategories.map(t => t.count), 1);

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BarChart3 size={22} color="var(--accent-cyan)" />
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                            THREAT ANALYTICS & PATROL INTELLIGENCE
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            CROSS-SECTOR THREAT METRICS & SURVEILLANCE PATTERNS
                        </span>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>INTRUSIONS DETECTED</span>
                        <AlertTriangle size={18} color="var(--accent-crimson)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-crimson)', marginTop: '8px' }}>
                        {stats?.intrusions_detected || 0}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-crimson)', marginTop: '4px' }}>
                        PERIMETER & TRIPWIRE BREACHES
                    </div>
                </div>

                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ANPR VEHICLE HITS</span>
                        <Car size={18} color="var(--accent-amber)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', marginTop: '8px' }}>
                        {stats?.anpr_detections || 0}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', marginTop: '4px' }}>
                        WATCHLIST PLATES INTERCEPTED
                    </div>
                </div>

                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>FRS POI MATCHES</span>
                        <Users size={18} color="var(--accent-cyan)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '8px' }}>
                        {stats?.frs_matches || 0}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                        SUSPECTS POSITIVELY IDENTIFIED
                    </div>
                </div>

                <div className="tactical-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AVERAGE INGESTION FPS</span>
                        <Activity size={18} color="var(--accent-green)" />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', marginTop: '8px' }}>
                        {stats?.fps_average || 25.0}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-green)', marginTop: '4px' }}>
                        REAL-TIME LOW-LATENCY INFERENCE
                    </div>
                </div>
            </div>

            {/* Visual Threat Distribution Chart */}
            <div className="tactical-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                    INCIDENT DISTRIBUTION BY AI ANALYTICS CATEGORY
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {threatCategories.map((cat) => {
                        const pct = (cat.count / maxCount) * 100;
                        return (
                            <div key={cat.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                    <span>{cat.label}</span>
                                    <span style={{ color: cat.color, fontWeight: '700' }}>{cat.count} DETECTIONS</span>
                                </div>
                                <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.max(pct, 4)}%`,
                                        height: '100%',
                                        backgroundColor: cat.color,
                                        boxShadow: `0 0 8px ${cat.color}`,
                                        transition: 'width 0.4s ease'
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
