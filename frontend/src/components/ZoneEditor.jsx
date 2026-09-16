import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Plus, Trash2, Check, X, ShieldAlert, ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { zoneService, cameraService } from '../services/api';

export default function ZoneEditor({ initialCamera, cameras }) {
    const [selectedCamera, setSelectedCamera] = useState(initialCamera || cameras[0]);
    const [zones, setZones] = useState([]);
    const [zoneType, setZoneType] = useState('polygon_fence'); // 'polygon_fence', 'tripwire'
    const [zoneName, setZoneName] = useState('');
    const [severity, setSeverity] = useState('CRITICAL');
    const [direction, setDirection] = useState('both');
    const [currentPoints, setCurrentPoints] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [loading, setLoading] = useState(false);

    const canvasRef = useRef(null);

    useEffect(() => {
        if (initialCamera) {
            setSelectedCamera(initialCamera);
        }
    }, [initialCamera]);

    useEffect(() => {
        if (selectedCamera) {
            loadZones();
        }
    }, [selectedCamera]);

    const loadZones = async () => {
        if (!selectedCamera) return;
        try {
            setLoading(true);
            const res = await zoneService.getByCameraId(selectedCamera.id);
            setZones(res.data);
        } catch (err) {
            console.error('Failed to load zones', err);
        } finally {
            setLoading(false);
        }
    };

    const [draggedPointIndex, setDraggedPointIndex] = useState(null);

    // Draw Crosshair (+) Handle like MS Paint
    const drawCrosshairHandle = (ctx, x, y, isSelected = false) => {
        ctx.save();
        ctx.setLineDash([]); // solid crosshair

        // Outer glow circle
        ctx.fillStyle = isSelected ? 'rgba(0, 255, 157, 0.45)' : 'rgba(0, 240, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#00ff9d' : '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Plus (+) Symbol
        const arm = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();

        ctx.restore();
    };

    // Redraw Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Draw existing saved zones
        zones.forEach((z) => {
            try {
                const coords = typeof z.coordinates === 'string' ? JSON.parse(z.coordinates) : z.coordinates;
                if (!coords || coords.length === 0) return;

                const color = z.alert_severity === 'CRITICAL' ? '#ff2a5f' : '#00f0ff';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;

                if (z.zone_type === 'polygon_fence' && coords.length >= 3) {
                    ctx.setLineDash([6, 4]); // Dotted border
                    ctx.fillStyle = z.alert_severity === 'CRITICAL' ? 'rgba(255, 42, 95, 0.2)' : 'rgba(0, 240, 255, 0.2)';
                    ctx.beginPath();
                    ctx.moveTo(coords[0][0] * w, coords[0][1] * h);
                    for (let i = 1; i < coords.length; i++) {
                        ctx.lineTo(coords[i][0] * w, coords[i][1] * h);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Label
                    ctx.setLineDash([]);
                    ctx.fillStyle = color;
                    ctx.font = '12px "JetBrains Mono"';
                    ctx.fillText(`[${z.name}]`, coords[0][0] * w + 5, coords[0][1] * h - 5);
                } else if (z.zone_type === 'tripwire' && coords.length >= 2) {
                    ctx.setLineDash([6, 4]); // Dotted tripwire
                    ctx.beginPath();
                    ctx.moveTo(coords[0][0] * w, coords[0][1] * h);
                    ctx.lineTo(coords[1][0] * w, coords[1][1] * h);
                    ctx.stroke();

                    drawCrosshairHandle(ctx, coords[0][0] * w, coords[0][1] * h);
                    drawCrosshairHandle(ctx, coords[1][0] * w, coords[1][1] * h);

                    // Label
                    ctx.setLineDash([]);
                    ctx.font = '12px "JetBrains Mono"';
                    ctx.fillText(`[TRIPWIRE: ${z.name}]`, coords[0][0] * w + 5, coords[0][1] * h - 5);
                }
            } catch (e) {
                console.error(e);
            }
        });

        // Draw points currently being drafted by operator with Paint-style dotted line & (+) handles
        if (currentPoints.length > 0) {
            ctx.setLineDash([8, 4]); // Dotted Paint line
            ctx.strokeStyle = '#00ff9d';
            ctx.fillStyle = 'rgba(0, 255, 157, 0.2)';
            ctx.lineWidth = 2.5;

            ctx.beginPath();
            ctx.moveTo(currentPoints[0][0] * w, currentPoints[0][1] * h);
            for (let i = 1; i < currentPoints.length; i++) {
                ctx.lineTo(currentPoints[i][0] * w, currentPoints[i][1] * h);
            }

            if (zoneType === 'polygon_fence' && currentPoints.length >= 3) {
                ctx.closePath();
                ctx.fill();
            }
            ctx.stroke();

            // Draw (+) Crosshair handles instead of numbers 1 2 3
            currentPoints.forEach((pt, idx) => {
                drawCrosshairHandle(ctx, pt[0] * w, pt[1] * h, draggedPointIndex === idx);
            });
        }
    }, [zones, currentPoints, zoneType, draggedPointIndex]);

    const getPointUnderCursor = (normX, normY, canvas) => {
        const w = canvas.width;
        const h = canvas.height;
        const pxX = normX * w;
        const pxY = normY * h;

        for (let i = 0; i < currentPoints.length; i++) {
            const ptX = currentPoints[i][0] * w;
            const ptY = currentPoints[i][1] * h;
            const dist = Math.hypot(pxX - ptX, pxY - ptY);
            if (dist <= 18) {
                return i;
            }
        }
        return -1;
    };

    const handleCanvasMouseDown = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        const hitIndex = getPointUnderCursor(normX, normY, canvas);
        if (hitIndex !== -1) {
            setDraggedPointIndex(hitIndex);
        } else {
            const newPt = [
                Math.max(0, Math.min(1, Math.round(normX * 10000) / 10000)),
                Math.max(0, Math.min(1, Math.round(normY * 10000) / 10000))
            ];
            if (zoneType === 'tripwire' && currentPoints.length >= 2) {
                setCurrentPoints([currentPoints[0], newPt]);
            } else {
                setCurrentPoints([...currentPoints, newPt]);
            }
        }
    };

    const handleCanvasMouseMove = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        if (draggedPointIndex !== null) {
            const updated = [...currentPoints];
            updated[draggedPointIndex] = [
                Math.max(0, Math.min(1, Math.round(normX * 10000) / 10000)),
                Math.max(0, Math.min(1, Math.round(normY * 10000) / 10000))
            ];
            setCurrentPoints(updated);
        } else {
            const hitIndex = getPointUnderCursor(normX, normY, canvas);
            canvas.style.cursor = hitIndex !== -1 ? 'move' : 'crosshair';
        }
    };

    const handleCanvasMouseUp = () => {
        setDraggedPointIndex(null);
    };

    const handleSaveZone = async () => {
        if (!zoneName.trim()) {
            alert('Please enter a zone name');
            return;
        }
        if (zoneType === 'polygon_fence' && currentPoints.length < 3) {
            alert('Polygon fence requires at least 3 vertices');
            return;
        }
        if (zoneType === 'tripwire' && currentPoints.length < 2) {
            alert('Tripwire requires 2 points');
            return;
        }

        try {
            await zoneService.create({
                camera_id: selectedCamera.id,
                name: zoneName,
                zone_type: zoneType,
                coordinates: JSON.stringify(currentPoints),
                direction: direction,
                alert_severity: severity,
                is_active: true
            });
            setZoneName('');
            setCurrentPoints([]);
            setIsDrawing(false);
            loadZones();
        } catch (err) {
            console.error('Failed to create zone', err);
            alert('Failed to save virtual zone');
        }
    };

    const handleDeleteZone = async (id) => {
        try {
            await zoneService.delete(id);
            loadZones();
        } catch (err) {
            console.error('Failed to delete zone', err);
        }
    };

    const handleToggleZone = async (id) => {
        try {
            await zoneService.toggle(id);
            loadZones();
        } catch (err) {
            console.error('Failed to toggle zone', err);
        }
    };

    const streamUrl = selectedCamera ? cameraService.getStreamUrl(selectedCamera.id, false) : '';

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sliders size={20} color="var(--accent-cyan)" />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                        VIRTUAL GEOFENCING & TRIPWIRE CONFIGURATOR
                    </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SELECT CAMERA:</span>
                    <select
                        value={selectedCamera?.id || ''}
                        onChange={(e) => {
                            const found = cameras.find(c => c.id === parseInt(e.target.value));
                            if (found) setSelectedCamera(found);
                            setCurrentPoints([]);
                            setIsDrawing(false);
                        }}
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-tactical)',
                            fontSize: '0.85rem'
                        }}
                    >
                        {cameras.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.location_bop})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>
                {/* Left: Interactive Canvas Over Live Video Stream */}
                <div className="tactical-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                            FEED: {selectedCamera?.name} | CLICK CANVAS TO PLACE VERTICES
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {isDrawing ? (
                                <button
                                    onClick={() => { setIsDrawing(false); setCurrentPoints([]); }}
                                    className="btn-tactical btn-danger"
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                >
                                    <X size={14} /> CANCEL DRAFT
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setIsDrawing(true); setCurrentPoints([]); }}
                                    className="btn-tactical"
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                >
                                    <Plus size={14} /> DRAW NEW ZONE
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '480px',
                        backgroundColor: '#000',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            aspectRatio: '640 / 480',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {selectedCamera && (
                                <img
                                    src={streamUrl}
                                    alt="Live Feed for Zone Setup"
                                    style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
                                />
                            )}
                            <canvas
                                ref={canvasRef}
                                width={640}
                                height={480}
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    cursor: isDrawing ? 'crosshair' : 'default',
                                    zIndex: 10
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Vertices Placed: {currentPoints.length}</span>
                        {isDrawing && (
                            <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                                {zoneType === 'tripwire' ? 'Click 2 points for Tripwire line' : 'Click 3+ points for Polygon boundary'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Zone Config & Existing Zones List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* New Zone Form */}
                    <div className="tactical-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                            DEFINE SECURITY ZONE
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                ZONE TYPE
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <button
                                    onClick={() => { setZoneType('polygon_fence'); setCurrentPoints([]); }}
                                    className={`btn-tactical ${zoneType === 'polygon_fence' ? '' : 'btn-secondary'}`}
                                    style={{ padding: '6px', fontSize: '0.75rem' }}
                                >
                                    POLYGON GEOFENCE
                                </button>
                                <button
                                    onClick={() => { setZoneType('tripwire'); setCurrentPoints([]); }}
                                    className={`btn-tactical ${zoneType === 'tripwire' ? '' : 'btn-secondary'}`}
                                    style={{ padding: '6px', fontSize: '0.75rem' }}
                                >
                                    TRIPWIRE LINE
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                ZONE NAME / SECTOR
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Restricted Munitions Yard"
                                value={zoneName}
                                onChange={(e) => setZoneName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    fontFamily: 'var(--font-tactical)',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                    SEVERITY
                                </label>
                                <select
                                    value={severity}
                                    onChange={(e) => setSeverity(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '7px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    <option value="CRITICAL">CRITICAL</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="LOW">LOW</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                    CROSSING DIRECTION
                                </label>
                                <select
                                    value={direction}
                                    onChange={(e) => setDirection(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '7px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    <option value="both">BOTH DIRECTIONS</option>
                                    <option value="inbound">INBOUND ONLY</option>
                                    <option value="outbound">OUTBOUND ONLY</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveZone}
                            disabled={currentPoints.length < (zoneType === 'tripwire' ? 2 : 3)}
                            className="btn-tactical"
                            style={{
                                width: '100%',
                                padding: '10px',
                                marginTop: '6px',
                                opacity: currentPoints.length < (zoneType === 'tripwire' ? 2 : 3) ? 0.5 : 1
                            }}
                        >
                            <Check size={16} /> SAVE ZONE CONFIGURATION
                        </button>
                    </div>

                    {/* Saved Zones List */}
                    <div className="tactical-card" style={{ padding: '14px', flex: 1, overflowY: 'auto' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff', marginBottom: '10px' }}>
                            ACTIVE ZONES ({zones.length})
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {zones.map((z) => (
                                <div
                                    key={z.id}
                                    style={{
                                        padding: '8px 10px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.82rem', color: '#fff' }}>
                                            {z.name}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                            <span className={`badge ${z.alert_severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                                                {z.alert_severity}
                                            </span>
                                            <span className="badge badge-medium">
                                                {z.zone_type}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => handleToggleZone(z.id)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: z.is_active ? 'var(--accent-green)' : 'var(--text-muted)' }}
                                            title="Toggle Zone Active"
                                        >
                                            {z.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteZone(z.id)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)' }}
                                            title="Delete Zone"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {zones.length === 0 && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                                    No zones defined for this camera yet. Click "DRAW NEW ZONE" above.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
