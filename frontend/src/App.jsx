import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CameraGrid from './components/CameraGrid';
import AlertFeed from './components/AlertFeed';
import WatchlistManager from './components/WatchlistManager';

import { cameraService, alertService, analyticsService } from './services/api';
import { wsClient } from './services/websocket';
import { tacticalSound } from './utils/sound';

export default function App() {
    const [currentTab, setTab] = useState('grid');
    const [cameras, setCameras] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState(null);
    const [telemetryMap, setTelemetryMap] = useState({});
    const [isMuted, setIsMuted] = useState(false);

    // Initial Load
    useEffect(() => {
        loadCameras();
        loadAlerts();
        loadStats();

        // Connect WebSocket
        wsClient.connect();
        const removeListener = wsClient.addListener(handleWebSocketMessage);

        const pollInterval = setInterval(() => {
            loadStats();
        }, 5000);

        return () => {
            removeListener();
            clearInterval(pollInterval);
        };
    }, []);

    const handleWebSocketMessage = (msg) => {
        if (msg.type === 'NEW_ALERT') {
            const newAlert = msg.data;
            setAlerts((prev) => [newAlert, ...prev.slice(0, 99)]);
            
            // Trigger audio siren if critical
            if (newAlert.severity === 'CRITICAL') {
                tacticalSound.playCriticalAlarm();
            } else {
                tacticalSound.playWarningBeep();
            }

            loadStats();
        } else if (msg.type === 'TELEMETRY' && msg.cameras) {
            const newMap = {};
            msg.cameras.forEach((cam) => {
                newMap[cam.camera_id] = cam;
            });
            setTelemetryMap(newMap);
        }
    };

    const loadCameras = async () => {
        try {
            const res = await cameraService.getAll();
            setCameras(res.data);
        } catch (err) {
            console.error('Failed to load cameras', err);
        }
    };

    const loadAlerts = async () => {
        try {
            const res = await alertService.getAll({ limit: 100 });
            setAlerts(res.data);
        } catch (err) {
            console.error('Failed to load alerts', err);
        }
    };

    const loadStats = async () => {
        try {
            const res = await analyticsService.getDashboardStats();
            setStats(res.data);
        } catch (err) {
            console.error('Failed to load stats', err);
        }
    };

    const handleToggleMute = () => {
        const next = !isMuted;
        setIsMuted(next);
        tacticalSound.setMuted(next);
    };

    const activeThreatsCount = alerts.filter((a) => a.status === 'ACTIVE').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {/* Top Navigation */}
            <Navbar
                stats={stats}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                activeThreatsCount={activeThreatsCount}
            />

            {/* Main Application Layout */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Sidebar
                    currentTab={currentTab}
                    setTab={setTab}
                    alertCount={activeThreatsCount}
                />

                <main style={{ flex: 1, backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
                    {currentTab === 'grid' && (
                        <CameraGrid
                            cameras={cameras}
                            telemetryMap={telemetryMap}
                            onRefreshCameras={loadCameras}
                        />
                    )}

                    {currentTab === 'alerts' && (
                        <AlertFeed
                            alerts={alerts}
                            onRefreshAlerts={loadAlerts}
                            onAlertStatusUpdated={loadStats}
                        />
                    )}

                    {currentTab === 'frs' && <WatchlistManager activeTab="frs" />}
                    {currentTab === 'anpr' && <WatchlistManager activeTab="anpr" />}
                </main>
            </div>
        </div>
    );
}
