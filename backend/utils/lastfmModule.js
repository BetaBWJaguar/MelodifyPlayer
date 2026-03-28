const https = require("https");

const API_KEY = "1b8e4518708251c43d83bb70451f3e28";
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const similarCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const recentHistory = [];
const HISTORY_LIMIT = 10;

function addToHistory(track, artist) {
    const key = `${track.toLowerCase()}:${artist.toLowerCase()}`;
    recentHistory.push(key);

    if (recentHistory.length > HISTORY_LIMIT) {
        recentHistory.shift();
    }
}

function isInHistory(track, artist) {
    const key = `${track.toLowerCase()}:${artist.toLowerCase()}`;
    return recentHistory.includes(key);
}

function getCacheKey(trackName, artistName) {
    return `${trackName.toLowerCase()}:${artistName.toLowerCase()}`;
}

function getFromCache(key) {
    const cached = similarCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCache(key, data) {
    similarCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function httpGetJson(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            req.destroy();
            reject(new Error(`Request timeout: ${url}`));
        }, timeout);

        const req = https.get(url, (res) => {
            clearTimeout(timeoutId);
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            });
        }).on("error", (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

function getBestImage(images) {
    if (!Array.isArray(images)) return null;

    const sizes = ["extralarge", "large", "medium", "small"];
    const LASTFM_DEFAULT_STAR = "2a96cbd8b46e442fc41c2b86b821562f";

    for (const size of sizes) {
        const img = images.find(i => i.size === size);

        if (img && img["#text"] && img["#text"].trim() !== "") {
            if (img["#text"].includes(LASTFM_DEFAULT_STAR)) {
                return null;
            }
            return img["#text"];
        }
    }
    return null;
}

async function getSimilarTracks(trackName, artistName, limit = 50) {
    const cacheKey = getCacheKey(trackName, artistName);


    const cachedResults = getFromCache(cacheKey);
    if (cachedResults) {
        return cachedResults;
    }

    try {
        let tracks = [];

        let url = `${BASE_URL}?method=track.getsimilar&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json&limit=${limit}&autocorrect=1`;
        let json = await httpGetJson(url);

        if (json?.similartracks?.track) {
            tracks = Array.isArray(json.similartracks.track)
                ? json.similartracks.track
                : [json.similartracks.track];
        }


        if (tracks.length === 0) {

            url = `${BASE_URL}?method=artist.gettoptracks&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&format=json&limit=${limit}&autocorrect=1`;
            json = await httpGetJson(url);

            if (json?.toptracks?.track) {
                tracks = Array.isArray(json.toptracks.track)
                    ? json.toptracks.track
                    : [json.toptracks.track];
            }

        }

        if (tracks.length === 0) {

            url = `${BASE_URL}?method=track.search&api_key=${API_KEY}&track=${encodeURIComponent(trackName)}&format=json&limit=${limit}`;
            json = await httpGetJson(url);

            if (json?.results?.trackmatches?.track) {
                tracks = Array.isArray(json.results.trackmatches.track)
                    ? json.results.trackmatches.track
                    : [json.results.trackmatches.track];
            }

        }

        if (tracks.length === 0) {

            const randomQueries = ["love", "night", "dream", "fire", "sky"];
            const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];


            url = `${BASE_URL}?method=track.search&api_key=${API_KEY}&track=${randomQuery}&format=json&limit=${limit}`;
            json = await httpGetJson(url);

            if (json?.results?.trackmatches?.track) {
                tracks = Array.isArray(json.results.trackmatches.track)
                    ? json.results.trackmatches.track
                    : [json.results.trackmatches.track];
            }

        }

        if (tracks.length === 0) {
            return [];
        }


        const originalTrack = trackName.toLowerCase().trim();
        const originalArtist = artistName.toLowerCase().trim();
        const uniqueSet = new Set();

        tracks = tracks.filter(track => {
            const tName = track.name?.toLowerCase().trim();
            const tArtist = (track.artist?.name || track.artist || "").toLowerCase().trim();

            if (tName === originalTrack && tArtist === originalArtist) return false;

            const key = `${tName}:${tArtist}`;
            if (uniqueSet.has(key)) return false;

            uniqueSet.add(key);
            return true;
        });


        const beforeHistory = tracks.length;

        tracks = tracks.filter(track => {
            const tName = track.name;
            const tArtist = track.artist?.name || track.artist;
            return !isInHistory(tName, tArtist);
        });


        if (tracks.length === 0) {
            return [];
        }

        let formatted = tracks.map(track => ({
            name: track.name,
            artist: track.artist?.name || track.artist,
            image: getBestImage(track.image),
            match: parseFloat(track.match) || Math.random()
        }));

        formatted.sort(() => Math.random() - 0.5);

        formatted.slice(0, 3).forEach(t => {
            addToHistory(t.name, t.artist);
        });

        console.log("[FINAL RESULT]:", formatted.length);

        setCache(cacheKey, formatted);

        return formatted;

    } catch (error) {
        console.error("[ERROR]:", error);
        return [];
    }
}

module.exports = {
    getSimilarTracks
};