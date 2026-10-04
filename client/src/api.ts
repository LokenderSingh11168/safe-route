const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const startSos = async () => {
    const res = await fetch(`${API_BASE}/sos/start`, { method: 'POST' });
    return res.json();
};

export const updateSosLocation = async (sessionId: string, lat: number, lng: number, accuracy: number) => {
    const res = await fetch(`${API_BASE}/sos/${sessionId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, accuracy })
    });
    return res.json();
};

export const cancelSos = async (sessionId: string) => {
    const res = await fetch(`${API_BASE}/sos/${sessionId}/cancel`, { method: 'POST' });
    return res.json();
};

export const getSosState = async (sessionId: string) => {
    const res = await fetch(`${API_BASE}/sos/${sessionId}`);
    return res.json();
};

export const scoreRoute = async (polyline: string, duration: number, distance: number, segments: any[]) => {
    const res = await fetch(`${API_BASE}/risk/score-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polyline, duration, distance, segments })
    });
    return res.json();
};

export const submitReport = async (formData: FormData) => {
    const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        body: formData
    });
    return res.json();
};
