import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Shield, AlertTriangle } from 'lucide-react';

// Custom Tactical Marker Icons
const createTacticalIcon = (color, label) => {
    return L.divIcon({
        className: 'custom-tactical-marker',
        html: `
            <div style="
                background: ${color};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 2px solid #fff;
                box-shadow: 0 0 12px ${color};
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
                font-weight: bold;
                color: #000;
            ">
                ${label}
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

export default function TacticalMap({ cameras, alerts, onSelectCamera }) {
    const center = [34.1253, 74.8329];

    // Check which cameras have active alerts
    const activeThreatCameras = new Set(
        alerts.filter(a => a.status === 'ACTIVE').map(a => a.camera_id)
    );

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MapPin size={22} color="var(--accent-cyan)" />
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
                            TACTICAL GIS BORDER OUTPOST (BOP) MAP
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            REAL-TIME GEOSPATIAL INTELLIGENCE & SURVEILLANCE RADAR
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-green)' }} />
                        <span>BOP NOMINAL</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-crimson)' }} />
                        <span>ACTIVE BREACH</span>
                    </div>
                </div>
            </div>

            {/* Leaflet Map Card */}
            <div className="tactical-card" style={{ height: '620px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <MapContainer
                    center={center}
                    zoom={12}
                    style={{ width: '100%', height: '100%', backgroundColor: '#070b12' }}
                >
                    {/* Dark Matter / Tactical Map Tiles */}
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    {/* Border Perimeter Line Simulation */}
                    <Polygon
                        positions={[
                            [34.1600, 74.8100],
                            [34.1350, 74.8350],
                            [34.1050, 74.8700],
                            [34.0650, 74.9100]
                        ]}
                        pathOptions={{
                            color: '#00f0ff',
                            weight: 2,
                            dashArray: '6, 6',
                            fillOpacity: 0.05
                        }}
                    />

                    {/* Camera Outposts Pins */}
                    {cameras.map((cam, idx) => {
                        const hasAlert = activeThreatCameras.has(cam.id);
                        const markerColor = hasAlert ? '#ff2a5f' : '#00ff9d';
                        const icon = createTacticalIcon(markerColor, `C${cam.id}`);

                        return (
                            <React.Fragment key={cam.id}>
                                <Marker position={[cam.latitude, cam.longitude]} icon={icon}>
                                    <Popup>
                                        <div style={{ color: '#000', fontFamily: 'sans-serif' }}>
                                            <strong>{cam.name}</strong>
                                            <br />
                                            BOP: {cam.location_bop} ({cam.sector})
                                            <br />
                                            FPS: {cam.fps} | Status: {cam.status.toUpperCase()}
                                            <br />
                                            {hasAlert && <span style={{ color: 'red', fontWeight: 'bold' }}>⚠️ ACTIVE BREACH REPORTED</span>}
                                        </div>
                                    </Popup>
                                </Marker>

                                {/* Surveillance Range / Radar Radius */}
                                <Circle
                                    center={[cam.latitude, cam.longitude]}
                                    radius={650}
                                    pathOptions={{
                                        color: markerColor,
                                        fillColor: markerColor,
                                        fillOpacity: hasAlert ? 0.25 : 0.08,
                                        weight: 1
                                    }}
                                />
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}
