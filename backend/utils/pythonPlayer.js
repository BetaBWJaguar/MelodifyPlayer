const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

class PythonPlayer {
    constructor() {
        this.process = null;

        this.isPlaying = false;
        this.isPaused = false;
        this.currentUrl = null;
        this.basePosition = 0;
        this.playStartTime = 0;

        this.listeners = [];
    }

    getCurrentPosition() {
        if (this.isPaused) return this.basePosition;
        if (!this.isPlaying) return this.basePosition;

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
                console.log('[Python stdout]', d.toString().trim());
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

            setTimeout(() => {
                if (resolvedOrRejected) return;

                if (this.process !== proc) {
                    resolvedOrRejected = true;
                    reject(new Error(errorBuffer || 'Python process replaced or closed before startup'));
                    return;
                }

                if (proc.exitCode !== null) {
                    resolvedOrRejected = true;
                    reject(new Error(errorBuffer || `Python process exited early with code ${proc.exitCode}`));
                    return;
                }

                this.isPlaying = true;
                this.isPaused = false;
                this.currentUrl = url;
                this.basePosition = startTime;
                this.playStartTime = Date.now();

                console.log('[PythonPlayer] Started');
                resolvedOrRejected = true;
                resolve(true);
            }, 500);
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

    pause() {
        if (!this.isPlaying || !this.process) return;

        this.basePosition = this.getCurrentPosition();
        console.log('[PythonPlayer] Pause at', this.basePosition);

        const proc = this.process;
        proc._exitReason = 'pause';

        this.isPlaying = false;
        this.isPaused = true;

        try {
            if (os.platform() === 'win32') {
                execSync(`taskkill /F /PID ${proc.pid} /T`, { stdio: 'ignore' });
            } else {
                proc.kill('SIGTERM');
            }
        } catch {}

        this.notifyListeners('pause', {});
    }

    async resume() {
        if (!this.isPaused || !this.currentUrl) return;

        const position = this.basePosition;
        console.log('[PythonPlayer] Resume from', position);

        await this.play(this.currentUrl, position);
        this.notifyListeners('resume', {});
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
            pid: this.process ? this.process.pid : null
        };
    }
}

module.exports = new PythonPlayer();