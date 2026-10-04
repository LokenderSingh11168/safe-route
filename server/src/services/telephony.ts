export interface TelephonyProvider {
    placeCall(to: string, sessionId: string, message: string): Promise<boolean>;
    cancelCall(sessionId: string): Promise<void>;
    sendSms(to: string, body: string): Promise<void>;
}

export class SimulationProvider implements TelephonyProvider {
    async placeCall(to: string, sessionId: string, message: string): Promise<boolean> {
        console.log(`[SIMULATION] Placing call to ${to} for session ${sessionId}`);
        return true;
    }

    async cancelCall(sessionId: string): Promise<void> {
        console.log(`[SIMULATION] Cancelling call for session ${sessionId}`);
    }

    async sendSms(to: string, body: string): Promise<void> {
        console.log(`[SIMULATION] Sending SMS to ${to}: ${body}`);
    }
}

import twilio from 'twilio';

export class TwilioProvider implements TelephonyProvider {
    private client: twilio.Twilio;

    constructor() {
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }

    async placeCall(to: string, sessionId: string, message: string): Promise<boolean> {
        try {
            const baseUrl = process.env.PUBLIC_BASE_URL;
            const twimlUrl = `${baseUrl}/api/telephony/voice?message=${encodeURIComponent(message)}&sessionId=${encodeURIComponent(sessionId)}`;
            
            await this.client.calls.create({
                to,
                from: process.env.TWILIO_FROM_NUMBER!,
                url: twimlUrl,
                statusCallback: `${baseUrl}/api/telephony/status?sessionId=${encodeURIComponent(sessionId)}`,
                statusCallbackEvent: ['completed', 'answered', 'no-answer', 'busy', 'failed', 'canceled']
            });
            return true;
        } catch (error) {
            console.error('Twilio placeCall error:', error);
            return false;
        }
    }

    async cancelCall(sessionId: string): Promise<void> {
        // Find active call by session ID from DB/Memory and update it to canceled
        // Here we'd need to store the Call SID against the sessionId when it's created,
        // but for now we might have to list calls or pass Call SID.
        // Simplified for this implementation
        console.log(`[TWILIO] Cancellation requested for session ${sessionId}`);
    }

    async sendSms(to: string, body: string): Promise<void> {
        try {
            await this.client.messages.create({
                body,
                from: process.env.TWILIO_FROM_NUMBER!,
                to
            });
        } catch (error) {
            console.error('Twilio sendSms error:', error);
        }
    }
}

export const getTelephonyProvider = (): TelephonyProvider => {
    if (process.env.TELEPHONY_MODE === 'twilio') {
        return new TwilioProvider();
    }
    return new SimulationProvider();
};
