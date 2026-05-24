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
            duration_seconds REAL DEFAULT 0,
            track_duration REAL DEFAULT 0,
            category TEXT DEFAULT 'other',
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

    try {
        const columns = db.prepare("PRAGMA table_info(play_history)").all();
        const hasCategory = columns.some(col => col.name === 'category');
        if (!hasCategory) {
            db.exec(`ALTER TABLE play_history ADD COLUMN category TEXT DEFAULT 'other'`);
            console.log('Added category column to play_history table');
        }
    } catch (e) {
        console.error('Failed to add category column:', e);
    }

    console.log('History database initialized at:', dbPath);
}

let _hasTrackDurationColumn = null;

function _checkTrackDurationColumn() {
    if (_hasTrackDurationColumn !== null) return _hasTrackDurationColumn;
    if (!db) initDatabase();
    try {
        const columns = db.prepare("PRAGMA table_info(play_history)").all();
        _hasTrackDurationColumn = columns.some(col => col.name === 'track_duration');
    } catch (e) {
        _hasTrackDurationColumn = false;
    }
    return _hasTrackDurationColumn;
}

function addToHistory(track) {
    if (!db) initDatabase();

    const trackId = track.id || track.videoId || null;
    if (!trackId) {
        console.warn('Cannot add to history: missing track id');
        return null;
    }

    const image = track.image || track.thumbnail || null;
    const hasTrackDuration = _checkTrackDurationColumn();

    let result;
    if (hasTrackDuration) {
        const trackDuration = track.duration || 0;
        const stmt = db.prepare(`
            INSERT INTO play_history (track_id, track_name, artist_name, image, duration_seconds, track_duration)
            VALUES (?, ?, ?, ?, 0, ?)
        `);
        result = stmt.run(
            trackId,
            track.name || track.title || null,
            track.artist || track.artist_name || null,
            image,
            trackDuration
        );
    } else {
        const stmt = db.prepare(`
            INSERT INTO play_history (track_id, track_name, artist_name, image, duration_seconds)
            VALUES (?, ?, ?, ?, 0)
        `);
        result = stmt.run(
            trackId,
            track.name || track.title || null,
            track.artist || track.artist_name || null,
            image
        );
    }

    return result.lastInsertRowid || null;
}

function updateListeningDuration(rowId, seconds) {
    if (!db) initDatabase();
    if (!rowId) return;

    const stmt = db.prepare(`
        UPDATE play_history SET duration_seconds = ? WHERE id = ?
    `);
    stmt.run(Math.round(seconds * 10) / 10, rowId);
}

function updateTrackDuration(rowId, trackDuration) {
    if (!db) initDatabase();
    if (!rowId || !trackDuration) return;

    if (!_checkTrackDurationColumn()) return;

    const stmt = db.prepare(`
        UPDATE play_history SET track_duration = ? WHERE id = ?
    `);
    stmt.run(trackDuration, rowId);
}

function updateCategory(rowId, category) {
    if (!db) initDatabase();
    if (!rowId || !category) return;

    try {
        const columns = db.prepare("PRAGMA table_info(play_history)").all();
        const hasCategory = columns.some(col => col.name === 'category');
        if (!hasCategory) return;
    } catch (e) {
        return;
    }

    const stmt = db.prepare(`
        UPDATE play_history SET category = ? WHERE id = ?
    `);
    stmt.run(category, rowId);
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
    updateListeningDuration,
    updateTrackDuration,
    updateCategory,
    getRecentTracks,
    getTopArtists,
    getHistory,
    clearHistory
};
