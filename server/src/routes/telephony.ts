import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import twilio from 'twilio';

export const telephonyRouter = Router();

// Validate Twilio signature middleware
const validateTwilioRequest = (req: Request, res: Response, next: Function) => {
    if (process.env.TELEPHONY_MODE === 'simulation') return next();
    
    const signature = req.header('X-Twilio-Signature');
    if (!signature) {
        return res.status(403).send('No signature');
    }

    const url = process.env.PUBLIC_BASE_URL + req.originalUrl;
    const isValid = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN!,
        signature,
        url,
        req.body
    );

    if (!isValid) {
        return res.status(403).send('Invalid Twilio signature');
    }
    next();
};

telephonyRouter.post('/voice', validateTwilioRequest, (req, res) => {
    const { message, sessionId } = req.query;
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Use gather to ensure a human answers
    const gather = twiml.gather({
        action: `/api/telephony/gather?sessionId=${sessionId}`,
        numDigits: 1,
        timeout: 10
    });
    gather.say(message as string || 'SafePath emergency alert. Press 1 to accept.');
    twiml.say('We didn\'t receive any input. Goodbye!');
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
});

telephonyRouter.post('/gather', validateTwilioRequest, async (req, res) => {
    const { sessionId } = req.query;
    const digits = req.body.Digits;
    
    const twiml = new twilio.twiml.VoiceResponse();
    if (digits === '1') {
        const db = await getDb();
        await db.run('UPDATE sos_sessions SET status = ? WHERE id = ?', ['connected', sessionId]);
        // Ideally we fetch location and read it to them
        const session = await db.get('SELECT lat, lng FROM sos_sessions WHERE id = ?', [sessionId]);
        if (session) {
            twiml.say(`Thank you. The user is at latitude ${session.lat}, longitude ${session.lng}. A text with the map link has been sent.`);
        } else {
            twiml.say('Thank you. Location is unknown.');
        }
        twiml.hangup();
    } else {
        twiml.say('Invalid input. Goodbye.');
        twiml.hangup();
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
});

telephonyRouter.post('/status', validateTwilioRequest, async (req, res) => {
    // This is the statusCallback from Twilio
    const { CallStatus } = req.body;
    const { sessionId } = req.query;
    
    // We handle logic via Watchdog, but we can also log status here
    // or trigger advanceCallQueue directly on 'no-answer', 'busy', 'failed'
    
    res.status(200).send();
});
