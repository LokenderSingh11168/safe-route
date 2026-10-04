import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export const getDb = async () => {
    if (db) return db;

    db = await open({
        filename: process.env.DATABASE_URL?.replace('sqlite:', '') || './dev.sqlite',
        driver: sqlite3.Database
    });

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.exec(schema);

    // Seed some data for test
    const stations = await db.get('SELECT COUNT(*) as count FROM police_stations');
    if (stations && stations.count === 0) {
        await db.run('INSERT INTO police_stations (name, phone, lat, lng, verified) VALUES (?, ?, ?, ?, ?)', ['Test Station 1', '1234567890', 28.6139, 77.2090, 1]);
    }

    return db;
};
