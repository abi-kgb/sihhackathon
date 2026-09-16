import React, { useState, useEffect } from 'react';
import { Users, Car, Plus, Trash2, ShieldAlert, Upload, CheckCircle2, UserCheck } from 'lucide-react';
import { watchlistService } from '../services/api';

export default function WatchlistManager({ activeTab = 'frs' }) {
    const tab = activeTab; // Controlled exclusively by left sidebar navigation
    const [persons, setPersons] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);

    // FRS Person Form
    const [pName, setPName] = useState('');
    const [pAlias, setPAlias] = useState('');
    const [pNationalId, setPNationalId] = useState('');
    const [pCategory, setPCategory] = useState('cross_border_infiltrator');
    const [pThreat, setPThreat] = useState('CRITICAL');
    const [pNotes, setPNotes] = useState('');
    const [pPhoto, setPPhoto] = useState(null);

    // ANPR Vehicle Form
    const [vPlate, setVPlate] = useState('');
    const [vType, setVType] = useState('SUV');
    const [vColor, setVColor] = useState('Black');
    const [vMake, setVMake] = useState('Mahindra Scorpio');
    const [vOwner, setVOwner] = useState('');
    const [vCategory, setVCategory] = useState('suspected_smuggling');
    const [vThreat, setVThreat] = useState('HIGH');
    const [vNotes, setVNotes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [pRes, vRes] = await Promise.all([
                watchlistService.getPersons(),
                watchlistService.getVehicles()
            ]);
            setPersons(pRes.data);
            setVehicles(vRes.data);
        } catch (err) {
            console.error('Failed to load watchlists', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePerson = async (e) => {
        e.preventDefault();
        if (!pName.trim()) return;

        const formData = new FormData();
        formData.append('name', pName);
        if (pAlias) formData.append('alias', pAlias);
        if (pNationalId) formData.append('national_id', pNationalId);
        formData.append('category', pCategory);
        formData.append('threat_level', pThreat);
        if (pNotes) formData.append('notes', pNotes);
        if (pPhoto) formData.append('photo', pPhoto);

        try {
            await watchlistService.createPerson(formData);
            setPName('');
            setPAlias('');
            setPNationalId('');
            setPNotes('');
            setPPhoto(null);
            loadData();
        } catch (err) {
            console.error('Failed to create person', err);
            alert('Failed to register person');
        }
    };

    const handleDeletePerson = async (id) => {
        try {
            await watchlistService.deletePerson(id);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateVehicle = async (e) => {
        e.preventDefault();
        if (!vPlate.trim()) return;

        try {
            await watchlistService.createVehicle({
                plate_number: vPlate,
                vehicle_type: vType,
                color: vColor,
                make_model: vMake,
                owner_name: vOwner,
                category: vCategory,
                threat_level: vThreat,
                notes: vNotes
            });
            setVPlate('');
            setVOwner('');
            setVNotes('');
            loadData();
        } catch (err) {
            console.error('Failed to create vehicle', err);
            alert('Failed to register vehicle (ensure plate number is unique)');
        }
    };

    const handleDeleteVehicle = async (id) => {
        try {
            await watchlistService.deleteVehicle(id);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            {/* Module Header without top-right buttons (Left sidebar controls view) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {tab === 'frs' ? (
                        <Users size={24} color="var(--accent-cyan)" />
                    ) : (
                        <Car size={24} color="var(--accent-amber)" />
                    )}
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                            {tab === 'frs' ? 'FRS BIOMETRIC WATCHLIST & PERSONS OF INTEREST (POI)' : 'ANPR VEHICLE WATCHLIST & HOTLIST DATABASE'}
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {tab === 'frs'
                                ? `SOFTWARE-DEFINED FACIAL RECOGNITION DATABASE (${persons.length} ENROLLED SUBJECTS)`
                                : `AUTOMATIC NUMBER PLATE RECOGNITION REGISTRY (${vehicles.length} MONITORED PLATES)`}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-medium">
                        {tab === 'frs' ? `${persons.length} PERSONS` : `${vehicles.length} VEHICLES`}
                    </span>
                </div>
            </div>

            {/* TAB 1: FRS PERSONS */}
            {tab === 'frs' && (
                <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px' }}>
                    {/* Enrollment Form */}
                    <form onSubmit={handleCreatePerson} className="tactical-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                            ENROLL PERSON OF INTEREST (POI)
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>FULL NAME *</label>
                            <input
                                type="text"
                                required
                                value={pName}
                                onChange={(e) => setPName(e.target.value)}
                                placeholder="e.g. Tariq Ahmad"
                                style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ALIAS / CODENAME</label>
                                <input
                                    type="text"
                                    value={pAlias}
                                    onChange={(e) => setPAlias(e.target.value)}
                                    placeholder="e.g. Abu Zubair"
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NATIONAL ID</label>
                                <input
                                    type="text"
                                    value={pNationalId}
                                    onChange={(e) => setPNationalId(e.target.value)}
                                    placeholder="e.g. X9821447"
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CATEGORY</label>
                                <select
                                    value={pCategory}
                                    onChange={(e) => setPCategory(e.target.value)}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    <option value="cross_border_infiltrator">Infiltrator</option>
                                    <option value="wanted_terrorist">Wanted Terrorist</option>
                                    <option value="smuggler">Smuggler</option>
                                    <option value="vip_authorized">VIP / Friendly</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>THREAT LEVEL</label>
                                <select
                                    value={pThreat}
                                    onChange={(e) => setPThreat(e.target.value)}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    <option value="CRITICAL">CRITICAL</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="LOW">LOW</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BIOMETRIC PHOTO (FOR 128-DIM FRS VECTOR)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setPPhoto(e.target.files[0])}
                                style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px', fontSize: '0.75rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>INTEL NOTES</label>
                            <textarea
                                value={pNotes}
                                onChange={(e) => setPNotes(e.target.value)}
                                rows={2}
                                placeholder="Intel summary and background..."
                                style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px', resize: 'none' }}
                            />
                        </div>

                        <button type="submit" className="btn-tactical" style={{ width: '100%', padding: '9px' }}>
                            <Plus size={16} /> ENROLL INTO FRS DATABASE
                        </button>
                    </form>

                    {/* Persons Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {persons.map((p) => (
                            <div key={p.id} className="tactical-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#fff' }}>{p.name}</div>
                                            {p.alias && <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Alias: "{p.alias}"</div>}
                                        </div>
                                        <span className={`badge ${p.threat_level === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                                            {p.threat_level}
                                        </span>
                                    </div>

                                    <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <div>CATEGORY: <strong style={{ color: '#fff' }}>{p.category.replace(/_/g, ' ').toUpperCase()}</strong></div>
                                        {p.national_id && <div>ID: {p.national_id}</div>}
                                        {p.notes && <div style={{ marginTop: '6px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{p.notes}</div>}
                                    </div>
                                </div>

                                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                                        {p.face_embedding ? '● FRS VECTOR ACTIVE' : '○ HEURISTIC PROFILE'}
                                    </span>
                                    <button
                                        onClick={() => handleDeletePerson(p.id)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)' }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: ANPR VEHICLES */}
            {tab === 'anpr' && (
                <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px' }}>
                    {/* Vehicle Enrollment Form */}
                    <form onSubmit={handleCreateVehicle} className="tactical-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                            REGISTER WATCHLIST VEHICLE
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PLATE NUMBER (ALPHANUMERIC) *</label>
                            <input
                                type="text"
                                required
                                value={vPlate}
                                onChange={(e) => setVPlate(e.target.value.toUpperCase())}
                                placeholder="e.g. JK02AB9871"
                                style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-amber)', fontWeight: '700', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VEHICLE TYPE</label>
                                <select
                                    value={vType}
                                    onChange={(e) => setVType(e.target.value)}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    <option value="SUV">SUV</option>
                                    <option value="Truck">Truck</option>
                                    <option value="Pickup">Pickup</option>
                                    <option value="Motorcycle">Motorcycle</option>
                                    <option value="Armored">Armored</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>COLOR</label>
                                <input
                                    type="text"
                                    value={vColor}
                                    onChange={(e) => setVColor(e.target.value)}
                                    placeholder="e.g. Dark Grey"
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AUTHORIZATION / STATUS</label>
                                <select
                                    value={vCategory}
                                    onChange={(e) => {
                                        setVCategory(e.target.value);
                                        if (e.target.value === 'authorized_whitelist' || e.target.value === 'patrol_unit') {
                                            setVThreat('AUTHORIZED');
                                        } else if (vThreat === 'AUTHORIZED') {
                                            setVThreat('HIGH');
                                        }
                                    }}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: vCategory === 'authorized_whitelist' ? 'var(--accent-green)' : '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    <option value="authorized_whitelist">🟢 AUTHORIZED / WHITELIST (PATROL - NO ALARM)</option>
                                    <option value="suspected_smuggling">🚨 SUSPECTED SMUGGLING (TRIGGERS ALARM)</option>
                                    <option value="stolen_vehicle">🚨 STOLEN VEHICLE / WANTED (TRIGGERS ALARM)</option>
                                    <option value="unauthorized_military">🚨 UNIDENTIFIED / HOSTILE (CRITICAL ALARM)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>THREAT LEVEL</label>
                                <select
                                    value={vThreat}
                                    onChange={(e) => setVThreat(e.target.value)}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: vThreat === 'AUTHORIZED' ? 'var(--accent-green)' : '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    {vCategory === 'authorized_whitelist' ? (
                                        <option value="AUTHORIZED">AUTHORIZED (SAFE / NO ALARM)</option>
                                    ) : (
                                        <>
                                            <option value="CRITICAL">CRITICAL</option>
                                            <option value="HIGH">HIGH</option>
                                            <option value="MEDIUM">MEDIUM</option>
                                            <option value="LOW">LOW</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        {vCategory === 'authorized_whitelist' && (
                            <div style={{
                                padding: '6px 10px',
                                background: 'rgba(0, 255, 157, 0.1)',
                                border: '1px solid var(--accent-green)',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                color: 'var(--accent-green)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <span>🟢 <strong>WHITELISTED:</strong> This vehicle will be recognized with a green HUD box and will NOT trigger breach alarms when passing restricted zones.</span>
                            </div>
                        )}

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MAKE / MODEL</label>
                            <input
                                type="text"
                                value={vMake}
                                onChange={(e) => setVMake(e.target.value)}
                                placeholder="e.g. Mahindra Scorpio / Defense Patrol 4x4"
                                style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>REGISTERED OWNER / UNIT</label>
                            <input
                                type="text"
                                value={vOwner}
                                onChange={(e) => setVOwner(e.target.value)}
                                placeholder="e.g. BOP-Alpha Defense Unit / Inspector Sharma"
                                style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                            />
                        </div>

                        <button type="submit" className="btn-tactical" style={{ width: '100%', padding: '9px' }}>
                            <Plus size={16} /> SAVE VEHICLE PROFILE
                        </button>
                    </form>

                    {/* Vehicles Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {vehicles.map((v) => {
                            const isAuth = (v.category || '').toLowerCase().includes('authorized') || (v.category || '').toLowerCase().includes('patrol') || (v.threat_level || '').toUpperCase() === 'AUTHORIZED';
                            return (
                                <div
                                    key={v.id}
                                    className="tactical-card"
                                    style={{
                                        padding: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        borderColor: isAuth ? 'var(--accent-green)' : (v.threat_level === 'CRITICAL' ? 'var(--accent-crimson)' : 'var(--accent-amber)')
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: '700',
                                                fontFamily: 'var(--font-mono)',
                                                color: isAuth ? 'var(--accent-green)' : 'var(--accent-amber)',
                                                letterSpacing: '1px',
                                                background: isAuth ? 'rgba(0, 255, 157, 0.12)' : 'rgba(255, 183, 0, 0.12)',
                                                padding: '2px 8px',
                                                borderRadius: '3px',
                                                border: isAuth ? '1px solid rgba(0, 255, 157, 0.4)' : '1px solid rgba(255, 183, 0, 0.3)'
                                            }}>
                                                {v.plate_number}
                                            </div>
                                            <span className={`badge ${isAuth ? 'badge-low' : (v.threat_level === 'CRITICAL' ? 'badge-critical' : 'badge-high')}`} style={{ color: isAuth ? 'var(--accent-green)' : undefined }}>
                                                {isAuth ? 'AUTHORIZED (NO ALARM)' : v.threat_level}
                                            </span>
                                        </div>

                                        <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            <div>TYPE: <strong style={{ color: '#fff' }}>{v.vehicle_type} ({v.color})</strong></div>
                                            <div>MODEL: {v.make_model}</div>
                                            {v.owner_name && <div>UNIT/OWNER: {v.owner_name}</div>}
                                            <div style={{ marginTop: '6px' }}>
                                                STATUS: <span className="badge badge-medium" style={{ color: isAuth ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                                                    {isAuth ? 'FRIENDLY WHITELIST' : v.category.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                                        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: isAuth ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                                            {isAuth ? '● WHITELIST ACTIVE' : '● REAL-TIME ANPR ACTIVE'}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteVehicle(v.id)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)' }}
                                            title="Delete vehicle record"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
