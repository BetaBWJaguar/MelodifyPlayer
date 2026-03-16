const play = require("play-dl");

class YouTubeModule {

    async getVideoForTrack(trackName, artistName) {

        const query = `${artistName} ${trackName} official audio`;

        const results = await play.search(query, {
            limit: 5
        });

        if (!results || results.length === 0) {
            throw new Error("Video not found");
        }

        const banned = [
            "reaction",
            "interview",
            "podcast",
            "cover",
            "karaoke",
            "remix",
            "lyrics"
        ];

        for (const video of results) {

            const title = video.title.toLowerCase();

            if (banned.some(word => title.includes(word))) {
                continue;
            }

            return {
                videoId: video.id,
                videoUrl: video.url,
                duration: video.durationInSec,
                title: video.title
            };
        }

        throw new Error("No valid video found");
    }

}

module.exports = new YouTubeModule();