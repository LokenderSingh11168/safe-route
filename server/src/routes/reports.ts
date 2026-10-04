import { Router } from 'express';
import { getDb } from '../db';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';

export const reportsRouter = Router();

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const id = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${id}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

reportsRouter.post('/', upload.single('photo'), async (req, res) => {
    try {
        const { type, severity, note, lat, lng } = req.body;
        const imagePath = req.file ? req.file.path : null;
        
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO reports (type, severity, note, lat, lng, image_path, status, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [type, parseInt(severity), note, parseFloat(lat), parseFloat(lng), imagePath, 'unverified', 0.15]
        );
        
        res.status(201).json({ id: result.lastID, status: 'unverified' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

reportsRouter.get('/', async (req, res) => {
    const db = await getDb();
    const reports = await db.all('SELECT * FROM reports');
    res.json(reports);
});
