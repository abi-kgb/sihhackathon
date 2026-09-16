import React, { useState, useRef, useEffect } from 'react';
import {
    Camera,
    Upload,
    Video,
    Sliders,
    Moon,
    Sun,
    Eye,
    EyeOff,
    AlertTriangle,
    Shield,
    Activity,
    CheckCircle2,
    Play,
    RefreshCw,
    Sparkles,
    Users,
    Car,
    FileText,
    X,
    Plus,
    Trash2,
    Check,
    Move
} from 'lucide-react';
import { cameraService, alertService, zoneService, api } from '../services/api';

export default function CameraGrid({
    cameras,
    telemetryMap,
    onRefreshCameras
}) {
    const primaryCamera = cameras[0] || {
        id: 1,
        name: "Primary Tactical Surveillance Unit (BOP-Alpha)",
        location_bop: "BOP Alpha-1",
        stream_type: "webcam",
        stream_url: "webcam://0",
        night_mode_enabled: false
    };

    const telemetry = telemetryMap[primaryCamera.id] || {
        fps: 25.0,
        latency_ms: 12.0,
        tracked_objects_count: 0,
        stream_type: primaryCamera.stream_type || "webcam",
        active_alerts: []
    };

    const [annotated, setAnnotated] = useState(true);
    const [nightMode, setNightMode] = useState(primaryCamera.night_mode_enabled || false);
    const [uploading, setUploading] = useState(false);
    const [streamKey, setStreamKey] = useState(Date.now());
    const [showPitchModal, setShowPitchModal] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [mediaAspectRatio, setMediaAspectRatio] = useState('640 / 480');
    const [useBrowserWebcam, setUseBrowserWebcam] = useState(false);
    const [annotatedFrameUrl, setAnnotatedFrameUrl] = useState(null);
    const [webcamError, setWebcamError] = useState(null);

    // Direct Zone Drawing, Dotted Vector Lines & Draggable Handles
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [zones, setZones] = useState([]);
    const [zoneType, setZoneType] = useState('polygon_fence'); // 'polygon_fence', 'tripwire'
    const [zoneName, setZoneName] = useState('Restricted Zone Alpha');
    const [zoneSeverity, setZoneSeverity] = useState('CRITICAL');
    const [zoneDirection, setZoneDirection] = useState('both');
    const [currentPoints, setCurrentPoints] = useState([]);
    const [draggedPointIndex, setDraggedPointIndex] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const drawCanvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const streamRef = useRef(null);
    const processingRef = useRef(false);

    const hasAlert = telemetry.active_alerts && telemetry.active_alerts.length > 0;
    const streamUrl = `${cameraService.getStreamUrl(primaryCamera.id, annotated)}&t=${streamKey}`;

    // Load Zones for this camera
    useEffect(() => {
        loadZones();
    }, [primaryCamera.id]);

    const loadZones = async () => {
        try {
            const res = await zoneService.getByCameraId(primaryCamera.id);
            setZones(res.data);
        } catch (err) {
            console.error('Failed to load zones', err);
        }
    };

    // Handle Browser Webcam Stream
    useEffect(() => {
        if (useBrowserWebcam) {
            startBrowserWebcam();
        } else {
            stopBrowserWebcam();
        }
        return () => stopBrowserWebcam();
    }, [useBrowserWebcam]);

    const startBrowserWebcam = async () => {
        try {
            setWebcamError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error('Browser webcam error:', err);
            setWebcamError('Camera access denied or webcam in use by another app.');
        }
    };

    const stopBrowserWebcam = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // Frame processing loop for browser webcam
    useEffect(() => {
        let animId;
        const processFrameLoop = async () => {
            if (useBrowserWebcam && videoRef.current && videoRef.current.readyState >= 2 && !processingRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current || document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, 640, 480);
                const base64Image = canvas.toDataURL('image/jpeg', 0.65);

                processingRef.current = true;
                try {
                    const res = await api.post(`/cameras/${primaryCamera.id}/process-frame`, {
                        image_base64: base64Image
                    });
                    if (res.data?.annotated_image && annotated) {
                        setAnnotatedFrameUrl(res.data.annotated_image);
                    }
                } catch (e) {
                    // ignore
                } finally {
                    processingRef.current = false;
                }
            }
            if (useBrowserWebcam) {
                animId = setTimeout(processFrameLoop, 60);
            }
        };

        if (useBrowserWebcam) {
            processFrameLoop();
        }

        return () => clearTimeout(animId);
    }, [useBrowserWebcam, annotated]);

    // Draw Crosshair (+) Handle
    const drawCrosshairHandle = (ctx, x, y, isSelected = false) => {
        ctx.save();
        ctx.setLineDash([]); // solid crosshair

        // Outer glow circle
        ctx.fillStyle = isSelected ? 'rgba(0, 255, 157, 0.4)' : 'rgba(0, 240, 255, 0.25)';
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

    // Redraw Canvas Overlay with Dotted Lines and Draggable (+) Handles
    useEffect(() => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (!isDrawingMode) return;

        // 1. Draw existing saved zones
        zones.forEach((z) => {
            try {
                const coords = typeof z.coordinates === 'string' ? JSON.parse(z.coordinates) : z.coordinates;
                if (!coords || coords.length === 0) return;

                const color = z.alert_severity === 'CRITICAL' ? '#ff2a5f' : '#00f0ff';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;

                if (z.zone_type === 'polygon_fence' && coords.length >= 3) {
                    ctx.setLineDash([6, 4]); // Dotted border line
                    ctx.fillStyle = z.alert_severity === 'CRITICAL' ? 'rgba(255, 42, 95, 0.2)' : 'rgba(0, 240, 255, 0.2)';
                    ctx.beginPath();
                    ctx.moveTo(coords[0][0] * w, coords[0][1] * h);
                    for (let i = 1; i < coords.length; i++) {
                        ctx.lineTo(coords[i][0] * w, coords[i][1] * h);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

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

                    ctx.setLineDash([]);
                    ctx.font = '12px "JetBrains Mono"';
                    ctx.fillStyle = color;
                    ctx.fillText(`[TRIPWIRE: ${z.name}]`, coords[0][0] * w + 5, coords[0][1] * h - 5);
                }
            } catch (e) {}
        });

        // 2. Draw active drafting points with Dotted Paint-Style Line & (+) Handles
        if (currentPoints.length > 0) {
            ctx.setLineDash([8, 4]); // Paint-style dotted line
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

            // Draw (+) Crosshair handle at each vertex
            currentPoints.forEach((pt, idx) => {
                drawCrosshairHandle(ctx, pt[0] * w, pt[1] * h, draggedPointIndex === idx);
            });
        }
    }, [zones, currentPoints, zoneType, isDrawingMode, draggedPointIndex]);

    // Find nearest point index within 18px radius
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
        if (!isDrawingMode) return;
        const canvas = drawCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        const hitIndex = getPointUnderCursor(normX, normY, canvas);
        if (hitIndex !== -1) {
            // Drag existing vertex handle
            setDraggedPointIndex(hitIndex);
        } else {
            // Add new vertex point with high precision (4 decimal places)
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
        if (!isDrawingMode) return;
        const canvas = drawCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        if (draggedPointIndex !== null) {
            // Update dragged vertex in real-time with high precision
            const updated = [...currentPoints];
            updated[draggedPointIndex] = [
                Math.max(0, Math.min(1, Math.round(normX * 10000) / 10000)),
                Math.max(0, Math.min(1, Math.round(normY * 10000) / 10000))
            ];
            setCurrentPoints(updated);
        } else {
            // Set hover cursor
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
            alert('Polygon fence requires at least 3 vertices clicked on screen');
            return;
        }
        if (zoneType === 'tripwire' && currentPoints.length < 2) {
            alert('Tripwire requires 2 points clicked on screen');
            return;
        }

        try {
            await zoneService.create({
                camera_id: primaryCamera.id,
                name: zoneName,
                zone_type: zoneType,
                coordinates: JSON.stringify(currentPoints),
                direction: zoneDirection,
                alert_severity: zoneSeverity,
                is_active: true
            });
            setCurrentPoints([]);
            setIsDrawingMode(false);
            loadZones();
            setStreamKey(Date.now());
            alert(`Restricted Zone "${zoneName}" successfully saved and active!`);
        } catch (err) {
            console.error('Failed to create zone', err);
            alert('Failed to save zone');
        }
    };

    const handleClearAllZones = async () => {
        if (window.confirm('Are you sure you want to remove ALL virtual zones from this camera?')) {
            try {
                await zoneService.clearAllByCameraId(primaryCamera.id);
                setCurrentPoints([]);
                setZones([]);
                await loadZones();
                setStreamKey(Date.now());
                alert('All virtual zones cleared from camera feed!');
            } catch (err) {
                console.error('Failed to clear zones', err);
            }
        }
    };

    const handleDeleteZone = async (id) => {
        try {
            await zoneService.delete(id);
            setZones((prev) => prev.filter(z => z.id !== id));
            await loadZones();
            setStreamKey(Date.now());
        } catch (err) {
            console.error(err);
        }
    };

    const handleSwitchToWebcam = async () => {
        setUseBrowserWebcam(true);
        try {
            await cameraService.switchSource(primaryCamera.id, 'webcam');
            setStreamKey(Date.now());
            if (onRefreshCameras) onRefreshCameras();
        } catch (err) {
            console.error('Failed to switch to webcam', err);
        }
    };

    const handleSwitchToSimulation = async () => {
        setUseBrowserWebcam(false);
        try {
            await cameraService.switchSource(primaryCamera.id, 'simulation');
            setStreamKey(Date.now());
            if (onRefreshCameras) onRefreshCameras();
        } catch (err) {
            console.error('Failed to switch to simulation', err);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUseBrowserWebcam(false);
        try {
            setUploading(true);
            await cameraService.uploadVideo(primaryCamera.id, file);
            setStreamKey(Date.now());
            if (onRefreshCameras) onRefreshCameras();
            alert(`Video "${file.name}" loaded successfully into AI Video Analytics pipeline!`);
        } catch (err) {
            console.error('Failed to upload video', err);
            alert('Failed to upload video file');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleToggleNightMode = async () => {
        try {
            const res = await cameraService.toggleNightMode(primaryCamera.id);
            setNightMode(res.data.night_mode_enabled);
            setStreamKey(Date.now());
        } catch (err) {
            console.error('Failed to toggle night mode', err);
        }
    };

    const handleSimulateEvent = async (alertType) => {
        try {
            setSimulating(true);
            await alertService.simulate(alertType);
            setStreamKey(Date.now());
        } catch (err) {
            console.error('Simulation trigger failed', err);
        } finally {
            setSimulating(false);
        }
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
            {/* PROTOTYPE EVALUATION DESK */}
            <div className="tactical-card" style={{
                padding: '12px 16px',
                background: 'linear-gradient(90deg, rgba(0, 240, 255, 0.12) 0%, rgba(13, 20, 33, 0.95) 100%)',
                borderColor: 'var(--accent-cyan)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        padding: '4px 8px',
                        background: 'rgba(0, 240, 255, 0.2)',
                        border: '1px solid var(--accent-cyan)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-cyan)'
                    }}>
                        PROTOTYPE EVALUATION DESK
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        1-Click Breach Simulations:
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handleSimulateEvent('VIRTUAL_FENCE_BREACH')}
                        disabled={simulating}
                        className="btn-tactical btn-danger"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    >
                        🚨 FENCE BREACH
                    </button>

                    <button
                        onClick={() => handleSimulateEvent('ANPR_WATCHLIST_MATCH')}
                        disabled={simulating}
                        className="btn-tactical"
                        style={{ padding: '5px 10px', fontSize: '0.75rem', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)', background: 'rgba(255, 183, 0, 0.1)' }}
                    >
                        🚗 ANPR HIT
                    </button>

                    <button
                        onClick={() => handleSimulateEvent('FRS_WATCHLIST_MATCH')}
                        disabled={simulating}
                        className="btn-tactical"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    >
                        👤 FRS POI MATCH
                    </button>

                    <button
                        onClick={() => handleSimulateEvent('NIGHT_STEALTH_MOVEMENT')}
                        disabled={simulating}
                        className="btn-tactical"
                        style={{ padding: '5px 10px', fontSize: '0.75rem', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', background: 'rgba(181, 95, 230, 0.1)' }}
                    >
                        🌙 STEALTH CRAWL
                    </button>

                    <button
                        onClick={() => setShowPitchModal(true)}
                        className="btn-tactical"
                        style={{ padding: '5px 12px', fontSize: '0.75rem', background: 'var(--accent-cyan)', color: '#000' }}
                    >
                        <FileText size={13} />
                        <span>PITCH SUMMARY</span>
                    </button>
                </div>
            </div>

            {/* Source Selector Toolbar */}
            <div className="tactical-card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Camera size={20} color="var(--accent-cyan)" />
                    <div>
                        <span style={{ fontSize: '0.92rem', fontWeight: '700', color: '#fff' }}>
                            SURVEILLANCE INGESTION FEED
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            SOURCE: <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                                {useBrowserWebcam ? 'LIVE WEBCAM' : (primaryCamera.stream_type ? primaryCamera.stream_type.toUpperCase() : 'SIMULATION')}
                            </strong>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={handleSwitchToWebcam}
                        className={`btn-tactical ${useBrowserWebcam ? '' : 'btn-secondary'}`}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        <Camera size={14} />
                        <span>LIVE WEBCAM</span>
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="video/mp4,video/avi,video/mov,video/mkv,video/webm"
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={`btn-tactical ${!useBrowserWebcam && primaryCamera.stream_type === 'file' ? '' : 'btn-secondary'}`}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        <Upload size={14} />
                        <span>{uploading ? 'UPLOADING...' : 'UPLOAD VIDEO'}</span>
                    </button>

                    <button
                        onClick={handleSwitchToSimulation}
                        className={`btn-tactical ${!useBrowserWebcam && primaryCamera.stream_type === 'simulation' ? '' : 'btn-secondary'}`}
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                        <Video size={14} />
                        <span>TEST FEED</span>
                    </button>

                    <button
                        onClick={() => { setStreamKey(Date.now()); if (onRefreshCameras) onRefreshCameras(); }}
                        className="btn-tactical btn-secondary"
                        style={{ padding: '6px 10px' }}
                        title="Reconnect Stream"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* INTERACTIVE PAINT-STYLE DOTTED LINE & (+) DRAG HANDLE TOOLBAR */}
            <div className="tactical-card" style={{
                padding: '10px 16px',
                backgroundColor: 'rgba(11, 16, 26, 0.95)',
                border: isDrawingMode ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {!isDrawingMode ? (
                        <button
                            onClick={() => { setIsDrawingMode(true); setCurrentPoints([]); }}
                            className="btn-tactical"
                            style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(0, 255, 157, 0.15)', borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}
                        >
                            <Plus size={15} />
                            <span>DRAW NEW ZONE</span>
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--accent-green)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                                ✏️ CLICK TO PLACE (+) ANCHORS OR DRAG TO RESIZE ({currentPoints.length} PTS)
                            </span>
                            <button
                                onClick={handleSaveZone}
                                disabled={currentPoints.length < (zoneType === 'tripwire' ? 2 : 3)}
                                className="btn-tactical"
                                style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'var(--accent-green)', color: '#000', borderColor: 'var(--accent-green)' }}
                            >
                                <Check size={14} /> SAVE ZONE
                            </button>
                            <button
                                onClick={() => setCurrentPoints([])}
                                className="btn-tactical btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                                RESET POINTS
                            </button>
                            <button
                                onClick={() => { setIsDrawingMode(false); setCurrentPoints([]); }}
                                className="btn-tactical btn-danger"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                                CANCEL
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleClearAllZones}
                        className="btn-tactical btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        title="Delete all virtual fence boundaries from this camera"
                    >
                        <Trash2 size={14} />
                        <span>CLEAR ALL ZONES</span>
                    </button>
                </div>

                {isDrawingMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            value={zoneType}
                            onChange={(e) => { setZoneType(e.target.value); setCurrentPoints([]); }}
                            style={{ padding: '5px 8px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                            <option value="polygon_fence">POLYGON GEOFENCE</option>
                            <option value="tripwire">DIRECTIONAL TRIPWIRE</option>
                        </select>

                        <input
                            type="text"
                            placeholder="Zone Name"
                            value={zoneName}
                            onChange={(e) => setZoneName(e.target.value)}
                            style={{ padding: '5px 8px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.75rem', width: '150px' }}
                        />

                        <select
                            value={zoneSeverity}
                            onChange={(e) => setZoneSeverity(e.target.value)}
                            style={{ padding: '5px 8px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                            <option value="CRITICAL">SEVERITY: CRITICAL</option>
                            <option value="HIGH">SEVERITY: HIGH</option>
                        </select>
                    </div>
                )}

                {!isDrawingMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ENFORCED ZONES:</span>
                        <span className="badge badge-medium">
                            {zones.length} ACTIVE
                        </span>
                        {zones.map((z) => (
                            <div key={z.id} style={{
                                padding: '2px 6px',
                                background: 'rgba(0, 240, 255, 0.1)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.7rem'
                            }}>
                                <span>{z.name}</span>
                                <button
                                    onClick={() => handleDeleteZone(z.id)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 0 }}
                                    title="Delete this zone"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Tactical Video Player with Canvas Overlay */}
            <div
                className={`tactical-card tactical-corner ${hasAlert ? 'alert-pulse' : ''}`}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderColor: hasAlert ? 'var(--accent-crimson)' : (isDrawingMode ? 'var(--accent-green)' : 'var(--border-color)'),
                    backgroundColor: '#000',
                    flex: 1,
                    minHeight: '460px',
                    position: 'relative'
                }}
            >
                {/* Video Canvas Container */}
                <div style={{
                    position: 'relative',
                    flex: 1,
                    minHeight: '420px',
                    backgroundColor: '#030508',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    userSelect: 'none',
                    padding: '8px'
                }}>
                    {/* Aspect-ratio locked video stage ensuring 1:1 coordinate matching with AI engine */}
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        aspectRatio: mediaAspectRatio,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {useBrowserWebcam ? (
                            <>
                                <video
                                    ref={videoRef}
                                    playsInline
                                    muted
                                    onLoadedMetadata={(e) => {
                                        if (e.target.videoWidth && e.target.videoHeight) {
                                            setMediaAspectRatio(`${e.target.videoWidth} / ${e.target.videoHeight}`);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'fill',
                                        display: annotated && annotatedFrameUrl ? 'none' : 'block'
                                    }}
                                />

                                {annotated && annotatedFrameUrl && (
                                    <img
                                        src={annotatedFrameUrl}
                                        alt="Live AI Annotated Webcam Feed"
                                        onLoad={(e) => {
                                            if (e.target.naturalWidth && e.target.naturalHeight) {
                                                setMediaAspectRatio(`${e.target.naturalWidth} / ${e.target.naturalHeight}`);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'fill',
                                            display: 'block'
                                        }}
                                    />
                                )}

                                {webcamError && (
                                    <div style={{ position: 'absolute', textAlign: 'center', color: 'var(--accent-amber)', padding: '20px' }}>
                                        <AlertTriangle size={32} style={{ marginBottom: '8px' }} />
                                        <div>{webcamError}</div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <img
                                src={streamUrl}
                                alt="Primary Surveillance Feed"
                                onLoad={(e) => {
                                    if (e.target.naturalWidth && e.target.naturalHeight) {
                                        setMediaAspectRatio(`${e.target.naturalWidth} / ${e.target.naturalHeight}`);
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'fill',
                                    display: 'block'
                                }}
                            />
                        )}

                        {/* Interactive Paint-Style Dotted Vector & (+) Draggable Handle Canvas */}
                        <canvas
                            ref={drawCanvasRef}
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
                                cursor: isDrawingMode ? 'crosshair' : 'default',
                                pointerEvents: isDrawingMode ? 'auto' : 'none',
                                zIndex: 15
                            }}
                        />

                        <div className="scanline-overlay" />
                    </div>

                    {/* Top Left HUD Telemetry */}
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--accent-cyan)',
                        background: 'rgba(0, 0, 0, 0.75)',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        border: '1px solid rgba(0, 240, 255, 0.25)',
                        display: 'flex',
                        gap: '10px',
                        zIndex: 20
                    }}>
                        <span>FPS: {telemetry.fps || 25.0}</span>
                        <span>LATENCY: {telemetry.latency_ms || 12}ms</span>
                        <span>AI: YOLOv8 + FRS + ANPR</span>
                    </div>

                    {/* Top Right Track Count */}
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--accent-green)',
                        background: 'rgba(0, 0, 0, 0.75)',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        border: '1px solid rgba(0, 255, 157, 0.25)',
                        zIndex: 20
                    }}>
                        TRACKED TARGETS: {telemetry.tracked_objects_count || 0}
                    </div>

                    {/* Active Breach Banner */}
                    {hasAlert && (
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '10px',
                            right: '10px',
                            backgroundColor: 'rgba(255, 42, 95, 0.9)',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            fontFamily: 'var(--font-mono)',
                            boxShadow: '0 0 15px rgba(255, 42, 95, 0.5)',
                            zIndex: 20
                        }}>
                            <AlertTriangle size={16} />
                            <span>SECURITY ALERT: {telemetry.active_alerts.join(' | ')}</span>
                        </div>
                    )}
                </div>

                {/* Video Controls Footer */}
                <div style={{
                    padding: '8px 14px',
                    backgroundColor: 'rgba(11, 16, 26, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-color)',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleToggleNightMode}
                            className={`btn-tactical ${nightMode ? '' : 'btn-secondary'}`}
                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        >
                            {nightMode ? <Moon size={13} color="var(--accent-cyan)" /> : <Sun size={13} />}
                            <span>{nightMode ? 'NIGHT IR (ON)' : 'NIGHT VISION'}</span>
                        </button>

                        <button
                            onClick={() => { setAnnotated(!annotated); setStreamKey(Date.now()); }}
                            className={`btn-tactical ${annotated ? '' : 'btn-secondary'}`}
                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        >
                            {annotated ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>{annotated ? 'AI BOUNDING BOXES (ON)' : 'RAW VIDEO FEED'}</span>
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {primaryCamera.name} ({primaryCamera.location_bop})
                        </span>
                    </div>
                </div>
            </div>

            {/* PITCH SUMMARY MODAL FOR EVALUATORS */}
            {showPitchModal && (
                <div style={{
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
                }}>
                    <div className="tactical-card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Shield size={24} color="var(--accent-cyan)" />
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>
                                        IBVAP PROTOTYPE SUBMISSION PITCH
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        INTELLIGENT BORDER VIDEO ANALYTICS PLATFORM USING EXISTING CCTV INFRASTRUCTURE
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setShowPitchModal(false)} className="btn-tactical btn-secondary" style={{ padding: '4px 8px' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                            <div style={{ backgroundColor: 'rgba(0, 240, 255, 0.08)', padding: '12px', borderRadius: '4px', borderLeft: '3px solid var(--accent-cyan)' }}>
                                <strong style={{ color: 'var(--accent-cyan)' }}>Core Value Proposition:</strong>
                                <p style={{ marginTop: '4px' }}>
                                    Border security forces have thousands of standard IP/CCTV cameras that only do passive recording. Proprietary FRS/ANPR smart cameras cost over ₹2,50,000 per unit. <strong>IBVAP converts existing non-smart CCTV infrastructure into an automated AI defense grid completely in software at 90% lower deployment cost.</strong>
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                    <strong style={{ color: 'var(--accent-green)' }}>1. Real-Time AI Computer Vision</strong>
                                    <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <li>YOLOv8 Human & Vehicle Detection</li>
                                        <li>Multi-Object Tracking (MOT) with Kinematics</li>
                                        <li>Software-based FRS (Facial Recognition System)</li>
                                        <li>Software-based ANPR (License Plate OCR)</li>
                                    </ul>
                                </div>

                                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                    <strong style={{ color: 'var(--accent-amber)' }}>2. Tactical Geofencing & Behavior</strong>
                                    <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <li>Direct-on-Screen Polygon Restricted Area Drawing</li>
                                        <li>Directional Tripwires (Inbound/Outbound)</li>
                                        <li>Night Stealth Prone/Crawl Posture Anomaly</li>
                                        <li>Perimeter Loitering Dwell Time Alerts</li>
                                    </ul>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button onClick={() => setShowPitchModal(false)} className="btn-tactical" style={{ padding: '8px 18px' }}>
                                    CLOSE & CONTINUE LIVE DEMO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
