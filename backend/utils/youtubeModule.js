const play = require("play-dl");

class YouTubeModule {

    async getVideoForTrack(trackName, artistName) {

        const query = `${trackName} ${artistName}`;

        const results = await play.search(query, {
            limit: 1
        });

        const video = results[0];

        if (!video) {
            throw new Error("Video not found");
        }

        return {
            videoId: video.id,
            videoUrl: video.url,
            duration: video.durationInSec
        };

    }

}

module.exports = new YouTubeModule();