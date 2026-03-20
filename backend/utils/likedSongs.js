const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDatabase() {
    const projectDir = path.join(__dirname, '../../');
    const dbPath = path.join(projectDir, 'melodify.db');
    
    db = new Database(dbPath);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS liked_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id TEXT NOT NULL UNIQUE,
            track_name TEXT,
            artist_name TEXT,
            duration INTEGER,
            image TEXT,
            gradient TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('Database initialized at:', dbPath);
}

function addLikedSong(track) {
    if (!db) initDatabase();
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO liked_songs
        (track_id, track_name, artist_name, duration, image, gradient)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const trackId = track.id || track.videoId;
    const image = track.image || track.thumbnail || null;
    stmt.run(
        trackId,
        track.name || track.title,
        track.artist,
        track.duration,
        image,
        track.gradient
    );
    
    console.log('Added liked song:', trackId, 'with image:', !!image);
    return true;
}

function removeLikedSong(trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('DELETE FROM liked_songs WHERE track_id = ?');
    const result = stmt.run(trackId);
    
    console.log('Removed liked song:', trackId, 'Rows affected:', result.changes);
    return result.changes > 0;
}

function isLiked(trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT COUNT(*) as count FROM liked_songs WHERE track_id = ?');
    const result = stmt.get(trackId);
    
    return result.count > 0;
}

function getAllLikedSongs() {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT * FROM liked_songs ORDER BY created_at DESC');
    const songs = stmt.all();
    
    return songs;
}

function getLikedSong(trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT * FROM liked_songs WHERE track_id = ?');
    const song = stmt.get(trackId);
    
    return song;
}

module.exports = {
    initDatabase,
    addLikedSong,
    removeLikedSong,
    isLiked,
    getAllLikedSongs,
    getLikedSong
};
