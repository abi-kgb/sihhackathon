import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const cameraService = {
    getAll: () => api.get('/cameras/'),
    getById: (id) => api.get(`/cameras/${id}`),
    create: (data) => api.post('/cameras/', data),
    update: (id, data) => api.put(`/cameras/${id}`, data),
    delete: (id) => api.delete(`/cameras/${id}`),
    toggleNightMode: (id) => api.post(`/cameras/${id}/toggle-night-mode`),
    getTelemetry: (id) => api.get(`/cameras/${id}/telemetry`),
    getStreamUrl: (id, annotated = true) => `http://localhost:8000/api/v1/cameras/${id}/stream?annotated=${annotated}`,
    
    switchSource: (id, streamType, streamUrl = null) => {
        return api.post(`/cameras/${id}/switch-source`, {
            stream_type: streamType,
            stream_url: streamUrl
        });
    },
    
    uploadVideo: (id, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/cameras/${id}/upload-video`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    getUploadedVideos: () => api.get('/cameras/uploaded-videos/list'),
    captureFace: (id, imageBase64 = null) => api.post(`/cameras/${id}/capture-face`, { image_base64: imageBase64 }),
    capturePlate: (id, imageBase64 = null) => api.post(`/cameras/${id}/capture-plate`, { image_base64: imageBase64 }),
};

export const zoneService = {
    getByCameraId: (camId) => api.get(`/zones/camera/${camId}`),
    create: (data) => api.post('/zones/', data),
    delete: (id) => api.delete(`/zones/${id}`),
    clearAllByCameraId: (camId) => api.post(`/zones/camera/${camId}/clear-all`),
    toggle: (id) => api.put(`/zones/${id}/toggle`),
};

export const watchlistService = {
    getPersons: () => api.get('/watchlists/persons'),
    createPerson: (formData) => api.post('/watchlists/persons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    registerPersonDirect: (data) => api.post('/watchlists/persons/register-direct', data),
    deletePerson: (id) => api.delete(`/watchlists/persons/${id}`),
    
    getVehicles: () => api.get('/watchlists/vehicles'),
    createVehicle: (data) => api.post('/watchlists/vehicles', data),
    deleteVehicle: (id) => api.delete(`/watchlists/vehicles/${id}`),
};

export const alertService = {
    getAll: (params) => api.get('/alerts/', { params }),
    getById: (id) => api.get(`/alerts/${id}`),
    updateStatus: (id, data) => api.put(`/alerts/${id}/status`, data),
    delete: (id) => api.delete(`/alerts/${id}`),
    clearAll: () => api.post('/alerts/clear-all'),
    simulate: (alertType) => api.post('/alerts/simulate', { alert_type: alertType }),
};

export const analyticsService = {
    getDashboardStats: () => api.get('/analytics/dashboard-stats'),
    getThreatBreakdown: () => api.get('/analytics/threat-breakdown'),
    getSystemTelemetry: () => api.get('/analytics/system-telemetry'),
};
