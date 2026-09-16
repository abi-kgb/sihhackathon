import React, { useState } from 'react';
import { FileSearch, Download, Printer, Filter, Calendar, Camera, ShieldCheck, AlertOctagon } from 'lucide-react';

export default function ForensicSearch({ alerts, cameras }) {
    const [selectedCamera, setSelectedCamera] = useState('ALL');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedSeverity, setSelectedSeverity] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = alerts.filter((a) => {
        if (selectedCamera !== 'ALL' && a.camera_id !== parseInt(selectedCamera)) return false;
        if (selectedType !== 'ALL' && a.alert_type !== selectedType) return false;
        if (selectedSeverity !== 'ALL' && a.severity !== selectedSeverity) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchTitle = a.title.toLowerCase().includes(term);
            const matchDesc = (a.description || '').toLowerCase().includes(term);
            const matchLoc = (a.bop_location || '').toLowerCase().includes(term);
            if (!matchTitle && !matchDesc && !matchLoc) return false;
        }
        return true;
    });

    const handlePrintDossier = () => {
        window.print();
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileSearch size={22} color="var(--accent-cyan)" />
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                            FORENSIC VIDEO EVIDENCE & INCIDENT SEARCH
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            HISTORICAL BREACH DOSSIER & MULTI-CAMERA INCIDENT AUDIT
                        </span>
                    </div>
                </div>

                <button
                    onClick={handlePrintDossier}
                    className="btn-tactical"
                    style={{ padding: '7px 14px' }}
                >
                    <Printer size={15} /> EXPORT / PRINT DOSSIER
                </button>
            </div>

            {/* Filter Bar */}
            <div className="tactical-card" style={{ padding: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <input
                        type="text"
                        placeholder="Search incidents, vehicles, keywords..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: '#fff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                        }}
                    />
                </div>

                <div>
                    <select
                        value={selectedCamera}
                        onChange={(e) => setSelectedCamera(e.target.value)}
                        style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
                    >
                        <option value="ALL">ALL CAMERAS</option>
                        {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
                    >
                        <option value="ALL">ALL EVENT TYPES</option>
                        <option value="VIRTUAL_FENCE_BREACH">Virtual Fence Breach</option>
                        <option value="TRIPWIRE_CROSSING">Tripwire Crossing</option>
                        <option value="FRS_WATCHLIST_MATCH">FRS POI Match</option>
                        <option value="ANPR_WATCHLIST_MATCH">ANPR Flagged Vehicle</option>
                        <option value="SUSPICIOUS_LOITERING">Suspicious Loitering</option>
                        <option value="NIGHT_STEALTH_MOVEMENT">Night Stealth Crawl</option>
                    </select>
                </div>

                <div>
                    <select
                        value={selectedSeverity}
                        onChange={(e) => setSelectedSeverity(e.target.value)}
                        style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
                    >
                        <option value="ALL">ALL SEVERITIES</option>
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                    </select>
                </div>

                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Found {filtered.length} Records
                </span>
            </div>

            {/* Results Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filtered.map((item) => (
                    <div key={item.id} className="tactical-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ height: '170px', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            {item.snapshot_path ? (
                                <img
                                    src={`http://localhost:8000${item.snapshot_path}`}
                                    alt="Forensic Frame"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <Camera size={30} />
                                </div>
                            )}
                            <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px'
                            }}>
                                <span className={`badge ${item.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                                    {item.severity}
                                </span>
                            </div>
                        </div>

                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#fff' }}>
                            {item.title}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {item.description}
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            borderTop: '1px solid var(--border-color)',
                            paddingTop: '6px',
                            marginTop: 'auto'
                        }}>
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                            <span>{item.bop_location}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
