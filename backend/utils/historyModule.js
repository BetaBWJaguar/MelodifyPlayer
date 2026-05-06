const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDatabase() {
    const projectDir = path.join(__dirname, '../../');
    const dbPath = path.join(projectDir, 'melodify.db');

    db = new Database(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT NOT NULL,
            track_name TEXT,
            artist_name TEXT,
            image TEXT,
            played_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_play_history_played_at 
        ON play_history(played_at DESC)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_play_history_track_id 
        ON play_history(track_id)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_play_history_artist_name 
        ON play_history(artist_name)
    `);

    console.log('History database initialized at:', dbPath);
}

function addToHistory(track) {
    if (!db) initDatabase();

    const trackId = track.id || track.videoId || null;
    if (!trackId) {
        console.warn('Cannot add to history: missing track id');
        return false;
    }

    const stmt = db.prepare(`
        INSERT INTO play_history (track_id, track_name, artist_name, image)
        VALUES (?, ?, ?, ?)
    `);

    const image = track.image || track.thumbnail || null;
    stmt.run(
        trackId,
        track.name || track.title || null,
        track.artist || track.artist_name || null,
        image
    );

    return true;
}

function getRecentTracks(limit = 6) {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        SELECT track_id as id, track_name as name, artist_name as artist, image, MAX(played_at) as played_at
        FROM play_history
        GROUP BY track_id
        ORDER BY played_at DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

function getTopArtists(limit = 6) {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        SELECT artist_name as name, COUNT(*) as count
        FROM play_history
        WHERE artist_name IS NOT NULL AND artist_name != ''
        GROUP BY artist_name
        ORDER BY count DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

function getHistory(limit = 50) {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        SELECT track_id as id, track_name as name, artist_name as artist, image, played_at
        FROM play_history
        ORDER BY played_at DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

function clearHistory() {
    if (!db) initDatabase();

    const stmt = db.prepare('DELETE FROM play_history');
    const result = stmt.run();

    return result.changes;
}

module.exports = {
    initDatabase,
    addToHistory,
    getRecentTracks,
    getTopArtists,
    getHistory,
    clearHistory
};
