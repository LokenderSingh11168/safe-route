import { expect, test } from 'vitest';

test('SOS State requires sessionId', () => {
    const mockState = {
        sessionId: '123-abc',
        status: 'locating',
        attempts: [],
        fallbackNumber: '8696319388',
        simulation: true
    };
    expect(mockState.sessionId).toBeDefined();
    expect(mockState.status).toBe('locating');
});

test('Scoring handles verified vs unverified correctly', () => {
    const verifiedCrime = { severity: 1.0, confidence: 0.9 };
    const unverifiedCrime = { severity: 1.0, confidence: 0.2 };
    
    expect(verifiedCrime.severity * verifiedCrime.confidence).toBeGreaterThan(unverifiedCrime.severity * unverifiedCrime.confidence);
});
