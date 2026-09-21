import React, { useState, useEffect } from 'react';
import { Users, Car, Plus, Trash2, ShieldAlert, Upload, CheckCircle2, UserCheck, Camera } from 'lucide-react';
import { watchlistService, cameraService } from '../services/api';

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
    const [capturedFromCam, setCapturedFromCam] = useState(null);
    const [capturingLive, setCapturingLive] = useState(false);

    // ANPR Vehicle Form
    const [vPlate, setVPlate] = useState('');
    const [vType, setVType] = useState('SUV');
    const [vColor, setVColor] = useState('Black');
    const [vMake, setVMake] = useState('Mahindra Scorpio');
    const [vOwner, setVOwner] = useState('');
    const [vCategory, setVCategory] = useState('suspected_smuggling');
    const [vThreat, setVThreat] = useState('HIGH');
    const [vNotes, setVNotes] = useState('');
    const [capturedPlateFromCam, setCapturedPlateFromCam] = useState(null);
    const [capturingPlateLive, setCapturingPlateLive] = useState(false);

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

    const handleCaptureLiveCamera = async () => {
        try {
            setCapturingLive(true);
            const res = await cameraService.captureFace(1);
            if (res.data?.faces && res.data.faces.length > 0) {
                const face = res.data.faces[0];
                setCapturedFromCam(face);
                setPPhoto(null);
            } else {
                alert('No face detected on the live camera. Please position yourself in front of the camera and try again.');
            }
        } catch (err) {
            console.error('Failed to capture face from camera', err);
            alert('Failed to capture face: ' + (err.response?.data?.detail || err.message));
        } finally {
            setCapturingLive(false);
        }
    };

    const handleCapturePlateLiveCamera = async () => {
        try {
            setCapturingPlateLive(true);
            const res = await cameraService.capturePlate(1);
            if (res.data?.plates && res.data.plates.length > 0) {
                const plate = res.data.plates[0];
                setCapturedPlateFromCam(plate);
                if (plate.plate_text) {
                    setVPlate(plate.plate_text);
                }
                if (plate.vehicle_type) {
                    const vt = plate.vehicle_type.toUpperCase();
                    if (['SUV', 'TRUCK', 'PICKUP', 'MOTORCYCLE', 'ARMORED'].includes(vt)) {
                        setVType(vt.charAt(0) + vt.slice(1).toLowerCase());
                    }
                }
            } else {
                alert('No vehicle or license plate detected on the live camera. Please position vehicle in frame and try again.');
            }
        } catch (err) {
            console.error('Failed to capture license plate from camera', err);
            alert('Failed to capture license plate: ' + (err.response?.data?.detail || err.message));
        } finally {
            setCapturingPlateLive(false);
        }
    };

    const handleCreatePerson = async (e) => {
        e.preventDefault();
        if (!pName.trim()) return;

        try {
            if (capturedFromCam) {
                await watchlistService.registerPersonDirect({
                    name: pName.trim(),
                    alias: pAlias || null,
                    national_id: pNationalId || null,
                    category: pCategory,
                    threat_level: pThreat,
                    notes: pNotes || null,
                    photo_url: capturedFromCam.photo_url,
                    face_embedding: capturedFromCam.face_embedding,
                    is_active: true
                });
            } else {
                const formData = new FormData();
                formData.append('name', pName);
                if (pAlias) formData.append('alias', pAlias);
                if (pNationalId) formData.append('national_id', pNationalId);
                formData.append('category', pCategory);
                formData.append('threat_level', pThreat);
                if (pNotes) formData.append('notes', pNotes);
                if (pPhoto) formData.append('photo', pPhoto);

                await watchlistService.createPerson(formData);
            }

            setPName('');
            setPAlias('');
            setPNationalId('');
            setPNotes('');
            setPPhoto(null);
            setCapturedFromCam(null);
            loadData();
        } catch (err) {
            console.error('Failed to create person', err);
            alert('Failed to register person: ' + (err.response?.data?.detail || err.message));
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
            setCapturedPlateFromCam(null);
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
                            ENROLL PERSON BIOMETRIC PROFILE
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>FULL NAME *</label>
                            <input
                                type="text"
                                required
                                value={pName}
                                onChange={(e) => setPName(e.target.value)}
                                placeholder="e.g. Inspector Rajesh Kumar / Tariq Ahmad"
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
                                    placeholder="e.g. Patrol Unit 4"
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NATIONAL / SERVICE ID</label>
                                <input
                                    type="text"
                                    value={pNationalId}
                                    onChange={(e) => setPNationalId(e.target.value)}
                                    placeholder="e.g. BSF-88912"
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AUTHORIZATION / STATUS</label>
                                <select
                                    value={pCategory}
                                    onChange={(e) => {
                                        setPCategory(e.target.value);
                                        if (e.target.value === 'vip_authorized' || e.target.value === 'authorized_personnel') {
                                            setPThreat('AUTHORIZED');
                                        } else if (pThreat === 'AUTHORIZED') {
                                            setPThreat('CRITICAL');
                                        }
                                    }}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: (pCategory === 'vip_authorized' || pCategory === 'authorized_personnel') ? 'var(--accent-green)' : '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    <option value="vip_authorized">🟢 AUTHORIZED / WHITELIST (PATROL / STAFF - NO ALARM)</option>
                                    <option value="cross_border_infiltrator">🚨 INFILTRATOR / THREAT (TRIGGERS ALARM)</option>
                                    <option value="wanted_terrorist">🚨 WANTED TERRORIST (TRIGGERS ALARM)</option>
                                    <option value="smuggler">🚨 SUSPECTED SMUGGLER (TRIGGERS ALARM)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>THREAT LEVEL</label>
                                <select
                                    value={pThreat}
                                    onChange={(e) => setPThreat(e.target.value)}
                                    style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: pThreat === 'AUTHORIZED' ? 'var(--accent-green)' : '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px' }}
                                >
                                    {pCategory === 'vip_authorized' || pCategory === 'authorized_personnel' ? (
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

                        {(pCategory === 'vip_authorized' || pCategory === 'authorized_personnel' || pThreat === 'AUTHORIZED') && (
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
                                <span>🟢 <strong>AUTHORIZED PERSONNEL:</strong> This person will be recognized with a green HUD box and will NOT trigger breach alarms when inside restricted zones.</span>
                            </div>
                        )}

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BIOMETRIC FACE PHOTO *</label>
                                <button
                                    type="button"
                                    onClick={handleCaptureLiveCamera}
                                    disabled={capturingLive}
                                    style={{
                                        background: 'rgba(0, 240, 255, 0.15)',
                                        border: '1px solid var(--accent-cyan)',
                                        color: 'var(--accent-cyan)',
                                        fontSize: '0.68rem',
                                        padding: '2px 8px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontWeight: '700'
                                    }}
                                >
                                    <Camera size={12} />
                                    <span>{capturingLive ? 'ISOLATING...' : '📸 CAPTURE FROM LIVE CAMERA'}</span>
                                </button>
                            </div>

                            {capturedFromCam ? (
                                <div style={{
                                    marginTop: '6px',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--accent-cyan)',
                                    background: 'rgba(0, 240, 255, 0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <img
                                        src={capturedFromCam.face_base64}
                                        alt="Captured Live Face"
                                        style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--accent-cyan)' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                                            ✓ LIVE ISOLATED FACE CAPTURED
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            128-D biometric vector extracted from camera stream
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCapturedFromCam(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => { setPPhoto(e.target.files[0]); setCapturedFromCam(null); }}
                                    style={{ width: '100%', padding: '6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px', fontSize: '0.75rem' }}
                                />
                            )}
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NOTES / CLEARANCE DETAILS</label>
                            <textarea
                                value={pNotes}
                                onChange={(e) => setPNotes(e.target.value)}
                                rows={2}
                                placeholder="Security clearance details or intel background..."
                                style={{ width: '100%', padding: '7px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '3px', resize: 'none' }}
                            />
                        </div>

                        <button type="submit" className="btn-tactical" style={{ width: '100%', padding: '9px' }}>
                            <Plus size={16} /> ENROLL INTO FRS DATABASE
                        </button>
                    </form>

                    {/* Persons Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {persons.map((p) => {
                            const isAuth = (p.category || '').toLowerCase().includes('authorized') || (p.category || '').toLowerCase().includes('vip') || (p.category || '').toLowerCase().includes('staff') || (p.category || '').toLowerCase().includes('patrol') || (p.threat_level || '').toUpperCase() === 'AUTHORIZED';
                            return (
                                <div
                                    key={p.id}
                                    className="tactical-card"
                                    style={{
                                        padding: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        borderColor: isAuth ? 'var(--accent-green)' : (p.threat_level === 'CRITICAL' ? 'var(--accent-crimson)' : 'var(--accent-amber)')
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: isAuth ? 'var(--accent-green)' : '#fff' }}>{p.name}</div>
                                                {p.alias && <div style={{ fontSize: '0.75rem', color: isAuth ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>Alias: "{p.alias}"</div>}
                                            </div>
                                            <span className={`badge ${isAuth ? 'badge-low' : (p.threat_level === 'CRITICAL' ? 'badge-critical' : 'badge-high')}`} style={{ color: isAuth ? 'var(--accent-green)' : undefined }}>
                                                {isAuth ? 'AUTHORIZED (NO ALARM)' : p.threat_level}
                                            </span>
                                        </div>

                                        <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <div>CATEGORY: <strong style={{ color: isAuth ? 'var(--accent-green)' : '#fff' }}>{isAuth ? 'FRIENDLY WHITELIST' : p.category.replace(/_/g, ' ').toUpperCase()}</strong></div>
                                            {p.national_id && <div>ID: {p.national_id}</div>}
                                            {p.notes && <div style={{ marginTop: '6px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{p.notes}</div>}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                                        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: isAuth ? 'var(--accent-green)' : (p.face_embedding ? 'var(--accent-cyan)' : 'var(--text-muted)') }}>
                                            {p.face_embedding ? (isAuth ? '● WHITELIST BIOMETRIC ACTIVE' : '● FRS VECTOR ACTIVE') : '○ HEURISTIC PROFILE'}
                                        </span>
                                        <button
                                            onClick={() => handleDeletePerson(p.id)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)' }}
                                            title="Delete person record"
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

            {/* TAB 2: ANPR VEHICLES */}
            {tab === 'anpr' && (
                <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px' }}>
                    {/* Vehicle Enrollment Form */}
                    <form onSubmit={handleCreateVehicle} className="tactical-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                            REGISTER WATCHLIST VEHICLE
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PLATE NUMBER (ALPHANUMERIC) *</label>
                                <button
                                    type="button"
                                    onClick={handleCapturePlateLiveCamera}
                                    disabled={capturingPlateLive}
                                    style={{
                                        background: 'rgba(255, 183, 0, 0.15)',
                                        border: '1px solid var(--accent-amber)',
                                        color: 'var(--accent-amber)',
                                        fontSize: '0.68rem',
                                        padding: '2px 8px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontWeight: '700'
                                    }}
                                >
                                    <Camera size={12} />
                                    <span>{capturingPlateLive ? 'SCANNING OCR...' : '🚗 CAPTURE FROM LIVE CAMERA'}</span>
                                </button>
                            </div>

                            {capturedPlateFromCam && (
                                <div style={{
                                    marginTop: '6px',
                                    marginBottom: '6px',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--accent-amber)',
                                    background: 'rgba(255, 183, 0, 0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <img
                                        src={capturedPlateFromCam.plate_base64}
                                        alt="Captured Live Plate"
                                        style={{ height: '36px', maxWidth: '100px', objectFit: 'contain', borderRadius: '3px', border: '1px solid var(--accent-amber)', background: '#000' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                                            OCR: {capturedPlateFromCam.plate_text || 'DETECTED'}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            Isolated vehicle license plate cropped from stream
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCapturedPlateFromCam(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

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
