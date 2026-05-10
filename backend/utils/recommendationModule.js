const https = require("https");
const historyModule = require('./historyModule');
const likedSongs = require('./likedSongs');
const favorites = require('./favorites');
const youtubeModule = require("./youtubeModule");

const API_KEY = "1b8e4518708251c43d83bb70451f3e28";
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const recommendationCache = new Map();
const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 20;

const previouslyRecommended = new Set();
const MAX_PREVIOUSLY_RECOMMENDED = 60;

function httpGetJson(url, timeout = 5000) {
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
            if (img["#text"].includes(LASTFM_DEFAULT_STAR)) return null;
            return img["#text"];
        }
    }
    return null;
}

async function fetchTrackImage(trackName, artistName) {
    try {
        const cachedVideo = youtubeModule.getFromCache(trackName, artistName);
        if (cachedVideo && cachedVideo.thumbnail) {
            return cachedVideo.thumbnail;
        }

        const video = await Promise.race([
            youtubeModule.getVideoForTrack(trackName, artistName),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("YouTube lookup timeout")), 4000)
            )
        ]);

        if (video && video.thumbnail) {
            return video.thumbnail;
        }
    } catch (e) {}
    return null;
}

async function getArtistTopTracks(artistName, limit = 15) {
    try {
        const url = `${BASE_URL}?method=artist.gettoptracks&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&format=json&limit=${limit}&autocorrect=1`;
        const json = await httpGetJson(url);

        if (json?.toptracks?.track) {
            const tracks = Array.isArray(json.toptracks.track) ? json.toptracks.track : [json.toptracks.track];
            return tracks.map(track => ({
                name: track.name,
                artist: track.artist?.name || artistName,
                image: getBestImage(track.image),
                match: 0.6 + Math.random() * 0.2,
                source: 'artist_top'
            }));
        }
        return [];
    } catch (error) {
        return [];
    }
}

async function getSimilarTracks(trackName, artistName, limit = 30) {
    try {
        const url = `${BASE_URL}?method=track.getsimilar&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json&limit=${limit}&autocorrect=1`;
        const json = await httpGetJson(url);

        if (json?.similartracks?.track) {
            const tracks = Array.isArray(json.similartracks.track) ? json.similartracks.track : [json.similartracks.track];
            return tracks.map(track => ({
                name: track.name,
                artist: track.artist?.name || artistName,
                image: getBestImage(track.image),
                match: parseFloat(track.match) || 0.5,
                source: 'similar_track'
            }));
        }
        return [];
    } catch (error) {
        return [];
    }
}

async function getArtistSimilar(artistName, limit = 5) {
    try {
        const url = `${BASE_URL}?method=artist.getsimilar&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&format=json&limit=${limit}&autocorrect=1`;
        const json = await httpGetJson(url);

        if (json?.similarartists?.artist) {
            const artists = Array.isArray(json.similarartists.artist) ? json.similarartists.artist : [json.similarartists.artist];
            return artists.map(a => ({ name: a.name, match: parseFloat(a.match) || 0.5 }));
        }
        return [];
    } catch (error) {
        return [];
    }
}

function getCachedRecommendations(key) {
    const cached = recommendationCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    if (cached) recommendationCache.delete(key);
    return null;
}

function setCachedRecommendations(key, data) {
    if (recommendationCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = recommendationCache.keys().next().value;
        recommendationCache.delete(oldestKey);
    }
    recommendationCache.set(key, { data, timestamp: Date.now() });
}

async function fetchMissingImages(topTracks) {
    const tracksWithoutImages = topTracks.filter(t => !t.image);
    if (tracksWithoutImages.length === 0) return;

    await Promise.all(tracksWithoutImages.map(async (track) => {
        try {
            const image = await fetchTrackImage(track.name, track.artist);
            if (image) track.image = image;
        } catch (e) {}
    }));
}

function trackKey(name, artist) {
    return `${(name || '').toLowerCase().trim()}:${(artist || '').toLowerCase().trim()}`;
}

async function getPersonalizedRecommendations(limit = 8, _depth = 0) {
    const cacheKey = `personalized_${limit}`;
    const cached = getCachedRecommendations(cacheKey);
    if (cached) return cached;

    if (_depth > 2) return [];

    try {
        const recentTracks = historyModule.getRecentTracks(20);
        const topArtists = historyModule.getTopArtists(10);
        const likedList = likedSongs.getAllLikedSongs();
        const favoritesList = favorites.getAllFavorites();

        if (recentTracks.length === 0 && topArtists.length === 0 && likedList.length === 0 && favoritesList.length === 0) {
            return [];
        }

        const knownTracks = new Set();
        previouslyRecommended.forEach(key => knownTracks.add(key));

        recentTracks.forEach(t => { if (t.name && t.artist) knownTracks.add(trackKey(t.name, t.artist)); });
        likedList.forEach(t => { if ((t.track_name || t.name) && (t.artist_name || t.artist)) knownTracks.add(trackKey(t.track_name || t.name, t.artist_name || t.artist)); });
        favoritesList.forEach(t => { if ((t.track_name || t.name) && (t.artist_name || t.artist)) knownTracks.add(trackKey(t.track_name || t.name, t.artist_name || t.artist)); });

        const recentForSimilar = [...recentTracks].sort(() => Math.random() - 0.5).slice(0, 3);
        const artistsForTracks = [...topArtists].sort(() => Math.random() - 0.5).slice(0, 3);
        const likedForSimilar = [...likedList].sort(() => Math.random() - 0.5).slice(0, 2);
        const favForSimilar = [...favoritesList].sort(() => Math.random() - 0.5).slice(0, 2);
        const randomArtist = topArtists[Math.floor(Math.random() * Math.min(3, topArtists.length))];

        const wave1Promises = [
            Promise.all(recentForSimilar.map(t => getSimilarTracks(t.name, t.artist, 25).catch(() => []))),
            Promise.all(artistsForTracks.map(a => getArtistTopTracks(a.name, 12).catch(() => []))),
            Promise.all(likedForSimilar.map(s => getSimilarTracks(s.track_name || s.name, s.artist_name || s.artist, 20).catch(() => []))),
            Promise.all(favForSimilar.map(s => getSimilarTracks(s.track_name || s.name, s.artist_name || s.artist, 15).catch(() => []))),
            randomArtist ? getArtistSimilar(randomArtist.name, 4).catch(() => []) : Promise.resolve([])
        ];

        const [recentSimRes, artistTopRes, likedSimRes, favSimRes, similarArtists] = await Promise.all(wave1Promises);

        let simArtistTopRes = [];
        if (similarArtists.length > 0) {
            const simArtistsForTracks = [...similarArtists].sort(() => Math.random() - 0.5).slice(0, 3);
            const wave2Promises = simArtistsForTracks.map(a =>
                getArtistTopTracks(a.name, 8).then(tracks =>
                    tracks.map(t => ({ ...t, match: t.match * a.match, source: 'similar_artist' }))
                ).catch(() => [])
            );
            simArtistTopRes = await Promise.all(wave2Promises);
        }

        const allCandidates = [];
        const candidateKeys = new Set();

        function addCandidates(tracks, weight, incrementWeight = 0.2) {
            tracks.flat().forEach(track => {
                const key = trackKey(track.name, track.artist);
                if (!candidateKeys.has(key)) {
                    candidateKeys.add(key);
                    allCandidates.push({ ...track, weight });
                } else if (incrementWeight > 0) {
                    const existing = allCandidates.find(c => trackKey(c.name, c.artist) === key);
                    if (existing) existing.weight = Math.min((existing.weight || 1.0) + incrementWeight, 2.0);
                }
            });
        }

        addCandidates(recentSimRes, 1.2, 0);
        addCandidates(artistTopRes, 1.0, 0.3);
        addCandidates(likedSimRes, 1.1, 0.2);
        addCandidates(favSimRes, 1.15, 0);
        addCandidates(simArtistTopRes, 0.8, 0);

        let filtered = allCandidates.filter(track => !knownTracks.has(trackKey(track.name, track.artist)));

        const artistCount = {};
        filtered = filtered.filter(track => {
            const artist = track.artist.toLowerCase().trim();
            artistCount[artist] = (artistCount[artist] || 0) + 1;
            return artistCount[artist] <= 2;
        });

        if (filtered.length === 0) {
            previouslyRecommended.clear();
            return getPersonalizedRecommendations(limit, _depth + 1);
        }

        const scored = filtered.map(track => {
            const matchScore = (track.match || 0.5) * (track.weight || 1.0);
            const randomness = Math.random() * 0.5;
            return { ...track, score: matchScore + randomness };
        });

        scored.sort((a, b) => b.score - a.score);
        const topPool = scored.slice(0, Math.min(20, scored.length));

        const selected = [];
        const poolCopy = [...topPool];

        for (let i = 0; i < Math.min(limit, poolCopy.length); i++) {
            const totalWeight = poolCopy.reduce((sum, t) => sum + t.score, 0);
            let random = Math.random() * totalWeight;
            let chosen = poolCopy[0];

            for (const t of poolCopy) {
                random -= t.score;
                if (random <= 0) { chosen = t; break; }
            }

            selected.push(chosen);
            poolCopy.splice(poolCopy.indexOf(chosen), 1);
        }

        await fetchMissingImages(selected);

        const recommendations = selected.map(track => ({
            name: track.name,
            artist: track.artist,
            image: track.image,
            match: Math.round((track.match || 0.5) * 100),
            source: track.source || 'unknown',
            reasonKey: track.source === 'artist_top'
                ? 'reasonArtist'
                : (track.source === 'similar_track' || track.source === 'similar_artist')
                    ? 'reasonSimilar'
                    : 'reasonDefault',
            reasonArtist: track.source === 'artist_top' ? track.artist : undefined
        }));

        recommendations.forEach(r => previouslyRecommended.add(trackKey(r.name, r.artist)));

        if (previouslyRecommended.size > MAX_PREVIOUSLY_RECOMMENDED) {
            const entries = [...previouslyRecommended];
            previouslyRecommended.clear();
            entries.slice(-40).forEach(e => previouslyRecommended.add(e));
        }

        setCachedRecommendations(cacheKey, recommendations);
        return recommendations;

    } catch (error) {
        console.error('[Recommendation] Error:', error);
        return [];
    }
}

function clearRecommendationCache() {
    recommendationCache.clear();
}

module.exports = {
    getPersonalizedRecommendations,
    clearRecommendationCache
};