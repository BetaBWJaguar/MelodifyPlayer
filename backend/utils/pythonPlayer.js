const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const net = require('net');

function killAllMpvProcesses() {
    try {
        if (os.platform() === 'win32') {
            execSync('taskkill /F /IM mpv.exe /T', { stdio: 'ignore' });
            console.log('[PythonPlayer] Killed all mpv.exe processes');
        } else {
            execSync('pkill -9 mpv', { stdio: 'ignore' });
            console.log('[PythonPlayer] Killed all mpv processes');
        }
    } catch (e) {
        // No mpv processes or error killing them - ignore
    }
}

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
        this.volume = 100;

        this.listeners = [];
        this.isPlayingPromise = false;
        this.pendingPlayRequest = null;

        this.socket = null;
        this.isConnecting = false;
    }

    async _getSocket(retries = 20) {
        if (this.socket && !this.socket.destroyed) {
            return this.socket;
        }

        if (this.isConnecting) {
            await new Promise(r => setTimeout(r, 50));
            return this._getSocket(retries);
        }

        this.isConnecting = true;
        return new Promise((resolve, reject) => {
            const client = net.createConnection(this.ipcSocketPath, () => {
                this.socket = client;
                this.isConnecting = false;

                try {
                    client.write(JSON.stringify({
                        command: ["observe_property", 1, "pause"]
                    }) + '\n');
                } catch (e) {
                    console.error('[PythonPlayer] Failed to send observe_property:', e);
                }

                resolve(client);
            });

            client.on('error', (err) => {
                this.isConnecting = false;
                this.socket = null;

                if (err.code === 'ENOENT' && retries > 0) {
                    setTimeout(() => {
                        resolve(this._getSocket(retries - 1));
                    }, 100);
                } else {
                    reject(err);
                }
            });

            client.on('data', (data) => {
                try {
                    const lines = data.toString().split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        const msg = JSON.parse(line);

                        if (msg.event === "end-file") {
                            console.log('[PythonPlayer] IPC Ended:', msg.reason);

                            if (msg.reason === "error") {
                                console.error(`[PythonPlayer ERROR] File-Error: ${msg.file_error || 'None'}, Error: ${msg.error || 'Unknown'}`);
                            }

                            this.isPlaying = false;
                            this.isPaused = false;

                            if (msg.reason === "eof" || msg.reason === "quit" || msg.reason === "error") {
                                this.notifyListeners('stop', { reason: 'ended' });
                            }
                        }

                        if (msg.event === "property-change" && msg.name === "pause") {
                            if (msg.data === true && this.isPlaying) {
                                console.log('[PythonPlayer] Detected external pause via property observation');
                                this.isPlaying = false;
                                this.isPaused = true;
                                const actualPos = this.getCurrentPosition();
                                this.basePosition = actualPos;
                                this.notifyListeners('pause', {});
                            } else if (msg.data === false && this.isPaused) {
                                console.log('[PythonPlayer] Detected external resume via property observation');
                                this.isPlaying = true;
                                this.isPaused = false;
                                this.playStartTime = Date.now();
                                this.notifyListeners('resume', {});
                            }
                        }
                    }
                } catch (e) {

                }
            });

            client.setTimeout(0);
        });
    }

    getCurrentPosition() {
        if (this.isPaused) return this.basePosition;
        if (!this.isPlaying) return this.basePosition;

        if (this.playStartTime === 0) return this.basePosition;

        const elapsed = (Date.now() - this.playStartTime) / 1000;
        return this.basePosition + elapsed;
    }

    async play(url, startTime = 0) {
        if (this.isPlayingPromise) {
            this.pendingPlayRequest = { url, startTime };
            return true;
        }

        this.isPlayingPromise = true;
        this.pendingPlayRequest = null;

        try {
            if (this.process && this.socket && !this.socket.destroyed) {
                let loadCmd = ["loadfile", url];
                if (startTime > 0) {
                    loadCmd = ["loadfile", url, "replace", `start=${startTime}`];
                }

                try {
                    await this._sendMpvCommand({ command: loadCmd });


                    await this._sendMpvCommand({ command: ["set_property", "pause", false] });

                    this.isPlaying = true;
                    this.isPaused = false;
                    this.currentUrl = url;
                    this.basePosition = startTime;
                    this.playStartTime = Date.now();
                    this.actualDuration = null;

                    setTimeout(() => this.setVolume(this.volume), 500);
                    setTimeout(() => this.getActualDuration(), 2000);

                    return true;
                } catch (ipcError) {
                    console.error('[PythonPlayer] IPC loadfile Error:', ipcError.message);
                    if (this.socket) {
                        this.socket.destroy();
                        this.socket = null;
                    }
                }
            }

            if (this.process) {
                console.log('[PythonPlayer] Broken player clearing...');
                this.process._exitReason = 'replace';
            }

            killAllMpvProcesses();

            if (this.process) {
                try {
                    const oldProc = this.process;
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

            await new Promise((resolve, reject) => {
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

                proc.stdout.on('data', async (d) => {
                    const msg = d.toString();
                    if (msg.includes('IPC Socket:')) {
                        const match = msg.match(/IPC Socket: (.+)/);
                        if (match) {
                            this.ipcSocketPath = match[1].trim();
                            await this._getSocket();
                        }
                    }
                });

                proc.stderr.on('data', d => {
                    errorBuffer += d.toString();
                });

                proc.on('close', (code, signal) => {
                    const wasCurrent = this.process === proc;
                    if (wasCurrent) {
                        this.process = null;
                        this.isPlaying = false;
                        this.socket = null;
                    }
                    if (proc._exitReason !== 'pause' && proc._exitReason !== 'replace') {
                        this.notifyListeners('stop', { reason: proc._exitReason || 'ended' });
                    }
                });

                proc.on('error', err => {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true;
                        reject(err);
                    }
                });

                proc.on('spawn', () => {
                    if (resolvedOrRejected) return;

                    setTimeout(() => {
                        if (!proc || proc.killed) {
                            if (!resolvedOrRejected) {
                                resolvedOrRejected = true;
                                reject(new Error('Process exited immediately'));
                            }
                            return;
                        }

                        this.isPlaying = true;
                        this.isPaused = false;
                        this.currentUrl = url;
                        this.basePosition = startTime;
                        this.playStartTime = Date.now();
                        this.actualDuration = null;

                        resolvedOrRejected = true;
                        resolve(true);

                        setTimeout(() => this.setVolume(this.volume), 500);
                        setTimeout(() => this.getActualDuration(), 2000);
                    }, 1500);
                });
            });

            if (this.pendingPlayRequest) {
                const { url: pendingUrl, startTime: pendingStartTime } = this.pendingPlayRequest;
                this.pendingPlayRequest = null;
                this.isPlayingPromise = false;
                return this.play(pendingUrl, pendingStartTime);
            }
        } finally {
            this.isPlayingPromise = false;
        }

        return true;
    }

    async stop() {
        this.pendingPlayRequest = null;

        console.log('[PythonPlayer] Stopping current track via IPC (MPV stays idle)');

        if (this.socket && !this.socket.destroyed) {
            try {
                await this._sendMpvCommand({ command: ["stop"] });
            } catch (e) {
                console.error('[PythonPlayer] Error sending IPC stop:', e);
            }
        } else {
            this.destroy();
            return;
        }

        this.isPlaying = false;
        this.isPaused = false;
        this.basePosition = 0;
    }

    destroy() {
        console.log('[PythonPlayer] Destroying MPV process completely');
        this.pendingPlayRequest = null;

        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }

        killAllMpvProcesses();

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

        this.process = null;
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
                killAllMpvProcesses();
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
        if ((!this.isPlaying && !this.isPaused) || !this.process) {
            console.log('[PythonPlayer] Cannot seek - not playing or paused');
            return false;
        }

        console.log('[PythonPlayer] Seeking to', position, 'via IPC');

        try {
            await this._sendMpvCommand({ command: ["seek", position, "absolute"] });

            this.basePosition = position;
            if (this.isPlaying) {
                this.playStartTime = Date.now();
            }

            console.log('[PythonPlayer] Seek successful');
            return true;
        } catch (error) {
            console.error('[PythonPlayer] IPC seek failed:', error);
            return false;
        }
    }

    async setVolume(volume) {
        console.log('[PythonPlayer] Setting volume to:', volume);
        this.volume = volume;

        try {
            await this._sendMpvCommand({ command: ["set_property", "volume", volume] });
            console.log('[PythonPlayer] Volume set successfully');
            return true;
        } catch (error) {
            console.error('[PythonPlayer] Failed to set volume:', error);
            return false;
        }
    }

    async _sendMpvCommand(command) {
        try {
            const client = await this._getSocket();

            return new Promise((resolve, reject) => {
                const requestId = Math.floor(Math.random() * 10000);
                const jsonCommand = JSON.stringify({ ...command, request_id: requestId }) + '\n';

                const onData = (data) => {
                    try {
                        const lines = data.toString().split('\n');
                        for (let line of lines) {
                            if (!line.trim()) continue;
                            const parsed = JSON.parse(line);

                            if (parsed.request_id === requestId || parsed.error === 'success' || parsed.data !== undefined) {
                                client.removeListener('data', onData);
                                clearTimeout(timeout);
                                resolve(parsed);
                                return;
                            }
                        }
                    } catch (e) {
                    }
                };

                client.on('data', onData);
                client.write(jsonCommand);

                const timeout = setTimeout(() => {
                    client.removeListener('data', onData);
                    reject(new Error("IPC Command Timeout"));
                }, 2000);
            });

        } catch (error) {
            this.socket = null;
            throw error;
        }
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

const pythonPlayer = new PythonPlayer();
module.exports = pythonPlayer;
module.exports.killAllMpvProcesses = killAllMpvProcesses;
