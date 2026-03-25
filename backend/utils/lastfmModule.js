const https = require("https");

const API_KEY = "1b8e4518708251c43d83bb70451f3e28";
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const similarCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

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
        const url = `${BASE_URL}?method=track.getsimilar&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json&limit=${limit}&autocorrect=1`;
        const json = await httpGetJson(url, 10000);

        if (json.error) {
            return [];
        }

        if (!json.similartracks || !json.similartracks.track) {
            return [];
        }

        const tracksRaw = json.similartracks.track;
        const tracks = Array.isArray(tracksRaw) ? tracksRaw : [tracksRaw];

        const formatted = tracks.map(track => ({
            name: track.name,
            artist: track.artist.name,
            image: getBestImage(track.image),
            match: parseFloat(track.match) || 0
        }));

        setCache(cacheKey, formatted);

        return formatted;
    } catch (error) {
        console.error("[Last.fm] Error:", error);
        return [];
    }
}

module.exports = {
    getSimilarTracks
};
