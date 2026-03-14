const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const net = require('net');

class PythonPlayer {
    constructor() {
        this.process = null;

        this.isPlaying = false;
        this.isPaused = false;
        this.currentUrl = null;
        this.basePosition = 0;
        this.playStartTime = 0;
        this.ipcSocketPath = "\\\\.\\pipe\\mpv-socket";
        this.actualDuration = null;

        this.listeners = [];
    }

    getCurrentPosition() {
        if (this.isPaused) return this.basePosition;
        if (!this.isPlaying) return this.basePosition;
        
        if (this.playStartTime === 0) return this.basePosition;

        const elapsed = (Date.now() - this.playStartTime) / 1000;
        return this.basePosition + elapsed;
    }

    async play(url, startTime = 0) {
        if (this.process) {
            console.log('[PythonPlayer] Killing previous player');

            try {
                const oldProc = this.process;
                oldProc._exitReason = 'replace';

                if (os.platform() === 'win32') {
                    execSync(`taskkill /F /PID ${oldProc.pid} /T`, { stdio: 'ignore' });
                } else {
                    oldProc.kill('SIGKILL');
                }
            } catch (e) {}

            this.process = null;
            this.isPlaying = false;
            this.isPaused = false;
        }

        return new Promise((resolve, reject) => {
            const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';
            const scriptPath = path.join(__dirname, 'youtubePlayer.py');

            const args = [scriptPath, url];
            if (startTime > 0) {
                args.push('--start-time', startTime.toFixed(3));
            }

            console.log('[PythonPlayer] Spawn:', pythonCmd, args.join(' '));

            const proc = spawn(pythonCmd, args, {
                cwd: __dirname,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            proc._exitReason = null;
            this.process = proc;

            let errorBuffer = '';
            let resolvedOrRejected = false;

            proc.stdout.on('data', d => {
                const msg = d.toString();
                console.log('[Python stdout]', msg.trim());
                
                if (msg.includes('IPC Socket:')) {
                    const match = msg.match(/IPC Socket: (.+)/);
                    if (match) {
                        this.ipcSocketPath = match[1].trim();
                        console.log('[PythonPlayer] Captured IPC socket:', this.ipcSocketPath);
                    }
                }
            });

            proc.stderr.on('data', d => {
                const msg = d.toString();
                errorBuffer += msg;
                console.error('[Python stderr]', msg.trim());
            });

            proc.on('close', (code, signal) => {
                console.log(`[PythonPlayer] Process closed. code=${code}, signal=${signal}, pid=${proc.pid}, reason=${proc._exitReason}`);

                const wasCurrent = this.process === proc;
                const reason = proc._exitReason;

                if (wasCurrent) {
                    this.process = null;
                    this.isPlaying = false;
                }

                if (reason === 'pause') {
                    return;
                }

                if (reason === 'replace') {
                    return;
                }

                if (reason === 'stop') {
                    this.notifyListeners('stop', { reason: 'manual' });
                    return;
                }

                this.notifyListeners('stop', { reason: 'ended' });
            });

            proc.on('error', err => {
                if (!resolvedOrRejected) {
                    resolvedOrRejected = true;
                    reject(err);
                }
            });

            proc.on('spawn', () => {
                console.log('[PythonPlayer] Process spawned');

                if (resolvedOrRejected) return;

                setTimeout(() => {
                    if (!proc || proc.killed || proc.exitCode !== null) {
                        console.log('[PythonPlayer] Process exited immediately after spawn');
                        if (!resolvedOrRejected) {
                            resolvedOrRejected = true;
                        }
                        return;
                    }

                    this.isPlaying = true;
                    this.isPaused = false;
                    this.currentUrl = url;
                    this.basePosition = startTime;
                    this.playStartTime = 0;
                    this.actualDuration = null;

                    console.log('[PythonPlayer] Started');
                    this.playStartTime = Date.now();
                    resolvedOrRejected = true;
                    resolve(true);
                    
                    setTimeout(() => {
                        this.getActualDuration();
                    }, 2000);
                    
                    if (startTime > 0) {
                        setTimeout(() => {
                            this.getActualPosition().then(pos => {
                                if (pos !== null) {
                                    this.basePosition = pos;
                                    console.log('[PythonPlayer] Synced seek position:', pos);
                                }
                            });
                        }, 1000);
                    }
                }, 1000);
            });
        });
    }

    stop() {
        if (!this.process) return;

        try {
            const proc = this.process;
            proc._exitReason = 'stop';

            if (os.platform() === 'win32') {
                execSync(`taskkill /F /PID ${proc.pid} /T`, { stdio: 'ignore' });
            } else {
                proc.kill('SIGTERM');
            }
        } catch {}

        this.isPlaying = false;
        this.isPaused = false;
        this.basePosition = 0;
    }

    async pause() {
        if (!this.isPlaying || !this.process) return;

        const actualPos = await this.getActualPosition();
        if (actualPos !== null) {
            this.basePosition = actualPos;
        } else {
            this.basePosition = this.getCurrentPosition();
        }
        
        console.log('[PythonPlayer] Pause at', this.basePosition);
        console.log('[PythonPlayer] IPC socket path:', this.ipcSocketPath);

        try {
            await this._sendMpvCommand({ command: ["set_property", "pause", true] });
            this.isPlaying = false;
            this.isPaused = true;
            console.log('[PythonPlayer] Paused via IPC');
            this.notifyListeners('pause', {});
        } catch (error) {
            console.error('[PythonPlayer] IPC pause failed, falling back to kill:', error);
            const proc = this.process;
            proc._exitReason = 'pause';
            try {
                if (os.platform() === 'win32') {
                    execSync(`taskkill /F /PID ${proc.pid} /T`, { stdio: 'ignore' });
                } else {
                    proc.kill('SIGTERM');
                }
            } catch {}
            this.isPlaying = false;
            this.isPaused = true;
            this.notifyListeners('pause', {});
        }
    }

    async resume() {
        if (!this.isPaused || !this.currentUrl) return;

        console.log('[PythonPlayer] Resume from', this.basePosition);
        console.log('[PythonPlayer] IPC socket path:', this.ipcSocketPath);

        if (!this.process) {
            console.log('[PythonPlayer] Process not running, starting new one');
            await this.play(this.currentUrl, this.basePosition);
            this.notifyListeners('resume', {});
            return;
        }

        try {
            await this._sendMpvCommand({ command: ["set_property", "pause", false] });
            this.isPlaying = true;
            this.isPaused = false;
            this.playStartTime = Date.now();
            const actualPos = await this.getActualPosition();
            if (actualPos !== null) {
                this.basePosition = actualPos;
            }
            console.log('[PythonPlayer] Resumed via IPC');
            this.notifyListeners('resume', {});
        } catch (error) {
            console.error('[PythonPlayer] IPC resume failed, falling back to restart:', error);
            await this.play(this.currentUrl, this.basePosition);
            this.notifyListeners('resume', {});
        }
    }

    async seek(position) {
        if (!this.isPlaying || !this.process) {
            console.log('[PythonPlayer] Cannot seek - not playing');
            return false;
        }

        console.log('[PythonPlayer] Seeking to', position, 'via IPC');
        
        try {
            await this._sendMpvCommand({ command: ["seek", position, "absolute"] });
            
            this.basePosition = position;
            this.playStartTime = Date.now();
            
            console.log('[PythonPlayer] Seek successful');
            return true;
        } catch (error) {
            console.error('[PythonPlayer] IPC seek failed:', error);
            return false;
        }
    }

    _sendMpvCommand(command, retries = 5) {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            let resolved = false;
            let responseData = null;
            
            const tryConnect = () => {
                attempt++;
                console.log(`[PythonPlayer] IPC connection attempt ${attempt}/${retries} to ${this.ipcSocketPath}`);
                
                const client = net.createConnection(this.ipcSocketPath, () => {
                    console.log('[PythonPlayer] IPC connected, sending command:', JSON.stringify(command));
                    const jsonCommand = JSON.stringify(command) + '\n';
                    client.write(jsonCommand);
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            client.destroy();
                            console.log('[PythonPlayer] IPC command sent successfully');
                            resolve(responseData);
                        }
                    }, 200);
                });

                client.on('data', (data) => {
                    console.log('[PythonPlayer] IPC response:', data.toString());
                    try {
                        const parsed = JSON.parse(data.toString());
                        responseData = parsed;
                    } catch (e) {
                        // Not JSON, ignore
                    }
                    if (!resolved) {
                        resolved = true;
                        client.destroy();
                        resolve(responseData);
                    }
                });

                client.on('end', () => {
                    if (!resolved) {
                        console.log('[PythonPlayer] IPC connection ended');
                        resolved = true;
                        resolve(responseData);
                    }
                });

                client.on('error', (err) => {
                    console.log(`[PythonPlayer] IPC error on attempt ${attempt}:`, err.message);
                    if (attempt < retries && !resolved) {
                        setTimeout(tryConnect, 300);
                    } else if (!resolved) {
                        resolved = true;
                        reject(err);
                    }
                });

                setTimeout(() => {
                    if (client.readyState === 'connecting' && !resolved) {
                        console.log(`[PythonPlayer] IPC timeout on attempt ${attempt}`);
                        client.destroy();
                        if (attempt < retries) {
                            setTimeout(tryConnect, 300);
                        } else {
                            resolved = true;
                            reject(new Error('IPC timeout'));
                        }
                    }
                }, 1000);
            };
            
            tryConnect();
        });
    }

    async getActualDuration() {
        try {
            const response = await this._sendMpvCommand({ command: ["get_property", "duration"] });
            if (response && response.data !== undefined) {
                this.actualDuration = response.data;
                console.log('[PythonPlayer] Got actual duration:', this.actualDuration);
                return this.actualDuration;
            }
        } catch (error) {
            console.error('[PythonPlayer] Failed to get duration:', error);
        }
        return this.actualDuration;
    }

    async getActualPosition() {
        try {
            const response = await this._sendMpvCommand({ command: ["get_property", "time-pos"] });
            if (response && response.data !== undefined) {
                return response.data;
            }
        } catch (error) {
            console.error('[PythonPlayer] Failed to get position:', error);
        }
        return null;
    }

    on(event, cb) {
        this.listeners.push({ event, cb });
    }

    notifyListeners(event, data) {
        this.listeners.forEach(l => {
            if (l.event === event) {
                l.cb(data);
            }
        });
    }

    getStatus() {
        return {
            playing: this.isPlaying,
            paused: this.isPaused,
            position: this.getCurrentPosition(),
            url: this.currentUrl,
            pid: this.process ? this.process.pid : null,
            actualDuration: this.actualDuration
        };
    }
}

module.exports = new PythonPlayer();
