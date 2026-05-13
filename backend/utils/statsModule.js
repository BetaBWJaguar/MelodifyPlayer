const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
    if (!db) {
        const projectDir = path.join(__dirname, '../../');
        const dbPath = path.join(projectDir, 'melodify.db');
        db = new Database(dbPath);
    }
    return db;
}

function getOverviewStats() {
    const database = getDb();

    const totalPlays = database.prepare('SELECT COUNT(*) as count FROM play_history').get().count;

    const uniqueTracks = database.prepare('SELECT COUNT(DISTINCT track_id) as count FROM play_history').get().count;

    const uniqueArtists = database.prepare("SELECT COUNT(DISTINCT artist_name) as count FROM play_history WHERE artist_name IS NOT NULL AND artist_name != ''").get().count;

    let totalListeningSeconds = 0;
    try {
        totalListeningSeconds = database.prepare('SELECT COALESCE(SUM(duration_seconds), 0) as total FROM play_history').get().total;
    } catch (e) {
    }

    let likedCount = 0;
    try {
        likedCount = database.prepare('SELECT COUNT(*) as count FROM liked_songs').get().count;
    } catch (e) {
    }

    let favoritesCount = 0;
    try {
        favoritesCount = database.prepare('SELECT COUNT(*) as count FROM favorites').get().count;
    } catch (e) {
    }

    let playlistsCount = 0;
    try {
        playlistsCount = database.prepare('SELECT COUNT(*) as count FROM playlists').get().count;
    } catch (e) {
    }

    return {
        totalPlays,
        uniqueTracks,
        uniqueArtists,
        totalListeningSeconds,
        likedCount,
        favoritesCount,
        playlistsCount
    };
}

function getTopTracks(limit = 10) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT track_id as id, track_name as name, artist_name as artist, image, COUNT(*) as playCount
        FROM play_history
        WHERE track_name IS NOT NULL
        GROUP BY track_id
        ORDER BY playCount DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

function getTopArtists(limit = 10) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT artist_name as name, COUNT(*) as playCount
        FROM play_history
        WHERE artist_name IS NOT NULL AND artist_name != ''
        GROUP BY artist_name
        ORDER BY playCount DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

function getListeningActivity(days = 7) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT DATE(played_at) as date, COUNT(*) as count,
               COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM play_history
        WHERE played_at >= datetime('now', '-' || ? || ' days')
        GROUP BY DATE(played_at)
        ORDER BY date ASC
    `);

    return stmt.all(days);
}

function getDailyListeningDuration(days = 7) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT DATE(played_at) as date,
               COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM play_history
        WHERE played_at >= datetime('now', '-' || ? || ' days')
        GROUP BY DATE(played_at)
        ORDER BY date ASC
    `);

    return stmt.all(days);
}

function getRecentTracks(limit = 10) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT track_id as id, track_name as name, artist_name as artist, image, played_at
        FROM play_history
        ORDER BY played_at DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

function getCompletionRate() {
    const database = getDb();

    try {
        const row = database.prepare(`
            SELECT
                COUNT(*) as totalTracks,
                COALESCE(SUM(CASE WHEN duration_seconds >= track_duration * 0.9 THEN 1 ELSE 0 END), 0) as completedTracks,
                COALESCE(AVG(CASE WHEN track_duration > 0 THEN MIN(duration_seconds, track_duration) * 100.0 / track_duration END), 0) as avgCompletionPercent
            FROM play_history
            WHERE track_duration > 0
        `).get();

        return {
            totalTracks: row.totalTracks || 0,
            completedTracks: row.completedTracks || 0,
            avgCompletionPercent: Math.round((row.avgCompletionPercent || 0) * 10) / 10
        };
    } catch (e) {
        return null;
    }
}

module.exports = {
    getOverviewStats,
    getTopTracks,
    getTopArtists,
    getListeningActivity,
    getDailyListeningDuration,
    getRecentTracks,
    getCompletionRate
};
