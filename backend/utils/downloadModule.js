const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let downloadDir = path.join(app.getPath('downloads'), 'MelodifyDownloads');

function ensureDownloadDir() {
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }
    return downloadDir;
}

function sanitizeFilename(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
}

function getYtDlpPath() {
    if (app && app.isPackaged) {
        return path.join(process.resourcesPath, 'ffmpeg', 'yt-dlp', 'yt-dlp.exe');
    }
    return path.join(__dirname, '../../ffmpeg/yt-dlp/yt-dlp.exe');
}

function checkYtDlp() {
    const ytDlpPath = getYtDlpPath();
    return fs.existsSync(ytDlpPath);
}

function downloadTrack(track, onProgress, onComplete, onError) {
    console.log('[Download] Track object:', JSON.stringify(track));
    
    const videoId = track.videoId || track.youtube?.videoId || track.id || track.track_id;
    
    if (!videoId) {
        const errorMsg = 'No video ID found for track';
        console.error('[Download]', errorMsg, track);
        onError(new Error(errorMsg));
        return null;
    }
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const safeTrackName = sanitizeFilename(track.name);
    const safeArtistName = sanitizeFilename(track.artist);
    const outputTemplate = path.join(
        ensureDownloadDir(),
        `${safeArtistName} - ${safeTrackName}.%(ext)s`
    );

    const ytDlpPath = getYtDlpPath();

    if (!checkYtDlp()) {
        const errorMsg = `yt-dlp not found at: ${ytDlpPath}. Please install yt-dlp in the ffmpeg/yt-dlp directory.`;
        console.error('[Download]', errorMsg);
        onError(new Error(errorMsg));
        return null;
    }

    console.log(`[Download] Starting download: ${safeTrackName} by ${safeArtistName}`);
    console.log(`[Download] YouTube URL: ${youtubeUrl}`);
    console.log(`[Download] Output: ${outputTemplate}`);

    const args = [
        '--no-warnings',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-metadata',
        '--embed-thumbnail',
        '--output', outputTemplate,
        youtubeUrl
    ];
    
    console.log('[Download] Command:', ytDlpPath, args.join(' '));

    const downloadProcess = spawn(ytDlpPath, args);

    let progressData = '';

    downloadProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            if (onProgress) {
                onProgress({
                    percent: progress,
                    track: track
                });
            }
        }
    });

    downloadProcess.stderr.on('data', (data) => {
        const output = data.toString();
        progressData += output;
        
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            if (onProgress) {
                onProgress({
                    percent: progress,
                    track: track
                });
            }
        }
    });

    downloadProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`[Download] Download completed: ${safeTrackName} by ${safeArtistName}`);
            
            const files = fs.readdirSync(downloadDir);
            const downloadedFile = files.find(file => 
                file.includes(safeTrackName) && 
                file.includes(safeArtistName) &&
                (file.endsWith('.mp3') || file.endsWith('.m4a'))
            );

            if (downloadedFile) {
                const filePath = path.join(downloadDir, downloadedFile);
                onComplete({
                    success: true,
                    filePath: filePath,
                    fileName: downloadedFile,
                    track: track
                });
            } else {
                onComplete({
                    success: true,
                    filePath: null,
                    fileName: null,
                    track: track
                });
            }
        } else {
            console.error(`[Download] Download failed with code ${code}`);
            onError(new Error(`Download failed with exit code ${code}`));
        }
    });

    downloadProcess.on('error', (error) => {
        console.error('[Download] Process error:', error);
        console.error('[Download] Error message:', error.message);
        console.error('[Download] Error code:', error.code);
        onError(error);
    });

    return downloadProcess;
}

function getDownloadDir() {
    return ensureDownloadDir();
}

function setDownloadDir(dir) {
    if (fs.existsSync(dir) || fs.mkdirSync(dir, { recursive: true })) {
        downloadDir = dir;
        return true;
    }
    return false;
}

function isTrackDownloaded(track) {
    const safeTrackName = sanitizeFilename(track.name);
    const safeArtistName = sanitizeFilename(track.artist);
    
    const files = fs.readdirSync(ensureDownloadDir());
    return files.some(file => 
        file.includes(safeTrackName) && 
        file.includes(safeArtistName) &&
        (file.endsWith('.mp3') || file.endsWith('.m4a'))
    );
}

function getDownloadedTracks() {
    const dir = ensureDownloadDir();
    const files = fs.readdirSync(dir);
    
    return files
        .filter(file => file.endsWith('.mp3') || file.endsWith('.m4a'))
        .map(file => ({
            fileName: file,
            filePath: path.join(dir, file),
            size: fs.statSync(path.join(dir, file)).size
        }));
}

function deleteDownloadedTrack(fileName) {
    const filePath = path.join(ensureDownloadDir(), fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}

module.exports = {
    downloadTrack,
    getDownloadDir,
    setDownloadDir,
    isTrackDownloaded,
    getDownloadedTracks,
    deleteDownloadedTrack,
    checkYtDlp
};
