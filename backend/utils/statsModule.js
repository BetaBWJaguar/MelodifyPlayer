const Database = require('better-sqlite3');
const { getDbPath } = require('./dbPath');

let db;

function getDb() {
    if (!db) {
        const dbPath = getDbPath();
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
        SELECT DATE(played_at, 'localtime') as date, COUNT(*) as count,
               COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM play_history
        WHERE played_at >= datetime('now', 'localtime', '-' || ? || ' days')
        GROUP BY DATE(played_at, 'localtime')
        ORDER BY date ASC
    `);

    return stmt.all(days);
}

function getDailyListeningDuration(days = 7) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT DATE(played_at, 'localtime') as date,
               COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM play_history
        WHERE played_at >= datetime('now', 'localtime', '-' || ? || ' days')
        GROUP BY DATE(played_at, 'localtime')
        ORDER BY date ASC
    `);

    return stmt.all(days);
}

function getRecentTracks(limit = 10) {
    const database = getDb();

    const stmt = database.prepare(`
        SELECT track_id as id, track_name as name, artist_name as artist, image, MAX(played_at) as played_at
        FROM play_history
        GROUP BY track_id
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

function getSkipRate() {
    const database = getDb();

    try {
        const row = database.prepare(`
            SELECT
                COUNT(*) as totalTracks,
                COALESCE(SUM(CASE WHEN duration_seconds < track_duration * 0.5 THEN 1 ELSE 0 END), 0) as skippedTracks,
                COALESCE(AVG(CASE WHEN track_duration > 0 THEN 
                    CASE WHEN duration_seconds < track_duration * 0.5 THEN 1 ELSE 0 END 
                END), 0) * 100 as skipPercent
            FROM play_history
            WHERE track_duration > 0
        `).get();

        return {
            totalTracks: row.totalTracks || 0,
            skippedTracks: row.skippedTracks || 0,
            skipPercent: Math.round((row.skipPercent || 0) * 10) / 10
        };
    } catch (e) {
        return null;
    }
}

function getFirstPlayDate() {
    const database = getDb();
    try {
        const row = database.prepare("SELECT MIN(datetime(played_at, 'localtime')) as firstPlay FROM play_history").get();
        return row.firstPlay || null;
    } catch (e) {
        return null;
    }
}

function getListeningStreak() {
    const database = getDb();
    try {
        const rows = database.prepare(`
            SELECT DISTINCT DATE(played_at, 'localtime') as date
            FROM play_history
            ORDER BY date DESC
        `).all();

        if (rows.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < rows.length; i++) {
            const rowDate = new Date(rows[i].date + 'T00:00:00');
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);

            if (rowDate.getTime() === expectedDate.getTime()) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    } catch (e) {
        return 0;
    }
}

function getBusiestDay() {
    const database = getDb();
    try {
        const row = database.prepare(`
            SELECT
                CASE cast(strftime('%w', played_at, 'localtime') as integer)
                    WHEN 0 THEN 'sunday'
                    WHEN 1 THEN 'monday'
                    WHEN 2 THEN 'tuesday'
                    WHEN 3 THEN 'wednesday'
                    WHEN 4 THEN 'thursday'
                    WHEN 5 THEN 'friday'
                    WHEN 6 THEN 'saturday'
                END as dayName,
                COUNT(*) as playCount
            FROM play_history
            GROUP BY dayName
            ORDER BY playCount DESC
            LIMIT 1
        `).get();

        if (!row) return null;
        return { day: row.dayName, playCount: row.playCount };
    } catch (e) {
        return null;
    }
}

function getAveragePlaysPerDay() {
    const database = getDb();
    try {
        const row = database.prepare(`
            SELECT
                COUNT(*) as totalPlays,
                COUNT(DISTINCT DATE(played_at, 'localtime')) as totalDays
            FROM play_history
        `).get();

        if (!row || row.totalDays === 0) return 0;
        return Math.round((row.totalPlays / row.totalDays) * 10) / 10;
    } catch (e) {
        return 0;
    }
}



function getTopCategories(limit = 5) {
    const database = getDb();
    try {
        const columns = database.prepare("PRAGMA table_info(play_history)").all();
        const hasCategory = columns.some(col => col.name === 'category');

        const rows = database.prepare(`
            SELECT
                COALESCE(category, 'other') as category,
                COUNT(*) as playCount
            FROM play_history
            GROUP BY category
            ORDER BY playCount DESC
            LIMIT ?
        `).all(limit);

        return rows;
    } catch (e) {
        return [];
    }
}

function getListeningTimeByHour() {
    const database = getDb();
    try {
        const rows = database.prepare(`
            SELECT
                cast(strftime('%H', played_at, 'localtime') as integer) as hour,
                COUNT(*) as playCount
            FROM play_history
            GROUP BY hour
            ORDER BY hour ASC
        `).all();

        return rows;
    } catch (e) {
        return [];
    }
}

module.exports = {
    getOverviewStats,
    getTopTracks,
    getTopArtists,
    getListeningActivity,
    getDailyListeningDuration,
    getRecentTracks,
    getCompletionRate,
    getSkipRate,
    getFirstPlayDate,
    getListeningStreak,
    getBusiestDay,
    getAveragePlaysPerDay,
    getTopCategories,
    getListeningTimeByHour
};
