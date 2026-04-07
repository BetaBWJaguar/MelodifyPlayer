const yts = require("yt-search");

class YouTubeModule {
    constructor() {
        this.videoCache = new Map();
        this.pendingLookups = new Map();
        this.CACHE_TTL = 24 * 60 * 60 * 1000;
    }

    getCacheKey(trackName, artistName) {
        return `${artistName.toLowerCase()}:${trackName.toLowerCase()}`;
    }

    getFromCache(trackName, artistName) {
        const key = this.getCacheKey(trackName, artistName);
        const cached = this.videoCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    setCache(trackName, artistName, videoData) {
        const key = this.getCacheKey(trackName, artistName);
        this.videoCache.set(key, {
            data: videoData,
            timestamp: Date.now()
        });
    }

    async getVideoForTrack(trackName, artistName) {
        const cached = this.getFromCache(trackName, artistName);
        if (cached) {
            console.log(`[YouTubeModule] Using cached video for: ${artistName} - ${trackName}`);
            return cached;
        }

        const cacheKey = this.getCacheKey(trackName, artistName);
        
        if (this.pendingLookups.has(cacheKey)) {
            return this.pendingLookups.get(cacheKey);
        }

        const lookupPromise = this._searchVideo(trackName, artistName);
        this.pendingLookups.set(cacheKey, lookupPromise);

        try {
            const result = await lookupPromise;
            this.setCache(trackName, artistName, result);
            return result;
        } finally {
            this.pendingLookups.delete(cacheKey);
        }
    }

    async _searchVideo(trackName, artistName) {
        const queries = [
            `${artistName} ${trackName} official audio`,
            `${artistName} ${trackName} audio`,
            `${artistName} ${trackName} official`,
            `${artistName} ${trackName}`,
            `${trackName} ${artistName}`
        ];

        const banned = [
            "reaction",
            "interview",
            "podcast",
            "karaoke",
            "cover"
        ];

        for (const query of queries) {
            const result = await this._searchSingleQuery(query, trackName, artistName, banned);
            if (result) {
                return result;
            }
        }

        throw new Error(`No valid video found for ${artistName} - ${trackName}`);
    }

    async _searchSingleQuery(query, trackName, artistName, banned) {
        try {
            const results = await yts({ query, pages: 1 });
            const videos = results?.videos || [];

            if (videos.length === 0) {
                return null;
            }

            for (const video of videos) {
                if (!video || !video.title) continue;


                const title = video.title.toLowerCase();
                const channel = (video.author?.name || "").toLowerCase();

                if (banned.some(word => title.includes(word))) {
                    continue;
                }

                const artistLower = artistName.toLowerCase();
                const trackLower = trackName.toLowerCase();

                const titleLooksRelevant =
                    title.includes(artistLower) || title.includes(trackLower);

                if (!titleLooksRelevant) {
                    continue;
                }

                return {
                    videoId: video.videoId,
                    videoUrl: video.url,
                    duration: video.seconds,
                    title: video.title,
                    channel: video.author?.name || null,
                    thumbnail: video.thumbnail || null
                };
            }
        } catch (err) {
            console.log(`[YouTubeModule] Search failed for query: ${query}`);
            console.log(`[YouTubeModule] Error: ${err.message}`);
        }

        return null;
    }
}

module.exports = new YouTubeModule();