import React, { useState } from 'react';
import {
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Search,
    Filter,
    Camera,
    Clock,
    Eye,
    Trash2,
    Shield,
    ExternalLink
} from 'lucide-react';
import { alertService } from '../services/api';

export default function AlertFeed({ alerts, onRefreshAlerts, onAlertStatusUpdated }) {
    const [filterSeverity, setFilterSeverity] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedSnapshot, setSelectedSnapshot] = useState(null);
    const [operatorNoteInput, setOperatorNoteInput] = useState({});

    const filteredAlerts = alerts.filter((a) => {
        if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
        if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
        if (filterType !== 'ALL' && a.alert_type !== filterType) return false;
        return true;
    });

    const handleUpdateStatus = async (alertId, newStatus) => {
        try {
            const note = operatorNoteInput[alertId] || undefined;
            await alertService.updateStatus(alertId, { status: newStatus, operator_notes: note });
            if (onAlertStatusUpdated) onAlertStatusUpdated();
            if (onRefreshAlerts) onRefreshAlerts();
        } catch (err) {
            console.error('Failed to update alert status', err);
        }
    };

    const handleClearAll = async () => {
        if (window.confirm('Are you sure you want to clear all alert logs?')) {
            try {
                await alertService.clearAll();
                if (onRefreshAlerts) onRefreshAlerts();
            } catch (err) {
                console.error('Failed to clear alerts', err);
            }
        }
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            {/* Header Toolbar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldAlert size={22} color="var(--accent-crimson)" />
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                            THREAT & INCIDENT RESPONSE DESK
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            REAL-TIME SECURITY BREACH TRIAGE & EVIDENCE AUDIT
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value)}
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                        }}
                    >
                        <option value="ALL">ALL SEVERITIES</option>
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                        }}
                    >
                        <option value="ALL">ALL STATUSES</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                        <option value="INVESTIGATING">INVESTIGATING</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="FALSE_ALARM">FALSE ALARM</option>
                    </select>

                    <button
                        onClick={handleClearAll}
                        className="btn-tactical btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                        <Trash2 size={14} /> CLEAR LOGS
                    </button>
                </div>
            </div>

            {/* Alert Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredAlerts.map((alert) => {
                    const isCritical = alert.severity === 'CRITICAL';
                    const isActive = alert.status === 'ACTIVE';

                    let plateNumber = null;
                    try {
                        if (alert.metadata_json) {
                            const meta = typeof alert.metadata_json === 'string' ? JSON.parse(alert.metadata_json) : alert.metadata_json;
                            plateNumber = meta?.plate_number;
                        }
                    } catch (e) {}
                    if (!plateNumber && (alert.object_type === 'vehicle' || alert.title.includes('Vehicle') || alert.title.includes('Car'))) {
                        const m = alert.title.match(/\[([A-Za-z0-9#\-]+)\]/);
                        if (m) plateNumber = m[1];
                    }

                    return (
                        <div
                            key={alert.id}
                            className={`tactical-card ${isCritical && isActive ? 'alert-pulse' : ''}`}
                            style={{
                                padding: '14px',
                                borderLeft: `4px solid ${isCritical ? 'var(--accent-crimson)' : 'var(--accent-amber)'}`,
                                display: 'grid',
                                gridTemplateColumns: '140px 1fr 220px',
                                gap: '16px',
                                alignItems: 'center'
                            }}
                        >
                            {/* Evidence Snapshot */}
                            <div
                                style={{
                                    width: '140px',
                                    height: '90px',
                                    backgroundColor: '#000',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: '1px solid var(--border-color)'
                                }}
                                onClick={() => setSelectedSnapshot(`http://localhost:8000${alert.snapshot_path}`)}
                            >
                                {alert.snapshot_path ? (
                                    <img
                                        src={`http://localhost:8000${alert.snapshot_path}`}
                                        alt="Evidence"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                        <Camera size={24} />
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'rgba(0,0,0,0.7)',
                                    fontSize: '0.62rem',
                                    textAlign: 'center',
                                    padding: '2px',
                                    color: 'var(--accent-cyan)'
                                }}>
                                    VIEW EVIDENCE
                                </div>
                            </div>

                            {/* Center: Incident Details with Car Number Badge */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className={`badge ${isCritical ? 'badge-critical' : 'badge-high'}`}>
                                        {alert.severity}
                                    </span>
                                    <span className="badge badge-medium">
                                        {alert.alert_type.replace(/_/g, ' ')}
                                    </span>
                                    {plateNumber && (
                                        <span style={{
                                            backgroundColor: 'rgba(255, 183, 0, 0.15)',
                                            border: '1px solid var(--accent-amber)',
                                            color: 'var(--accent-amber)',
                                            padding: '2px 8px',
                                            borderRadius: '3px',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
                                            🚗 CAR NUMBER: {plateNumber}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                        {new Date(alert.created_at).toLocaleString()}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff' }}>
                                    {alert.title}
                                </div>

                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    {alert.description}
                                </div>

                                <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    <span>CAM: {alert.camera_name}</span>
                                    <span>LOCATION: {alert.bop_location}</span>
                                    <span>CONFIDENCE: {(alert.confidence * 100).toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Right: Triage Workflow Action Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STATUS:</span>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: '700',
                                        fontFamily: 'var(--font-mono)',
                                        color: alert.status === 'RESOLVED' ? 'var(--accent-green)' : alert.status === 'ACTIVE' ? 'var(--accent-crimson)' : 'var(--accent-amber)'
                                    }}>
                                        {alert.status}
                                    </span>
                                </div>

                                {alert.status === 'ACTIVE' && (
                                    <button
                                        onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                                        className="btn-tactical"
                                        style={{ padding: '6px', fontSize: '0.75rem', width: '100%' }}
                                    >
                                        ACKNOWLEDGE
                                    </button>
                                )}

                                {alert.status !== 'INVESTIGATING' && alert.status !== 'RESOLVED' && (
                                    <button
                                        onClick={() => handleUpdateStatus(alert.id, 'INVESTIGATING')}
                                        className="btn-tactical btn-secondary"
                                        style={{ padding: '6px', fontSize: '0.75rem', width: '100%' }}
                                    >
                                        DISPATCH PATROL
                                    </button>
                                )}

                                {alert.status !== 'RESOLVED' && (
                                    <button
                                        onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                                        className="btn-tactical"
                                        style={{
                                            padding: '6px',
                                            fontSize: '0.75rem',
                                            width: '100%',
                                            borderColor: 'var(--accent-green)',
                                            color: 'var(--accent-green)',
                                            background: 'rgba(0, 255, 157, 0.1)'
                                        }}
                                    >
                                        <CheckCircle2 size={13} /> RESOLVE
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredAlerts.length === 0 && (
                    <div className="tactical-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Shield size={40} color="var(--accent-green)" style={{ marginBottom: '10px' }} />
                        <div style={{ fontSize: '1.05rem', color: '#fff' }}>No Active Security Incidents</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>All border sectors currently reporting nominal conditions.</div>
                    </div>
                )}
            </div>

            {/* Snapshot Zoom Modal */}
            {selectedSnapshot && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '20px'
                    }}
                    onClick={() => setSelectedSnapshot(null)}
                >
                    <div
                        className="tactical-card"
                        style={{ padding: '16px', maxWidth: '800px', width: '100%', backgroundColor: 'var(--bg-secondary)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                                FORENSIC EVIDENCE SNAPSHOT
                            </span>
                            <button
                                onClick={() => setSelectedSnapshot(null)}
                                className="btn-tactical btn-secondary"
                                style={{ padding: '4px 8px' }}
                            >
                                CLOSE
                            </button>
                        </div>
                        <img
                            src={selectedSnapshot}
                            alt="Snapshot Full Evidence"
                            style={{ width: '100%', maxHeight: '550px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
