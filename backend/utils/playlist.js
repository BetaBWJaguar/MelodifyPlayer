const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

let db;

function generateTrackId(name, artist) {
    const hash = crypto.createHash('md5');
    hash.update(`${name}|${artist}`.toLowerCase().trim());
    return `local_${hash.digest('hex')}`;
}

function initDatabase() {
    const projectDir = path.join(__dirname, '../../');
    const dbPath = path.join(projectDir, 'melodify.db');
    
    db = new Database(dbPath);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            cover_image TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS playlist_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            track_id TEXT NOT NULL,
            track_name TEXT,
            artist_name TEXT,
            duration INTEGER,
            image TEXT,
            gradient TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            custom_order INTEGER,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            UNIQUE(playlist_id, track_id)
        )
    `);
    
}

function createPlaylist(playlistData) {
    if (!db) initDatabase();
    
    const stmt = db.prepare(`
        INSERT INTO playlists
        (name, description, cover_image)
        VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(
        playlistData.name,
        playlistData.description || null,
        playlistData.cover_image || null
    );
    
    return {
        id: result.lastInsertRowid,
        ...playlistData
    };
}

function getAllPlaylists() {
    if (!db) initDatabase();
    
    const stmt = db.prepare(`
        SELECT 
            p.*,
            (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
        FROM playlists p
        ORDER BY p.created_at DESC
    `);
    const playlists = stmt.all();
    
    return playlists;
}

function getPlaylistById(playlistId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT * FROM playlists WHERE id = ?');
    const playlist = stmt.get(playlistId);
    
    return playlist;
}

function updatePlaylist(playlistId, playlistData) {
    if (!db) initDatabase();
    
    const updates = [];
    const values = [];
    
    if (playlistData.name !== undefined) {
        updates.push('name = ?');
        values.push(playlistData.name);
    }
    
    if (playlistData.description !== undefined) {
        updates.push('description = ?');
        values.push(playlistData.description);
    }
    
    if (playlistData.cover_image !== undefined) {
        updates.push('cover_image = ?');
        values.push(playlistData.cover_image);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updates.length === 1) {
        return false;
    }
    
    const query = `
        UPDATE playlists
        SET ${updates.join(', ')}
        WHERE id = ?
    `;
    
    values.push(playlistId);
    
    const stmt = db.prepare(query);
    const result = stmt.run(...values);
    
    return result.changes > 0;
}

function deletePlaylist(playlistId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('DELETE FROM playlists WHERE id = ?');
    const result = stmt.run(playlistId);
    
    return result.changes > 0;
}

function addSongToPlaylist(playlistId, track) {
    if (!db) initDatabase();
    
    const trackId = (track.id !== undefined && track.id !== null) ? track.id : (track.videoId || generateTrackId(track.name || track.title, track.artist));
    const image = track.image || track.thumbnail || null;
    
    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ? AND track_id = ?');
    const checkResult = checkStmt.get(playlistId, trackId);
    
    if (checkResult.count > 0) {
        return false;
    }
    
    const stmt = db.prepare(`
        INSERT INTO playlist_songs
        (playlist_id, track_id, track_name, artist_name, duration, image, gradient, custom_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const maxOrderStmt = db.prepare('SELECT COALESCE(MAX(custom_order), 0) as max_order FROM playlist_songs WHERE playlist_id = ?');
    const maxOrderResult = maxOrderStmt.get(playlistId);
    const nextOrder = (maxOrderResult.max_order || 0) + 1;
    
    const result = stmt.run(
        playlistId,
        trackId,
        track.name || track.title,
        track.artist,
        track.duration,
        image,
        track.gradient,
        nextOrder
    );
    
    return result.changes > 0;
}

function removeSongFromPlaylist(playlistId, trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND track_id = ?');
    const result = stmt.run(playlistId, trackId);
    
    return result.changes > 0;
}

function getPlaylistSongs(playlistId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare(`
        SELECT * FROM playlist_songs
        WHERE playlist_id = ?
        ORDER BY custom_order ASC, added_at DESC
    `);
    const songs = stmt.all(playlistId);
    
    return songs;
}

function isSongInPlaylist(playlistId, trackId) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ? AND track_id = ?');
    const result = stmt.get(playlistId, trackId);
    
    return result.count > 0;
}

function updateSongOrder(playlistId, trackId, newOrder) {
    if (!db) initDatabase();
    
    const stmt = db.prepare('UPDATE playlist_songs SET custom_order = ? WHERE playlist_id = ? AND track_id = ?');
    const result = stmt.run(newOrder, playlistId, trackId);
    
    return result.changes > 0;
}

function reorderPlaylistSongs(playlistId, draggedId, targetId) {
    if (!db) initDatabase();
    
    const draggedStmt = db.prepare('SELECT custom_order FROM playlist_songs WHERE playlist_id = ? AND track_id = ?');
    const dragged = draggedStmt.get(playlistId, draggedId);
    const targetStmt = db.prepare('SELECT custom_order FROM playlist_songs WHERE playlist_id = ? AND track_id = ?');
    const target = targetStmt.get(playlistId, targetId);
    
    if (!dragged || !target) {
        console.error('Track not found:', { dragged, target });
        return false;
    }
    
    const draggedOrder = dragged.custom_order;
    const targetOrder = target.custom_order;
    
    if (draggedOrder < targetOrder) {
        const shiftStmt = db.prepare('UPDATE playlist_songs SET custom_order = custom_order - 1 WHERE playlist_id = ? AND custom_order > ? AND custom_order <= ?');
        shiftStmt.run(playlistId, draggedOrder, targetOrder);
    }
    else if (draggedOrder > targetOrder) {
        const shiftStmt = db.prepare('UPDATE playlist_songs SET custom_order = custom_order + 1 WHERE playlist_id = ? AND custom_order >= ? AND custom_order < ?');
        shiftStmt.run(playlistId, targetOrder, draggedOrder);
    }
    
    const updateStmt = db.prepare('UPDATE playlist_songs SET custom_order = ? WHERE playlist_id = ? AND track_id = ?');
    const result = updateStmt.run(targetOrder, playlistId, draggedId);
    
    return result.changes > 0;
}

module.exports = {
    initDatabase,
    createPlaylist,
    getAllPlaylists,
    getPlaylistById,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getPlaylistSongs,
    isSongInPlaylist,
    updateSongOrder,
    reorderPlaylistSongs
};
