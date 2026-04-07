const youtubeModule = require('./youtubeModule');
const pythonPlayer = require('./pythonPlayer');
const lastfmModule = require('./lastfmModule');
const likedSongs = require('./likedSongs');
const favorites = require('./favorites');

class Player {
    constructor() {
        this.listeners = [];
        this.currentTrack = null;
        this.progressInterval = null;
        this.isPlayingPromise = false;
        this.pendingPlayRequest = null;
        this.repeat = false;
        this.shuffle = false;
        this.history = [];
        this.historyIndex = -1;

        pythonPlayer.on('play', (data) => {
            this.notifyListeners('play', data);
        });
        
        pythonPlayer.on('stop', (data) => {
            this.stopProgressUpdates();
            
            if (data.reason === 'ended') {
                if (this.repeat && this.currentTrack) {
                    this.play(this.currentTrack, false, false);
                    return;
                }
                
                console.log('[Player] Song ended, playing next...');
                this.playNext();
                return;
            }
            
            this.notifyListeners('stop', data);
        });

        pythonPlayer.on('pause', (data) => {
            this.stopProgressUpdates();
            this.notifyListeners('pause', data);
        });
        
        pythonPlayer.on('resume', (data) => {
            setTimeout(() => {
                this.startProgressUpdates();
            }, 500);
            this.notifyListeners('resume', data);
        });
    }

    startProgressUpdates() {
        this.stopProgressUpdates();
        this.progressInterval = setInterval(async () => {
            if (!pythonPlayer.process) return;
            const status = pythonPlayer.getStatus();
            if (status.playing && this.currentTrack) {
                const actualPosition = await pythonPlayer.getActualPosition();
                
                if (actualPosition !== null) {
                    const duration = status.actualDuration !== null ? status.actualDuration : (this.currentTrack.duration || 0);
                    
                    this.notifyListeners('progress', {
                        currentTime: actualPosition,
                        duration: duration
                    });
                }
            }
        }, 1000);
    }

    stopProgressUpdates() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    async play(track, fromHistory = false, addToHistory = true) {
        if (this.isPlayingPromise) {
            this.pendingPlayRequest = track;
            return;
        }

        this.isPlayingPromise = true;

        if (addToHistory && !fromHistory) {
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push({
                name: track.name,
                artist: track.artist,
                image: track.image || track.thumbnail,
                id: track.id || track.videoId
            });
            this.historyIndex = this.history.length - 1;
        }

        this.pendingPlayRequest = null;

        try {
            console.log('[Player] Requesting to play:', track.name, 'by', track.artist);
            
            if (pythonPlayer.getStatus().playing) {
                pythonPlayer.stop();
                while (pythonPlayer.getStatus().playing) {
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            
            let video = track.youtube || null;
            let url = track.streamUrl || null;
            
            if (!video && !url) {
                video = youtubeModule.getFromCache(track.name, track.artist);
                if (video) {
                    console.log('[Player] Using cached video for:', track.name);
                    url = `https://www.youtube.com/watch?v=${video.videoId}`;
                }
            }

            this.currentTrack = {
                ...track,
                videoId: video?.videoId || track.videoId || null,
                streamUrl: url,
                duration: video?.duration || track.duration || null,
                thumbnail: track.image || video?.thumbnail || null,
                image: track.image || video?.thumbnail || null
            };

            if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
                const historyEntry = this.history[this.historyIndex];
                if (historyEntry) {
                    historyEntry.image = this.currentTrack.image || this.currentTrack.thumbnail;
                    historyEntry.thumbnail = this.currentTrack.thumbnail;
                    historyEntry.id = this.currentTrack.id || this.currentTrack.videoId;
                }
            }

            if (addToHistory && !fromHistory) {
                this.notifyListeners('history-updated', this.getHistory());
            }

            this.notifyListeners('play', this.currentTrack);

            if (url) {
                await pythonPlayer.play(url, 0);
                
                setTimeout(() => {
                    this.startProgressUpdates();
                }, 1500);
            } else {
                this.fetchVideoInBackground(track);
            }

            if (this.pendingPlayRequest) {
                const pendingTrack = this.pendingPlayRequest;
                this.pendingPlayRequest = null;
                this.isPlayingPromise = false;
                await this.play(pendingTrack);
            }

        } catch (error) {
            console.error('[Player] Play error:', error);
            this.notifyListeners('error', { error: error.message });
            this.notifyListeners('stop', { reason: 'error' });

            throw error;
        } finally {
            this.isPlayingPromise = false;
        }
    }

    async fetchVideoInBackground(track) {
        try {
            console.log('[Player] Fetching video in background for:', track.name);
            const video = await youtubeModule.getVideoForTrack(track.name, track.artist);
            const url = `https://www.youtube.com/watch?v=${video.videoId}`;

            if (this.currentTrack &&
                this.currentTrack.name === track.name &&
                this.currentTrack.artist === track.artist) {
                
                this.currentTrack = {
                    ...this.currentTrack,
                    videoId: video.videoId,
                    streamUrl: url,
                    duration: video.duration,
                    thumbnail: this.currentTrack.image || video.thumbnail,
                    image: this.currentTrack.image || video.thumbnail
                };

                if (!pythonPlayer.getStatus().playing) {
                    await pythonPlayer.play(url, 0);
                    setTimeout(() => {
                        this.startProgressUpdates();
                    }, 1500);
                }

                this.notifyListeners('play', this.currentTrack);
                
                if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
                    const historyEntry = this.history[this.historyIndex];
                    if (historyEntry) {
                        historyEntry.image = this.currentTrack.image || this.currentTrack.thumbnail;
                        historyEntry.thumbnail = this.currentTrack.thumbnail;
                        historyEntry.id = this.currentTrack.id || this.currentTrack.videoId;
                    }
                }
                this.notifyListeners('history-updated', this.getHistory());
            }
        } catch (error) {
            console.error('[Player] Background video fetch error:', error);
            this.notifyListeners('error', { error: error.message });
        }
    }

    stop() {
        this.pendingPlayRequest = null;
        this.stopProgressUpdates();
        pythonPlayer.stop();
    }

    pause() {
        pythonPlayer.pause();
    }

    async resume() {
        await pythonPlayer.resume();
    }

    async seek(position) {
        if (!this.currentTrack || !pythonPlayer.getStatus().playing) {
            return;
        }
        
        console.log('[Player] Seeking to', position);
        
        const success = await pythonPlayer.seek(position);
        
        if (success) {
            const duration = pythonPlayer.getStatus().actualDuration !== null
                ? pythonPlayer.getStatus().actualDuration
                : (this.currentTrack.duration || 0);
            
            this.notifyListeners('progress', {
                currentTime: position,
                duration: duration
            });
        } else {
            console.log('[Player] IPC seek failed, falling back to restart');
            this.stopProgressUpdates();
            await pythonPlayer.stop();
            await new Promise(r => setTimeout(r, 300));
            await pythonPlayer.play(this.currentTrack.streamUrl, position);

            setTimeout(() => {
                this.startProgressUpdates();
            }, 1000);
        }
    }

    async setVolume(volume) {
        console.log('[Player] Setting volume to:', volume);
        const success = await pythonPlayer.setVolume(volume);
        return success;
    }

    setRepeat(repeat) {
        this.repeat = repeat;
        console.log('[Player] Repeat mode set to:', repeat);
    }

    async playNext() {
        if (!this.currentTrack) {
            return;
        }

        const addToHistory = true;

        try {
            const trackName = this.currentTrack.name;
            const artistName = this.currentTrack.artist;

            if (!this.recentHistory) this.recentHistory = [];
            
            const currentKey = `${trackName.toLowerCase()}:${artistName.toLowerCase()}`;
            if (!this.recentHistory.includes(currentKey)) {
                this.recentHistory.push(currentKey);
            }
            if (this.recentHistory.length > 30) {
                this.recentHistory.shift();
            }
            
            const historySet = new Set(this.recentHistory);

            const similarTracks = await lastfmModule.getSimilarTracks(trackName, artistName);

            if (similarTracks.length === 0) {
                const youtubeResult = await this.playRandomFromYouTube(addToHistory);
                if (!youtubeResult) {
                    await this.playRandomFromLocal(addToHistory);
                }
                return;
            }

            const favoritesList = await favorites.getAllFavorites();
            const likedList = await likedSongs.getAllLikedSongs();

            const allLocalTracks = [
                ...favoritesList.map(f => ({
                    name: f.track_name,
                    artist: f.artist_name,
                    image: f.image,
                    id: f.track_id
                })),
                ...likedList.map(l => ({
                    name: l.track_name,
                    artist: l.artist_name,
                    image: l.image,
                    id: l.track_id
                }))
            ];

            const matchedTracks = [];
            for (const similar of similarTracks) {
                const match = allLocalTracks.find(t =>
                    t.name.toLowerCase().includes(similar.name.toLowerCase()) ||
                    similar.name.toLowerCase().includes(t.name.toLowerCase())
                );

                if (match &&
                    (match.name.toLowerCase() !== trackName.toLowerCase() ||
                        match.artist.toLowerCase() !== artistName.toLowerCase())) {
                    matchedTracks.push({
                        ...match,
                        match: similar.match
                    });
                }
            }

            let candidatePool = matchedTracks.length > 0 ? matchedTracks : similarTracks;

            candidatePool = candidatePool.filter(t => {
                const key = `${t.name.toLowerCase()}:${t.artist.toLowerCase()}`;
                return !historySet.has(key);
            });

            if (candidatePool.length === 0) {
                const youtubeResult = await this.playRandomFromYouTube(addToHistory);
                if (!youtubeResult) {
                    await this.playRandomFromLocal(addToHistory);
                }
                return;
            }

            const scoredPool = candidatePool.map(track => {
                const key = `${track.name.toLowerCase()}:${track.artist.toLowerCase()}`;

                const similarity = track.match ? parseFloat(track.match) : 0.5;

                const recentlyPlayed = this.recentHistory.includes(key);
                const freshnessPenalty = recentlyPlayed ? -0.6 : 0;

                const isLocal = track.id !== undefined;
                const localBoost = isLocal ? 0.2 : 0;

                const randomness = Math.random() * 0.3;

                const score = similarity + freshnessPenalty + localBoost + randomness;

                return { track, score };
            });

            scoredPool.sort((a, b) => b.score - a.score);

            let selectedTrack;

            if (this.shuffle) {
                const topN = Math.max(3, Math.floor(scoredPool.length * 0.3));
                const topCandidates = scoredPool.slice(0, topN);

                selectedTrack = topCandidates[Math.floor(Math.random() * topCandidates.length)].track;
            } else {
                selectedTrack = scoredPool[0].track;
            }

            if (!selectedTrack.image) {
                const similar = similarTracks.find(s =>
                    s.name.toLowerCase() === selectedTrack.name.toLowerCase() &&
                    s.artist.toLowerCase() === selectedTrack.artist.toLowerCase()
                );
                if (similar && similar.image) {
                    selectedTrack.image = similar.image;
                }
            }

            const selectedKey = `${selectedTrack.name.toLowerCase()}:${selectedTrack.artist.toLowerCase()}`;
            if (!this.recentHistory.includes(selectedKey)) {
                this.recentHistory.push(selectedKey);
            }
            if (this.recentHistory.length > 30) {
                this.recentHistory.shift();
            }

            await this.play(selectedTrack, false, addToHistory);

        } catch (error) {
            console.error("playNext error:", error);
        }
    }

    async playRandomFromYouTube(manual = true) {
        try {
            const yts = require("yt-search");
            
            const randomQueries = [
                "music 2024",
                "top hits",
                "popular songs",
                "trending music",
                "best songs",
                "new music",
                "chart hits"
            ];
            
            const banned = [
                "reaction",
                "interview",
                "podcast",
                "karaoke",
                "cover",
                "playlist",
                "mix",
                "dj",
                "remix",
                "hour",
                "hours",
                "live",
                "concert",
                "medley",
                "compilation",
                "nonstop",
                "continuous",
                "loop"
            ];
            
            const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];
            
            const results = await yts({ query: randomQuery, pages: 1 });
            const videos = results?.videos || [];
            
            if (videos.length === 0) {
                return false;
            }
            
            const filteredVideos = videos.filter(video => {
                const title = video.title.toLowerCase();
                const hasBannedWord = banned.some(word => title.includes(word));
                const duration = video.seconds || 0;
                const maxDuration = 600;
                const minDuration = 60;
                
                return !hasBannedWord && duration >= minDuration && duration <= maxDuration;
            });
            
            if (filteredVideos.length === 0) {
                return false;
            }
            
            const randomVideo = filteredVideos[Math.floor(Math.random() * filteredVideos.length)];
            
            const track = {
                name: randomVideo.title,
                artist: randomVideo.author?.name || 'Unknown',
                image: randomVideo.thumbnail || null,
                id: randomVideo.videoId
            };
            
            await this.play(track, false, manual);
            return true;
        } catch (error) {
            console.error('[Player] Error in playRandomFromYouTube:', error);
            return false;
        }
    }

    async playRandomFromLocal(manual = true) {
        try {
            const favoritesList = await favorites.getAllFavorites();
            const likedList = await likedSongs.getAllLikedSongs();
            
            const allLocalTracks = [
                ...favoritesList.map(f => ({
                    name: f.track_name,
                    artist: f.artist_name,
                    image: f.image,
                    id: f.track_id
                })),
                ...likedList.map(l => ({
                    name: l.track_name,
                    artist: l.artist_name,
                    image: l.image,
                    id: l.track_id
                }))
            ];

            if (allLocalTracks.length === 0) {
                return;
            }

            const filteredTracks = allLocalTracks.filter(
                t => this.currentTrack &&
                     (t.name.toLowerCase() !== this.currentTrack.name.toLowerCase() ||
                      t.artist.toLowerCase() !== this.currentTrack.artist.toLowerCase())
            );

            if (filteredTracks.length === 0 && allLocalTracks.length > 0) {
                const randomTrack = allLocalTracks[Math.floor(Math.random() * allLocalTracks.length)];
                await this.play(randomTrack, false, manual);
                return;
            }

            const tracksToChoose = filteredTracks.length > 0 ? filteredTracks : allLocalTracks;
            const randomTrack = tracksToChoose[Math.floor(Math.random() * tracksToChoose.length)];
            
            await this.play(randomTrack, false, manual);
        } catch (error) {
            console.error('[Player] Error in playRandomFromLocal:', error);
        }
    }

    setShuffle(shuffle) {
        this.shuffle = shuffle;
        console.log('[Player] Shuffle mode set to:', shuffle);
    }

    async playPrevious() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.notifyListeners('history-updated', this.getHistory());
            const track = this.history[this.historyIndex];
            await this.play(track, true, false);
        }
    }

    async playHistoryItem(index) {
        if (index >= 0 && index < this.history.length) {
            this.historyIndex = index;
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.notifyListeners('history-updated', this.getHistory());
            const track = this.history[this.historyIndex];
            await this.play(track, true, false);
        }
    }

    getHistory() {
        return {
            history: this.history,
            currentIndex: this.historyIndex,
            canGoBack: this.historyIndex > 0,
            canGoForward: this.historyIndex < this.history.length - 1
        };
    }


    getStatus() {
        return {
            currentTrack: this.currentTrack,
            ...pythonPlayer.getStatus()
        };
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    notifyListeners(event, data) {
        this.listeners.forEach(l => {
            if (l.event === event) l.callback(data);
        });
    }
}

module.exports = new Player();
