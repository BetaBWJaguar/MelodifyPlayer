const { ipcRenderer } = require('electron');
const https = require('https');

let currentTrack = null;
let syncedLyrics = null;
let lyricsLines = [];
let isInitialized = false;
let cleanupFunctions = [];

function httpGetJson(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (req && !req.destroyed) req.destroy();
            reject(new Error(`Request timeout: ${url}`));
        }, timeout);

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        const req = https.get(url, options, (res) => {
            clearTimeout(timeoutId);

            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Error Code: ${res.statusCode}`));
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(new Error('JSON Parse Error: ' + err.message));
                }
            });
        }).on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });

        req.end();
    });
}

function cleanup() {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];
    isInitialized = false;
}

function addListener(channel, callback) {
    ipcRenderer.on(channel, callback);
    cleanupFunctions.push(() => {
        ipcRenderer.removeListener(channel, callback);
    });
}

export async function initLyricsPage() {
    console.log('[Lyrics] Initializing lyrics page...');

    cleanup();

    const searchInput = document.getElementById('lyricsSearchInput');
    const searchBtn = document.getElementById('lyricsSearchBtn');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) searchLyrics(query);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) searchLyrics(query);
            }
        });
    }

    try {
        const status = await ipcRenderer.invoke('get-player-status');
        if (status && status.currentTrack) {
            currentTrack = status.currentTrack;
            updateTrackInfo(currentTrack);

            const key = `${currentTrack.name.toLowerCase()}__${currentTrack.artist?.toLowerCase()}`;
            if (window.lyricsCache && window.lyricsCache[key]) {
                const cached = window.lyricsCache[key];
                showLyrics(cached.text, cached.synced);
                if (cached.synced) forceSyncLyrics(window.playerState?.currentTime || 0);
            } else {
                fetchLyrics(currentTrack.name, currentTrack.artist);
            }
        } else {
            showEmptyState();
            updateTrackInfo(null);
        }
    } catch (error) {
        console.error('[Lyrics] Player status error:', error);
        showEmptyState();
    }

    const onPlay = (event, data) => {
        console.log('[Lyrics] Play event received:', data?.name);
        currentTrack = data;
        updateTrackInfo(data);

        const key = `${data.name.toLowerCase()}__${data.artist?.toLowerCase()}`;
        if (window.lyricsCache && window.lyricsCache[key]) {
            const cached = window.lyricsCache[key];
            showLyrics(cached.text, cached.synced);
            if (cached.synced) forceSyncLyrics(window.playerState?.currentTime || 0);
        } else {
            fetchLyrics(data.name, data.artist);
        }
    };
    addListener('player-play', onPlay);

    const onStop = () => {
        currentTrack = null;
        syncedLyrics = null;
        lyricsLines = [];
        showEmptyState();
        updateTrackInfo(null);
    };
    addListener('player-stop', onStop);

    const onProgress = (event, data) => {
        if (syncedLyrics && syncedLyrics.length > 0) {
            highlightCurrentLine(data.currentTime);
        }
    };
    addListener('player-progress', onProgress);

    isInitialized = true;
}

export function cleanupLyricsPage() {
    cleanup();
}

function forceSyncLyrics(currentTime) {
    if (!syncedLyrics || syncedLyrics.length === 0 || !currentTime || currentTime <= 0) return;

    document.querySelectorAll('#lyricsText .lyrics-line[data-index]').forEach(el => {
        el.classList.remove('active');
    });

    let activeIndex = -1;
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
        if (lyricsLines[i].time >= 0 && lyricsLines[i].time <= currentTime) {
            activeIndex = i;
            break;
        }
    }

    if (activeIndex >= 0) {
        const activeLine = document.querySelector(`#lyricsText .lyrics-line[data-index="${activeIndex}"]`);
        if (activeLine) {
            activeLine.classList.add('active');

            const container = document.querySelector('.lyrics-page');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const lineRect = activeLine.getBoundingClientRect();
                const offset = lineRect.top - containerRect.top - (containerRect.height / 2) + (lineRect.height / 2);

                container.scrollTop += offset;
            }
        }
    }
}

function updateTrackInfo(track) {
    const trackNameEl = document.getElementById('lyricsTrackName');
    const artistNameEl = document.getElementById('lyricsArtistName');
    const albumArtEl = document.getElementById('lyricsAlbumArt');

    if (trackNameEl) {
        trackNameEl.textContent = track ? track.name : 'No track playing';
    }
    if (artistNameEl) {
        artistNameEl.textContent = track ? track.artist : 'Select a song to view lyrics';
    }
    if (albumArtEl) {
        if (track && track.image) {
            albumArtEl.style.backgroundImage = `url(${track.image})`;
            albumArtEl.style.backgroundSize = 'cover';
            albumArtEl.style.backgroundPosition = 'center';
        } else {
            albumArtEl.style.backgroundImage = '';
            albumArtEl.style.background = 'var(--gradient-1, linear-gradient(135deg, #667eea 0%, #764ba2 100%))';
        }
    }
}

function showEmptyState() {
    const emptyState = document.getElementById('lyricsEmptyState');
    const loading = document.getElementById('lyricsLoading');
    const lyricsText = document.getElementById('lyricsText');
    const notFound = document.getElementById('lyricsNotFound');

    if (emptyState) emptyState.style.display = 'flex';
    if (loading) loading.style.display = 'none';
    if (lyricsText) lyricsText.style.display = 'none';
    if (notFound) notFound.style.display = 'none';
}

function showLoading() {
    const emptyState = document.getElementById('lyricsEmptyState');
    const loading = document.getElementById('lyricsLoading');
    const lyricsText = document.getElementById('lyricsText');
    const notFound = document.getElementById('lyricsNotFound');

    if (emptyState) emptyState.style.display = 'none';
    if (loading) loading.style.display = 'flex';
    if (lyricsText) lyricsText.style.display = 'none';
    if (notFound) notFound.style.display = 'none';
}

function showLyrics(text, synced) {
    const emptyState = document.getElementById('lyricsEmptyState');
    const loading = document.getElementById('lyricsLoading');
    const lyricsText = document.getElementById('lyricsText');
    const notFound = document.getElementById('lyricsNotFound');

    if (emptyState) emptyState.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (lyricsText) lyricsText.style.display = 'block';
    if (notFound) notFound.style.display = 'none';

    if (synced) {
        renderSyncedLyrics(text);
    } else {
        renderPlainLyrics(text);
    }
}

function showNotFound() {
    const emptyState = document.getElementById('lyricsEmptyState');
    const loading = document.getElementById('lyricsLoading');
    const lyricsText = document.getElementById('lyricsText');
    const notFound = document.getElementById('lyricsNotFound');

    if (emptyState) emptyState.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (lyricsText) lyricsText.style.display = 'none';
    if (notFound) notFound.style.display = 'flex';
}

function renderPlainLyrics(text) {
    const lyricsText = document.getElementById('lyricsText');
    if (!lyricsText) return;

    syncedLyrics = null;
    lyricsLines = [];

    const lines = text.split('\n');

    const notice = `<div style="text-align:center; padding: 12px; margin-bottom: 20px; font-size: 12px; color: var(--text-secondary); background: rgba(255,255,255,0.03); border-radius: 8px;">Senkronize söz bulunamadı</div>`;

    const content = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') {
            return '<div class="lyrics-line empty-line"></div>';
        }
        return `<div class="lyrics-line">${escapeHtml(trimmed)}</div>`;
    }).join('');

    lyricsText.innerHTML = notice + content;
}

function renderSyncedLyrics(lrcText) {
    const lyricsText = document.getElementById('lyricsText');
    if (!lyricsText) return;

    lyricsLines = parseLRC(lrcText);
    syncedLyrics = lyricsLines;

    lyricsText.innerHTML = lyricsLines.map((line, index) => {
        if (line.text === '') {
            return `<div class="lyrics-line empty-line" data-index="${index}"></div>`;
        }
        return `<div class="lyrics-line" data-index="${index}" data-time="${line.time}">${escapeHtml(line.text)}</div>`;
    }).join('');
}

function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const parsed = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
        const timestamps = [];
        let match;

        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            timestamps.push(minutes * 60 + seconds + ms / 1000);
        }

        const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();

        if (timestamps.length > 0) {
            for (const time of timestamps) {
                parsed.push({ time, text });
            }
        } else if (text !== '') {
            parsed.push({ time: -1, text });
        }
    }

    parsed.sort((a, b) => a.time - b.time);
    return parsed;
}

function highlightCurrentLine(currentTime) {
    if (currentTime === undefined || currentTime <= 0) return;

    let activeIndex = -1;

    for (let i = lyricsLines.length - 1; i >= 0; i--) {
        if (lyricsLines[i].time >= 0 && lyricsLines[i].time <= currentTime) {
            activeIndex = i;
            break;
        }
    }

    const allLines = document.querySelectorAll('#lyricsText .lyrics-line[data-index]');

    allLines.forEach(el => {
        if (el.classList.contains('active')) {
            el.classList.remove('active');
        }
    });

    if (activeIndex >= 0) {
        const activeLine = document.querySelector(`#lyricsText .lyrics-line[data-index="${activeIndex}"]`);
        if (activeLine && !activeLine.classList.contains('active')) {
            activeLine.classList.add('active');

            const container = document.getElementById('lyricsContent');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const lineRect = activeLine.getBoundingClientRect();
                const offset = lineRect.top - containerRect.top - (containerRect.height / 2) + (lineRect.height / 2);
                container.scrollBy({ top: offset, behavior: 'smooth' });
            }
        }
    }
}

async function fetchLyrics(trackName, artistName) {
    if (!trackName) {
        showEmptyState();
        return;
    }

    showLoading();

    try {
        let cleanName = trackName
            .replace(/\(.*?(feat|ft|featuring).*?\)/gi, '')
            .replace(/\[.*?(feat|ft|featuring).*?\]/gi, '')
            .replace(/official\s*(music\s*)?video/gi, '')
            .replace(/lyrics?\s*(video)?/gi, '')
            .replace(/\(.*?remaster.*?\)/gi, '')
            .replace(/\[.*?remaster.*?\]/gi, '')
            .trim();

        let cleanArtist = artistName
            ? artistName.replace(/\(.*?\)/g, '').trim()
            : '';

        const query = cleanArtist
            ? `${cleanName} ${cleanArtist}`
            : cleanName;

        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const results = await httpGetJson(searchUrl);

        if (results && results.length > 0) {
            let bestMatch = null;

            for (const result of results) {
                if (result.syncedLyrics && result.syncedLyrics.trim().length > 10) {
                    const resultName = (result.trackName || '').toLowerCase();
                    const resultArtist = (result.artistName || '').toLowerCase();
                    const searchName = cleanName.toLowerCase();
                    const searchArtist = cleanArtist.toLowerCase();

                    if (resultName.includes(searchName) || searchName.includes(resultName)) {
                        if (!cleanArtist || resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist)) {
                            bestMatch = result;
                            break;
                        }
                    }
                }
            }

            if (!bestMatch) {
                for (const result of results) {
                    if (result.syncedLyrics && result.syncedLyrics.trim().length > 10) {
                        bestMatch = result;
                        break;
                    }
                }
            }

            if (bestMatch && bestMatch.syncedLyrics) {
                showLyrics(bestMatch.syncedLyrics, true);
                forceSyncLyrics(window.playerState?.currentTime || 0);
                return;
            }

            for (const result of results) {
                if (result.plainLyrics && result.plainLyrics.trim().length > 10) {
                    bestMatch = result;
                    break;
                }
            }

            if (bestMatch && bestMatch.plainLyrics) {
                showLyrics(bestMatch.plainLyrics, false);
                return;
            }
        }

        showNotFound();
    } catch (error) {
        console.error('[Lyrics] Error fetching lyrics:', error);
        showNotFound();
    }
}

async function searchLyrics(query) {
    if (!query) return;

    showLoading();

    try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const results = await httpGetJson(searchUrl);

        if (results && results.length > 0) {
            const result = results[0];

            if (result.syncedLyrics && result.syncedLyrics.trim().length > 10) {
                showLyrics(result.syncedLyrics, true);
                forceSyncLyrics(window.playerState?.currentTime || 0);
                return;
            }
            else if (result.plainLyrics && result.plainLyrics.trim().length > 10) {
                showLyrics(result.plainLyrics, false);
                return;
            }
        }

        showNotFound();
    } catch (error) {
        console.error('[Lyrics] Error searching lyrics:', error);
        showNotFound();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}