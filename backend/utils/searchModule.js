const https = require("https");
const youtubeModule = require("./youtubeModule");
const { BrowserWindow } = require('electron');

const API_KEY = "1b8e4518708251c43d83bb70451f3e28";
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

let activeSearchId = null;
let activeLiveFetchAbort = null;

function cancelActiveSearch() {
    if (activeLiveFetchAbort) {
        activeLiveFetchAbort.cancelled = true;
        activeLiveFetchAbort = null;
    }
}

function getCacheKey(query, limit) {
    return `${query.toLowerCase()}:${limit}`;
}

function getFromCache(key) {
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        searchCache.delete(key);
    }
    return null;
}

function setCache(key, data) {
    if (searchCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = searchCache.keys().next().value;
        searchCache.delete(oldestKey);
    }
    searchCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of searchCache) {
        if (now - value.timestamp >= CACHE_TTL) {
            searchCache.delete(key);
        }
    }
}, 60 * 1000);

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

async function getTrackAlbumImage(trackName, artistName) {
    try {
        const url = `${BASE_URL}?method=track.getInfo&api_key=${API_KEY}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json`;

        const json = await httpGetJson(url, 5000);

        if (json.track && json.track.album && json.track.album.image) {
            return getBestImage(json.track.album.image);
        }

        return null;
    } catch {
        return null;
    }
}

async function searchTrack(query, limit = 20) {
    const cacheKey = getCacheKey(query, limit);

    const cachedResults = getFromCache(cacheKey);
    if (cachedResults) {
        console.log("[Search] Returning cached results for:", query);
        cancelActiveSearch();
        return cachedResults;
    }

    cancelActiveSearch();

    const currentSearchId = Date.now();
    activeSearchId = currentSearchId;

    const abortController = { cancelled: false };
    activeLiveFetchAbort = abortController;

    try {
        const url = `${BASE_URL}?method=track.search&track=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json&limit=${limit}`;
        const json = await httpGetJson(url, 10000);

        if (abortController.cancelled) {
            return [];
        }

        if (!json.results || !json.results.trackmatches) {
            return [];
        }

        const tracksRaw = json.results.trackmatches.track;
        const tracks = Array.isArray(tracksRaw) ? tracksRaw : [tracksRaw];

        const formatted = await Promise.all(tracks.map(async (track) => {
            let imageUrl = getBestImage(track.image);

            if (!imageUrl) {
                imageUrl = await getTrackAlbumImage(track.name, track.artist);
            }

            return {
                    name: track.name,
                    artist: track.artist,
                    url: track.url,
                    listeners: track.listeners,
                    image: imageUrl,
                    id: track.id || track.videoId ||track.youtube?.videoId
                };
        }));

        const FIRST_BATCH_SIZE = 6;
        const firstBatch = formatted.slice(0, FIRST_BATCH_SIZE);
        const remainingTracks = formatted.slice(FIRST_BATCH_SIZE);

        const firstBatchWithVideos = await Promise.all(firstBatch.map(async (track) => {
            if (abortController.cancelled) return null;

            try {
                const cachedVideo = youtubeModule.getFromCache(track.name, track.artist);
                if (cachedVideo) {
                    return {
                        ...track,
                        youtube: cachedVideo,
                        image: track.image || cachedVideo.thumbnail || null,
                        duration: cachedVideo.duration
                    };
                }

                const video = await Promise.race([
                    youtubeModule.getVideoForTrack(track.name, track.artist),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("YouTube lookup timeout")), 6000)
                    )
                ]);

                if (abortController.cancelled) return null;

                return {
                    ...track,
                    youtube: video,
                    image: track.image || video.thumbnail || null,
                    duration: video.duration
                };
            } catch (error) {
                console.log(`[SearchModule] First batch lookup failed: ${track.name} - ${track.artist}`);
                return null;
            }
        }));

        if (abortController.cancelled) {
            return [];
        }

        const validFirstBatch = firstBatchWithVideos.filter(t => t !== null && t.youtube);

        const remainingWithCache = remainingTracks.map(track => {
            const cachedVideo = youtubeModule.getFromCache(track.name, track.artist);
            if (cachedVideo) {
                return {
                    ...track,
                    youtube: cachedVideo,
                    image: track.image || cachedVideo.thumbnail || null,
                    duration: cachedVideo.duration
                };
            }
            return track;
        });

        fetchYouTubeVideosLive(remainingTracks, cacheKey, abortController, validFirstBatch);

        const allResults = [...validFirstBatch, ...remainingWithCache];

        const cacheableResults = allResults.map(track => ({
            ...track,
            id: track.id || track.videoId || track.youtube?.videoId
        }));
        setCache(cacheKey, cacheableResults);

        return allResults.filter(track => track.youtube !== undefined);
    } catch (error) {
        console.error("[Search] Error:", error);
        return [];
    }
}

async function fetchYouTubeVideosLive(tracks, cacheKey, abortController, firstBatchResults) {
    const MAX_CONCURRENT = 3;
    const updatedTracks = [];

    for (let i = 0; i < tracks.length; i += MAX_CONCURRENT) {
        if (abortController.cancelled) {
            return;
        }

        const batch = tracks.slice(i, i + MAX_CONCURRENT);

        const batchPromises = batch.map(async (track) => {
            if (abortController.cancelled) return { track, hasVideo: false };

            try {
                const cachedVideo = youtubeModule.getFromCache(track.name, track.artist);
                if (cachedVideo) {
                    return { track, hasVideo: true, video: cachedVideo };
                }

                const video = await Promise.race([
                    youtubeModule.getVideoForTrack(track.name, track.artist),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("YouTube lookup timeout")), 10000)
                    )
                ]);

                if (abortController.cancelled) return { track, hasVideo: false };

                const trackWithVideo = {
                    ...track,
                    youtube: video,
                    image: track.image || video.thumbnail || null,
                    duration: video.duration,
                    id: track.id || track.videoId || video.videoId
                };
                sendNewTrack(trackWithVideo);

                return { track, hasVideo: true, video };
            } catch (error) {
                console.log(`[SearchModule] Lookup failed: ${track.name} - ${track.artist}`);
                return { track, hasVideo: false };
            }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        if (abortController.cancelled) return;

        for (const result of batchResults) {
            if (result.status === "fulfilled") {
                const { track, hasVideo, video } = result.value;
                updatedTracks.push({
                    ...track,
                    ...(hasVideo ? {
                        youtube: video,
                        image: track.image || video.thumbnail || null,
                        duration: video.duration
                    } : {})
                });
            }
        }

        if (i + MAX_CONCURRENT < tracks.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (abortController.cancelled) return;

    if (updatedTracks.length > 0) {
        const allTracksForCache = [
            ...(firstBatchResults || []),
            ...updatedTracks
        ];

        const cacheableAll = allTracksForCache.map(t => ({
            ...t,
            id: t.id || t.videoId || t.youtube?.videoId
        }));
        setCache(cacheKey, cacheableAll);

        const withVideos = updatedTracks.filter(t => t.youtube).length;
        console.log(`[SearchModule] Live fetch complete: ${withVideos}/${updatedTracks.length} tracks with videos`);
    }
}

function sendNewTrack(track) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        win.webContents.send('search-new-track-found', track);
    });
}

module.exports = {
    searchTrack,
    cancelActiveSearch
};