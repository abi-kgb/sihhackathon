import React from 'react';
import {
    LayoutGrid,
    ShieldAlert,
    Users,
    Car
} from 'lucide-react';

export default function Sidebar({ currentTab, setTab, alertCount }) {
    const navItems = [
        { id: 'grid', label: 'Surveillance Matrix', icon: LayoutGrid, count: null },
        { id: 'alerts', label: 'Threat Response Desk', icon: ShieldAlert, count: alertCount },
        { id: 'frs', label: 'FRS Biometrics', icon: Users, count: null },
        { id: 'anpr', label: 'ANPR Vehicles', icon: Car, count: null },
    ];

    return (
        <aside style={{
            width: '240px',
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px 10px',
            userSelect: 'none'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    padding: '4px 10px',
                    letterSpacing: '1px'
                }}>
                    TACTICAL MODULES
                </div>

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '5px',
                                border: isActive ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                                background: isActive ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'left',
                                fontFamily: 'var(--font-tactical)',
                                fontWeight: isActive ? '600' : '500',
                                fontSize: '0.88rem'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Icon size={18} color={isActive ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                                <span>{item.label}</span>
                            </div>
                            {item.count !== null && item.count > 0 && (
                                <span className="badge badge-critical" style={{ padding: '1px 6px', fontSize: '0.68rem' }}>
                                    {item.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Bottom Status Block */}
            <div className="tactical-card" style={{ padding: '12px', marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-green)'
                    }} />
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                        LOCAL EDGE ENGINE
                    </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    BOP Sector Alpha Network
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    IP: 192.168.10.15:8000
                </div>
            </div>
        </aside>
    );
}
