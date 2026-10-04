import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { sosRouter } from './routes/sos';
import { reportsRouter } from './routes/reports';
import { riskRouter } from './routes/risk';
import { telephonyRouter } from './routes/telephony';
import { getDb } from './db';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' }); // Load from root
dotenv.config(); // fallback to local .env

const app = express();
const logger = pino({ transport: { target: 'pino-pretty' } });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests'
});
app.use(limiter);

// Request Logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/sos', sosRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/risk', riskRouter);
app.use('/api/telephony', telephonyRouter);
// We will add more routes for risk, routing, telephony, etc.

const PORT = process.env.PORT || 3000;

const start = async () => {
    try {
        await getDb(); // Initialize DB
        logger.info('Database initialized');
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (e: unknown) {
        logger.error({ err: e }, 'Failed to start server');
        process.exit(1);
    }
};

start();
