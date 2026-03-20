const yts = require("yt-search");

class YouTubeModule {
    async getVideoForTrack(trackName, artistName) {
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

            let results;
            try {
                results = await yts({ query, pages: 1 });
            } catch (err) {
                console.log(`[YouTubeModule] Search failed for query: ${query}`);
                console.log(`[YouTubeModule] Error: ${err.message}`);
                continue;
            }

            const videos = results?.videos || [];

            if (videos.length === 0) {
                continue;
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
        }

        throw new Error(`No valid video found for ${artistName} - ${trackName}`);
    }
}

module.exports = new YouTubeModule();