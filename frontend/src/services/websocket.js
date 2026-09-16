class WebSocketClient {
    constructor() {
        this.ws = null;
        this.listeners = new Set();
        this.reconnectTimeout = null;
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            this.ws = new WebSocket('ws://localhost:8000/ws/alerts');

            this.ws.onopen = () => {
                console.log('[WebSocket] Connected to Tactical Alert Feed');
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.listeners.forEach((callback) => callback(message));
                } catch (e) {
                    console.error('[WebSocket] Message parse error:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('[WebSocket] Connection closed. Reconnecting in 3s...');
                this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
            };

            this.ws.onerror = (err) => {
                console.error('[WebSocket] Error:', err);
                if (this.ws) this.ws.close();
            };
        } catch (e) {
            console.error('[WebSocket] Connection failed:', e);
            this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        }
    }

    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    disconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.ws) this.ws.close();
    }
}

export const wsClient = new WebSocketClient();
