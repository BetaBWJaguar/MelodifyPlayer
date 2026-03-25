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
        }, 500);
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
            
            const video = await youtubeModule.getVideoForTrack(track.name, track.artist);
            const url = `https://www.youtube.com/watch?v=${video.videoId}`;

            this.currentTrack = {
                ...track,
                videoId: video.videoId,
                streamUrl: url,
                duration: video.duration,
                thumbnail: track.image || video.thumbnail || null,
                image: track.image || video.thumbnail || null
            };

            this.notifyListeners('play', this.currentTrack);

            await pythonPlayer.play(url, 0);
            

            setTimeout(() => {
                this.startProgressUpdates();
            }, 1500);

            if (this.pendingPlayRequest) {
                const pendingTrack = this.pendingPlayRequest;
                this.pendingPlayRequest = null;
                this.isPlayingPromise = false;
                await this.play(pendingTrack);
            }
            this.notifyListeners('history-updated', this.getHistory());

        } catch (error) {
            console.error('[Player] Play error:', error);
            this.notifyListeners('error', { error: error.message });
            this.notifyListeners('stop', { reason: 'error' });
        } finally {
            this.isPlayingPromise = false;
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


            const similarTracks = await lastfmModule.getSimilarTracks(trackName, artistName);

            if (similarTracks.length === 0) {
                await this.playRandomFromLocal(addToHistory);
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
                const match = allLocalTracks.find(
                    t => t.name.toLowerCase() === similar.name.toLowerCase() &&
                         t.artist.toLowerCase() === similar.artist.toLowerCase()
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

            if (matchedTracks.length > 0) {
                const selectedTrack = matchedTracks[Math.floor(Math.random() * matchedTracks.length)];

                if (!selectedTrack.image) {
                    const similar = similarTracks.find(s =>
                        s.name.toLowerCase() === selectedTrack.name.toLowerCase() &&
                        s.artist.toLowerCase() === selectedTrack.artist.toLowerCase()
                    );
                    if (similar && similar.image) {
                        selectedTrack.image = similar.image;
                    }
                }

                await this.play(selectedTrack, false, addToHistory);
            } else {
                const randomSimilar = similarTracks[Math.floor(Math.random() * similarTracks.length)];
                await this.play(randomSimilar, false, addToHistory);
            }
        } catch (error) {

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

            const tracksToChoose = filteredTracks.length > 0 ? filteredTracks : allLocalTracks;
            const randomTrack = tracksToChoose[Math.floor(Math.random() * tracksToChoose.length)];
            
            await this.play(randomTrack, false, manual);
        } catch (error) {
            console.error('[Player] Error in playRandomFromLocal:', error);
        }
    }

    async playPrevious() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
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
