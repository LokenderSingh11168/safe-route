import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { getTelephonyProvider } from '../services/telephony';
import twilio from 'twilio';

export const sosRouter = Router();

// In-memory active sessions map (since we need background processing/timers)
// In a real distributed system this would be in Redis.
const activeSessions: Record<string, any> = {};

export type SosState = {
    sessionId: string;
    status: 'locating' | 'calling' | 'no_answer_advancing' | 'connected' | 'fallback' | 'cancelled' | 'exhausted_failed';
    location?: { lat: number; lng: number; accuracy?: number; mapsUrl: string };
    currentTarget?: { type: 'police' | 'safepath_team'; name: string; phone: string; index: number; total: number };
    attempts: Array<{ target: string; outcome: 'ringing' | 'no_answer' | 'busy' | 'failed' | 'answered' | 'cancelled'; at: string }>;
    fallbackNumber: '8696319388';
    simulation: boolean;
};

const getSosState = async (sessionId: string): Promise<SosState> => {
    const db = await getDb();
    const session = await db.get('SELECT * FROM sos_sessions WHERE id = ?', [sessionId]);
    if (!session) throw new Error('Session not found');

    const attemptsRows = await db.all('SELECT * FROM sos_attempts WHERE session_id = ? ORDER BY at ASC', [sessionId]);
    
    let location: any = undefined;
    if (session.lat && session.lng) {
        location = {
            lat: session.lat,
            lng: session.lng,
            accuracy: session.accuracy,
            mapsUrl: session.maps_url
        };
    }

    // Recover current target from activeSessions or calculate it
    const active = activeSessions[sessionId];
    let currentTarget = active?.currentTarget;

    return {
        sessionId: session.id,
        status: session.status as any,
        location,
        currentTarget,
        attempts: attemptsRows.map((row: any) => ({
            target: row.target,
            outcome: row.outcome as any,
            at: row.at
        })),
        fallbackNumber: '8696319388',
        simulation: Boolean(session.simulation)
    };
};

sosRouter.post('/start', async (req, res) => {
    const sessionId = uuidv4(); // Or use clientRequestId if provided for idempotency
    const db = await getDb();
    
    const isSim = process.env.TELEPHONY_MODE === 'simulation';
    
    await db.run(
        'INSERT INTO sos_sessions (id, status, fallback_number, simulation) VALUES (?, ?, ?, ?)',
        [sessionId, 'locating', '8696319388', isSim ? 1 : 0]
    );

    activeSessions[sessionId] = {
        id: sessionId,
        status: 'locating',
        timer: null
    };

    res.json(await getSosState(sessionId));
});

sosRouter.patch('/:sessionId/location', async (req, res) => {
    const { sessionId } = req.params;
    const { lat, lng, accuracy } = req.body;
    const db = await getDb();
    
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    
    await db.run(
        'UPDATE sos_sessions SET lat = ?, lng = ?, accuracy = ?, maps_url = ?, status = ? WHERE id = ?',
        [lat, lng, accuracy, mapsUrl, 'calling', sessionId]
    );

    const session = activeSessions[sessionId];
    if (session && session.status !== 'cancelled') {
        session.status = 'calling';
        // Kick off calling process
        await advanceCallQueue(sessionId, lat, lng, mapsUrl);
    }

    res.json(await getSosState(sessionId));
});

sosRouter.get('/:sessionId', async (req, res) => {
    try {
        const state = await getSosState(req.params.sessionId);
        res.json(state);
    } catch (e) {
        res.status(404).json({ error: 'Not found' });
    }
});

sosRouter.post('/:sessionId/cancel', async (req, res) => {
    const { sessionId } = req.params;
    const db = await getDb();
    
    await db.run('UPDATE sos_sessions SET status = ? WHERE id = ?', ['cancelled', sessionId]);
    
    const active = activeSessions[sessionId];
    if (active) {
        active.status = 'cancelled';
        if (active.timer) {
            clearTimeout(active.timer);
            active.timer = null;
        }
        
        // Cancel via telephony
        const provider = getTelephonyProvider();
        await provider.cancelCall(sessionId);
    }

    res.json(await getSosState(sessionId));
});

async function advanceCallQueue(sessionId: string, lat: number, lng: number, mapsUrl: string) {
    const active = activeSessions[sessionId];
    if (!active || active.status === 'cancelled') return;

    const db = await getDb();
    const sessionRow = await db.get('SELECT * FROM sos_sessions WHERE id = ?', [sessionId]);
    if (sessionRow.status === 'cancelled' || sessionRow.status === 'connected') return;

    // Fetch nearest stations (simplified without PostGIS here, just getting all and sorting)
    const stations = await db.all('SELECT * FROM police_stations WHERE verified = 1');
    // Implement haversine sort here if needed, skipping for brevity in mock
    
    let targetIndex = sessionRow.current_target_index || 0;
    
    if (targetIndex < stations.length) {
        const target = stations[targetIndex];
        active.currentTarget = {
            type: 'police',
            name: target.name,
            phone: target.phone,
            index: targetIndex + 1,
            total: stations.length
        };
        
        await db.run('UPDATE sos_sessions SET current_target_index = ?, status = ? WHERE id = ?', [targetIndex + 1, 'calling', sessionId]);
        
        await placeCall(sessionId, target.phone, `SafePath emergency alert. A user needs help. Press 1 to accept.`, target.name);

        // Watchdog timer
        active.timer = setTimeout(async () => {
            if (activeSessions[sessionId]?.status !== 'connected' && activeSessions[sessionId]?.status !== 'cancelled') {
                console.log(`Watchdog timeout for session ${sessionId}, advancing queue`);
                await db.run('UPDATE sos_sessions SET status = ? WHERE id = ?', ['no_answer_advancing', sessionId]);
                await advanceCallQueue(sessionId, lat, lng, mapsUrl);
            }
        }, 30000); // 30s timeout
    } else {
        // Fallback to response team
        const fallback = sessionRow.fallback_number || '8696319388';
        active.currentTarget = {
            type: 'safepath_team',
            name: 'SafePath Response Team',
            phone: fallback,
            index: 1,
            total: 1
        };
        
        await db.run('UPDATE sos_sessions SET status = ? WHERE id = ?', ['fallback', sessionId]);
        await placeCall(sessionId, fallback, `SafePath emergency alert. A user needs help. Press 1 to accept.`, 'SafePath Team');
        
        const provider = getTelephonyProvider();
        await provider.sendSms(fallback, `SafePath SOS Alert! Location: ${mapsUrl}`);

        active.timer = setTimeout(async () => {
            if (activeSessions[sessionId]?.status !== 'connected' && activeSessions[sessionId]?.status !== 'cancelled') {
                await db.run('UPDATE sos_sessions SET status = ? WHERE id = ?', ['exhausted_failed', sessionId]);
                // In a real system, we'd probably loop or instruct the user to call 112.
            }
        }, 30000);
    }
}

async function placeCall(sessionId: string, phone: string, message: string, targetName: string) {
    const provider = getTelephonyProvider();
    const db = await getDb();
    
    await db.run('INSERT INTO sos_attempts (session_id, target, outcome) VALUES (?, ?, ?)', [sessionId, targetName, 'ringing']);
    
    if (process.env.TELEPHONY_MODE === 'simulation') {
        // Mock progression for simulation
        const isSimulateAnswer = activeSessions[sessionId]?.currentTarget?.type === 'safepath_team';
        
        setTimeout(async () => {
            if (activeSessions[sessionId]?.status === 'cancelled') return;
            
            if (isSimulateAnswer) {
                // Simulate answer
                await db.run('UPDATE sos_sessions SET status = ? WHERE id = ?', ['connected', sessionId]);
                await db.run('INSERT INTO sos_attempts (session_id, target, outcome) VALUES (?, ?, ?)', [sessionId, targetName, 'answered']);
                clearTimeout(activeSessions[sessionId].timer);
            } else {
                // Simulate no answer
                await db.run('INSERT INTO sos_attempts (session_id, target, outcome) VALUES (?, ?, ?)', [sessionId, targetName, 'no_answer']);
            }
        }, 5000);
    } else {
        await provider.placeCall(phone, sessionId, message);
    }
}
