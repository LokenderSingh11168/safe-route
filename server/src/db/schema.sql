CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    severity REAL NOT NULL,
    confidence REAL NOT NULL,
    published_timestamp DATETIME,
    fetched_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    precision TEXT
);

CREATE TABLE IF NOT EXISTS event_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    url TEXT,
    publisher TEXT,
    source_type TEXT NOT NULL,
    raw_text TEXT,
    FOREIGN KEY(event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    severity INTEGER NOT NULL,
    note TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    image_path TEXT,
    status TEXT DEFAULT 'unverified',
    weight REAL DEFAULT 0.15,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    upvotes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS police_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    verified BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sos_sessions (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    fallback_number TEXT NOT NULL,
    simulation BOOLEAN DEFAULT 0,
    current_target_index INTEGER DEFAULT 0,
    lat REAL,
    lng REAL,
    accuracy REAL,
    maps_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sos_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    target TEXT NOT NULL,
    outcome TEXT NOT NULL,
    at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sos_sessions(id)
);
