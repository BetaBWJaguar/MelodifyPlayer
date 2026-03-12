const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

class PythonPlayer {
    constructor() {
        this.currentProcess = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUrl = null;
        this.playbackStartTime = 0;
        this.pausedAt = 0;
        this.totalPausedTime = 0;
        this.isManualStop = false;
        this.listeners = [];
        this.currentPosition = 0;
    }


    async play(youtubeUrl, useVlc = false, startTime = 0) {
        if (this.isPlaying) {
            this.stop();
        }

        return new Promise((resolve, reject) => {
            try {
                const pythonCmd = this.getPythonCommand();
                
                const scriptPath = path.join(__dirname, 'youtubePlayer.py');
                
                const args = [scriptPath, youtubeUrl];
                if (useVlc) {
                    args.push('--vlc');
                }
                if (startTime > 0) {
                    args.push('--start-time', startTime.toString());
                }

                console.log('[Python Player] Spawning:', pythonCmd, args.join(' '));

                this.currentProcess = spawn(pythonCmd, args, {
                    cwd: __dirname,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: false,
                    detached: false
                });

                let outputBuffer = '';
                let errorBuffer = '';

                this.currentProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    outputBuffer += output;
                });

                this.currentProcess.stderr.on('data', (data) => {
                    const error = data.toString();
                    errorBuffer += error;
                    if (error && !error.includes('Warning') && !error.includes('warning')) {
                        console.error('[Python Player Error]', error.trim());
                    }
                });

                this.currentProcess.on('close', (code, signal) => {
                    this.isPlaying = false;
                    this.currentProcess = null;
 
                    if (!this.isManualStop) {
                        this.notifyListeners('stop', { reason: 'finished', code, signal });
                    }
                    this.isManualStop = false;
                });

                this.currentProcess.on('error', (error) => {
                    this.isPlaying = false;
                    this.currentProcess = null;
                    reject(error);
                });

                setTimeout(() => {
                    if (this.currentProcess && !this.currentProcess.killed) {
                        if (this.currentProcess.exitCode === null) {
                            this.isPlaying = true;
                            this.isPaused = false;
                            this.currentUrl = youtubeUrl;
                            if (startTime === 0) {
                                this.playbackStartTime = Date.now();
                                this.pausedAt = 0;
                                this.totalPausedTime = 0;
                                this.currentPosition = 0;
                            } else {
                                this.currentPosition = startTime;
                                this.playbackStartTime = Date.now();
                                this.pausedAt = 0;
                                this.totalPausedTime = 0;
                            }
                            console.log('[Python Player] Process started successfully');
                            resolve(true);
                        } else {
                            const errorMsg = errorBuffer || outputBuffer || 'Process exited immediately';
                            reject(new Error(`Python player exited: ${errorMsg}`));
                        }
                    } else {
                        reject(new Error('Failed to start Python player'));
                    }
                }, 1000);

            } catch (error) {
                reject(error);
            }
        });
    }


    stop() {
        if (this.currentProcess) {
            this.isManualStop = true;
            
            try {
 
                if (os.platform() === 'win32') {
                    const { execSync } = require('child_process');
                    try {
                        execSync(`taskkill /F /PID ${this.currentProcess.pid} /T`, { stdio: 'ignore' });
                    } catch (e) {
                        try {
                            this.currentProcess.kill('SIGTERM');
                        } catch (killError) {
                            console.log('[Python Player] Process already terminated');
                        }
                    }
                } else {
                    try {
                        this.currentProcess.kill('SIGTERM');
                    } catch (killError) {
                        console.log('[Python Player] Process already terminated');
                    }
                }
                
                const killTimeout = setTimeout(() => {
                    if (this.currentProcess && !this.currentProcess.killed) {
                        console.log('[Python Player] Force killing...');
                        try {
                            this.currentProcess.kill('SIGKILL');
                        } catch (e) {
                            // Already killed
                        }
                    }
                }, 2000);
                
                this.currentProcess.once('close', () => {
                    clearTimeout(killTimeout);
                });
                
                this.isPlaying = false;
                this.currentProcess = null;
                this.notifyListeners('stop', { reason: 'manual' });
            } catch (error) {
                console.error('[Python Player] Error stopping:', error);
                this.isPlaying = false;
                this.currentProcess = null;
            }
        }
    }

    pause() {
        if (this.isPlaying && !this.isPaused && this.currentProcess) {
            const elapsedSinceLastResume = (Date.now() - this.playbackStartTime) / 1000;
            this.currentPosition = this.currentPosition + elapsedSinceLastResume;

            this.pausedAt = Date.now();
            this.isPaused = true;
            this.isPlaying = false;
            this.isManualStop = true;
            
            try {
                if (os.platform() === 'win32') {
                    const { execSync } = require('child_process');
                    try {
                        execSync(`taskkill /F /PID ${this.currentProcess.pid} /T`, { stdio: 'ignore' });
                    } catch (e) {
                        try {
                            this.currentProcess.kill('SIGTERM');
                        } catch (killError) {
                            console.log('[Python Player] Process already terminated');
                        }
                    }
                } else {
                    try {
                        this.currentProcess.kill('SIGTERM');
                    } catch (killError) {
                        console.log('[Python Player] Process already terminated');
                    }
                }
                this.currentProcess = null;
            } catch (error) {
                console.error('[Python Player] Error pausing:', error);
            }
            
            this.notifyListeners('pause', { url: this.currentUrl });
        }
    }

    async resume() {
        if (this.isPaused && this.currentUrl) {
            console.log('[Python Player] Resuming playback...');
            console.log(`[Python Player] Resuming from ${this.currentPosition} seconds`);
            await this.play(this.currentUrl, false, this.currentPosition);
            this.notifyListeners('resume', { url: this.currentUrl });
        }
    }

    getPythonCommand() {
        const platform = os.platform();
        
        if (platform === 'win32') {
            return 'python';
        } else {
            return 'python3';
        }
    }


    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            hasProcess: this.currentProcess !== null,
            pid: this.currentProcess ? this.currentProcess.pid : null,
            currentUrl: this.currentUrl
        };
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }


    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

module.exports = new PythonPlayer();
