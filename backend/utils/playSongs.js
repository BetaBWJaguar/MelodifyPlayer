const youtubeModule = require('./youtubeModule');
const pythonPlayer = require('./pythonPlayer');

class Player {
    constructor() {
        this.listeners = [];
        this.currentTrack = null;
        
        pythonPlayer.on('play', (data) => {
            this.notifyListeners('play', data);
        });
        
        pythonPlayer.on('stop', (data) => {
            this.notifyListeners('stop', data);
        });

        pythonPlayer.on('pause', (data) => {
            this.notifyListeners('pause', data);
        });
        
        pythonPlayer.on('resume', (data) => {
            this.notifyListeners('resume', data);
        });
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
                streamUrl: url
            };
            

            this.notifyListeners('play', this.currentTrack);
            

            await pythonPlayer.play(url, false);
            
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
