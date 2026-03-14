const youtubeModule = require('./youtubeModule');
const pythonPlayer = require('./pythonPlayer');

class Player {
    constructor() {
        this.listeners = [];
        this.currentTrack = null;
        this.progressInterval = null;
        
        pythonPlayer.on('play', (data) => {
            this.notifyListeners('play', data);
        });
        
        pythonPlayer.on('stop', (data) => {
            this.stopProgressUpdates();
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

    async play(track) {
        try {
            console.log('[Player] Requesting to play:', track.name, 'by', track.artist);
            
            if (pythonPlayer.getStatus().isPlaying) {
                pythonPlayer.stop();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const video = await youtubeModule.getVideoForTrack(track.name, track.artist);
            const url = `https://www.youtube.com/watch?v=${video.videoId}`;

            this.currentTrack = {
                ...track,
                videoId: video.videoId,
                streamUrl: url,
                duration: video.duration
            };

            this.notifyListeners('play', this.currentTrack);

            await pythonPlayer.play(url, false);
            

            setTimeout(() => {
                this.startProgressUpdates();
            }, 1500);
            
        } catch (error) {
            console.error('[Player] Play error:', error);
            this.notifyListeners('error', { error: error.message });
            this.notifyListeners('stop', { reason: 'error' });
        }
    }

    stop() {
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
