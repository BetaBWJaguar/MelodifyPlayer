const https = require("https");

const API_KEY = "1b8e4518708251c43d83bb70451f3e28";
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

function httpGetJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            });
        }).on("error", reject);
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

        const json = await httpGetJson(url);

        if (json.track && json.track.album && json.track.album.image) {
            return getBestImage(json.track.album.image);
        }

        return null;
    } catch {
        return null;
    }
}

async function getArtistImage(artist) {
    try {
        const url = `${BASE_URL}?method=artist.getinfo&artist=${encodeURIComponent(artist)}&api_key=${API_KEY}&format=json`;

        const json = await httpGetJson(url);

        if (!json.artist) return null;

        return getBestImage(json.artist.image);
    } catch {
        return null;
    }
}

async function searchTrack(query, limit) {
    const url = `${BASE_URL}?method=track.search&track=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json&limit=${limit}`;

    const json = await httpGetJson(url);

    if (!json.results || !json.results.trackmatches) {
        return [];
    }

    const tracks = json.results.trackmatches.track;

    const formatted = await Promise.all(tracks.map(async (track) => {

        let imageUrl = getBestImage(track.image);

        if (!imageUrl) {
            imageUrl = await getTrackAlbumImage(track.name, track.artist);
        }

        if (!imageUrl) {
            imageUrl = await getArtistImage(track.artist);
        }

        return {
            name: track.name,
            artist: track.artist,
            url: track.url,
            listeners: track.listeners,
            image: imageUrl
        };

    }));

    return formatted;
}

module.exports = {
    searchTrack
};