const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDatabase() {
    const projectDir = path.join(__dirname, '../../');
    const dbPath = path.join(projectDir, 'melodify.db');
    
    db = new Database(dbPath);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT NOT NULL UNIQUE,
            track_name TEXT,
            artist_name TEXT,
            duration INTEGER,
            image TEXT,
            gradient TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            custom_order INTEGER
        )
    `);
    
    console.log('Favorites database initialized at:', dbPath);
}

function addFavorite(track) {
    if (!db) initDatabase();
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO favorites
        (track_id, track_name, artist_name, duration, image, gradient, notes, custom_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const trackId = track.id || track.videoId;
    const image = track.image || track.thumbnail || null;
    
    const maxOrderStmt = db.prepare('SELECT COALESCE(MAX(custom_order), 0) as max_order FROM favorites');
    const maxOrderResult = maxOrderStmt.get();
    const nextOrder = (maxOrderResult.max_order || 0) + 1;
    
    stmt.run(
        trackId,
        track.name || track.title,
        track.artist,
        track.duration,
        image,
        track.gradient,
        track.notes || null,
        nextOrder
    );
    
    console.log('Added favorite:', trackId, 'with image:', !!image);
    return true;
}

function removeFavorite(trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('DELETE FROM favorites WHERE track_id = ?');
    const result = stmt.run(trackId);
    
    console.log('Removed favorite:', trackId, 'Rows affected:', result.changes);
    return result.changes > 0;
}

function isFavorite(trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT COUNT(*) as count FROM favorites WHERE track_id = ?');
    const result = stmt.get(trackId);
    
    return result.count > 0;
}

function getAllFavorites() {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT * FROM favorites ORDER BY custom_order ASC, created_at DESC');
    const songs = stmt.all();
    
    return songs;
}

function getFavorite(trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT * FROM favorites WHERE track_id = ?');
    const song = stmt.get(trackId);
    
    return song;
}

function updateFavoriteNotes(trackId, notes) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('UPDATE favorites SET notes = ? WHERE track_id = ?');
    const result = stmt.run(notes, trackId);
    
    console.log('Updated favorite notes:', trackId, 'Rows affected:', result.changes);
    return result.changes > 0;
}

function updateFavoriteOrder(trackId, newOrder) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('UPDATE favorites SET custom_order = ? WHERE track_id = ?');
    const result = stmt.run(newOrder, trackId);
    
    console.log('Updated favorite order:', trackId, 'New order:', newOrder, 'Rows affected:', result.changes);
    return result.changes > 0;
}

module.exports = {
    initDatabase,
    addFavorite,
    removeFavorite,
    isFavorite,
    getAllFavorites,
    getFavorite,
    updateFavoriteNotes,
    updateFavoriteOrder
};
