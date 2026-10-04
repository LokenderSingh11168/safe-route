import { Router } from 'express';
import { getDb } from '../db';

export const riskRouter = Router();

// A simple risk scoring implementation per the requirements
riskRouter.post('/score-route', async (req, res) => {
    const { polyline, duration, distance, segments } = req.body;
    // segments: array of { lat, lng } pairs or start/end.
    
    // In a real implementation we would decode the polyline and do spatial queries
    // Here we will do a simplified bounding box or distance check based on segments against DB events
    
    const db = await getDb();
    const events = await db.all('SELECT * FROM events');
    const reports = await db.all('SELECT * FROM reports');
    
    let crimeRisk = 0;
    let roadRisk = 0;
    const flaggedSegments: any[] = [];
    
    // Very simplified scoring mock due to spatial query constraints in basic sqlite without spatiaLite
    // If the route has any events nearby (we just simulate it based on distance from the first segment)
    // Actually, we'll just mock the score for now to satisfy the UI, or do a basic loop
    
    if (segments && segments.length > 0) {
        for (const segment of segments) {
            let segCrime = 0;
            let segRoad = 0;
            
            // basic distance mock
            for (const ev of events) {
                const dist = Math.sqrt(Math.pow(ev.lat - segment.lat, 2) + Math.pow(ev.lng - segment.lng, 2));
                if (dist < 0.01) { // roughly 1km
                    segCrime += ev.severity * ev.confidence;
                }
            }
            
            for (const rep of reports) {
                const dist = Math.sqrt(Math.pow(rep.lat - segment.lat, 2) + Math.pow(rep.lng - segment.lng, 2));
                if (dist < 0.01) {
                    segRoad += (rep.severity / 5) * (rep.weight || 0.15);
                }
            }
            
            crimeRisk += segCrime;
            roadRisk += segRoad;
            
            if (segCrime > 0.5 || segRoad > 0.5) {
                flaggedSegments.push({
                    lat: segment.lat, lng: segment.lng,
                    reason: segCrime > 0.5 ? 'High crime risk' : 'Severe road hazard',
                    sources: []
                });
            }
        }
    }
    
    // normalize 0-100
    crimeRisk = Math.min(100, crimeRisk * 10);
    roadRisk = Math.min(100, roadRisk * 10);
    
    const safetyScore = 100 - (0.65 * crimeRisk + 0.35 * roadRisk);
    
    let riskLevel = 'Low';
    if (safetyScore < 40) riskLevel = 'Critical';
    else if (safetyScore < 70) riskLevel = 'High';
    else if (safetyScore < 90) riskLevel = 'Medium';
    
    res.json({
        safetyScore: Math.round(safetyScore),
        riskLevel,
        crimeRisk: Math.round(crimeRisk),
        roadRisk: Math.round(roadRisk),
        flaggedSegments
    });
});
