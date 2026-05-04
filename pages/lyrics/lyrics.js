const { ipcRenderer } = require('electron');
const https = require('https');

let currentTrack = null;
let syncedLyrics = null;
let lyricsLines = [];
let isInitialized = false;
let cleanupFunctions = [];
let activeLineIndex = -1;
let fadeObserver = null;
let resyncInterval = null;

function t(key) {
    if (window.i18n && window.i18n[key]) {
        return window.i18n[key];
    }
    const el = document.querySelector(`[data-i18n="${key}"]`);
    if (el) return el.textContent;
    return key;
}

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

    if (fadeObserver) {
        fadeObserver.disconnect();
        fadeObserver = null;
    }

    if (resyncInterval) {
        clearInterval(resyncInterval);
        resyncInterval = null;
    }

    activeLineIndex = -1;
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

    setupFadeMasks();

    resyncInterval = setInterval(() => {
        if (syncedLyrics && syncedLyrics.length > 0 &&
            window.playerState?.isPlaying && !window.playerState?.isPaused) {
            const ct = window.playerState?.currentTime;
            if (ct !== undefined && ct > 0) {
                highlightCurrentLine(ct, false);
            }
        }
    }, 500);

    try {
        const status = await ipcRenderer.invoke('get-player-status');
        if (status && status.currentTrack) {
            currentTrack = status.currentTrack;
            updateTrackInfo(currentTrack);
            activateBgGlow(true);

            const key = `${currentTrack.name.toLowerCase()}__${currentTrack.artist?.toLowerCase()}`;
            if (window.lyricsCache && window.lyricsCache[key]) {
                const cached = window.lyricsCache[key];
                showLyrics(cached.text, cached.synced);
                if (cached.synced) {
                    setTimeout(() => {
                        forceSyncLyrics(window.playerState?.currentTime || status.currentTime || 0);
                    }, 100);
                }
            } else {
                fetchLyrics(currentTrack.name, currentTrack.artist);
            }
        } else {
            showEmptyState();
            updateTrackInfo(null);
            activateBgGlow(false);
        }
    } catch (error) {
        console.error('[Lyrics] Player status error:', error);
        showEmptyState();
    }

    const onPlay = (event, data) => {
        console.log('[Lyrics] Play event received:', data?.name);
        currentTrack = data;
        updateTrackInfo(data);
        activateBgGlow(true);

        const key = `${data.name.toLowerCase()}__${data.artist?.toLowerCase()}`;
        if (window.lyricsCache && window.lyricsCache[key]) {
            const cached = window.lyricsCache[key];
            showLyrics(cached.text, cached.synced);
            if (cached.synced) {
                setTimeout(() => {
                    forceSyncLyrics(window.playerState?.currentTime || 0);
                }, 200);
            }
        } else {
            fetchLyrics(data.name, data.artist);
        }
    };
    addListener('player-play', onPlay);

    const onResume = () => {
        console.log('[Lyrics] Resume event - re-syncing lyrics');
        if (syncedLyrics && syncedLyrics.length > 0) {
            setTimeout(() => {
                forceSyncLyrics(window.playerState?.currentTime || 0);
            }, 150);
        }
    };
    addListener('player-resume', onResume);

    const onPause = () => {
        console.log('[Lyrics] Paused - keeping current line highlighted');
    };
    addListener('player-pause', onPause);

    const onStop = () => {
        currentTrack = null;
        syncedLyrics = null;
        lyricsLines = [];
        activeLineIndex = -1;
        showEmptyState();
        updateTrackInfo(null);
        activateBgGlow(false);
    };
    addListener('player-stop', onStop);

    const onProgress = (event, data) => {
        if (syncedLyrics && syncedLyrics.length > 0) {
            highlightCurrentLine(data.currentTime, true);
        }
    };
    addListener('player-progress', onProgress);

    isInitialized = true;
}

export function cleanupLyricsPage() {
    cleanup();
}

function setupFadeMasks() {
    const container = document.querySelector('.lyrics-content');
    const fadeTop = document.querySelector('.lyrics-fade-top');
    const fadeBottom = document.querySelector('.lyrics-fade-bottom');
    if (!container || !fadeTop || !fadeBottom) return;

    const updateFades = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        fadeTop.classList.toggle('visible', scrollTop > 10);
        fadeBottom.classList.toggle('visible', scrollTop < scrollHeight - clientHeight - 10);
    };

    container.addEventListener('scroll', updateFades, { passive: true });
    updateFades();

    cleanupFunctions.push(() => {
        container.removeEventListener('scroll', updateFades);
    });
}

function setupLyricsSeek() {
    const lyricsText = document.getElementById('lyricsText');
    if (!lyricsText) return;

    const handleLyricClick = (e) => {
        const line = e.target.closest('.lyrics-line[data-time]');
        if (!line) return;

        const time = parseFloat(line.dataset.time);
        if (isNaN(time) || time < 0) return;

        line.classList.add('seek-flash');
        setTimeout(() => {
            line.classList.remove('seek-flash');
        }, 500);

        ipcRenderer.send('request-seek', time);

        const index = parseInt(line.dataset.index, 10);
        if (!isNaN(index)) {
            activeLineIndex = index;
            applyLineClasses(index);
        }

        console.log('[Lyrics] Seek to:', time, 's');
    };

    lyricsText.addEventListener('click', handleLyricClick);

    cleanupFunctions.push(() => {
        lyricsText.removeEventListener('click', handleLyricClick);
    });
}

function activateBgGlow(active) {
    const glow = document.querySelector('.lyrics-bg-glow');
    if (glow) {
        glow.classList.toggle('active', active);
    }
}

function forceSyncLyrics(currentTime) {
    if (!syncedLyrics || syncedLyrics.length === 0) return;

    if (!currentTime || currentTime <= 0) return;

    document.querySelectorAll('#lyricsText .lyrics-line[data-index]').forEach(el => {
        el.classList.remove('active', 'near-1', 'near-2', 'far');
    });

    let activeIndex = -1;
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
        if (lyricsLines[i].time >= 0 && lyricsLines[i].time <= currentTime) {
            activeIndex = i;
            break;
        }
    }

    if (activeIndex >= 0) {
        activeLineIndex = activeIndex;
        applyLineClasses(activeIndex);

        const activeLine = document.querySelector(`#lyricsText .lyrics-line[data-index="${activeIndex}"]`);
        if (activeLine) {
            activeLine.classList.add('active');

            const container = document.querySelector('.lyrics-content');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const lineRect = activeLine.getBoundingClientRect();
                const offset = lineRect.top - containerRect.top - (containerRect.height / 2) + (lineRect.height / 2);
                container.scrollTop += offset;
            }
        }
    } else {
        activeLineIndex = -1;
        document.querySelectorAll('#lyricsText .lyrics-line[data-index]').forEach(el => {
            el.classList.add('far');
        });
    }
}

function updateTrackInfo(track) {
    const trackNameEl = document.getElementById('lyricsTrackName');
    const artistNameEl = document.getElementById('lyricsArtistName');
    const albumArtEl = document.getElementById('lyricsAlbumArt');
    const albumArtGlow = document.getElementById('lyricsAlbumArtGlow');
    const nowPlayingBadge = document.getElementById('lyricsNowPlayingBadge');

    if (trackNameEl) {
        trackNameEl.textContent = track ? track.name : t('lyrics.noTrackPlaying');
    }
    if (artistNameEl) {
        artistNameEl.textContent = track ? track.artist : t('lyrics.playToSee');
    }
    if (nowPlayingBadge) {
        nowPlayingBadge.style.display = track ? 'inline-flex' : 'none';
    }
    if (albumArtEl) {
        if (track && track.image) {
            albumArtEl.style.backgroundImage = `url(${track.image})`;
            albumArtEl.style.backgroundSize = 'cover';
            albumArtEl.style.backgroundPosition = 'center';
            albumArtEl.classList.add('has-image');
            if (albumArtGlow) {
                albumArtGlow.style.backgroundImage = `url(${track.image})`;
                albumArtGlow.style.backgroundSize = 'cover';
                albumArtGlow.style.backgroundPosition = 'center';
                albumArtGlow.classList.add('active');
            }
        } else {
            albumArtEl.style.backgroundImage = '';
            albumArtEl.style.background = 'var(--gradient-1, linear-gradient(135deg, #667eea 0%, #764ba2 100%))';
            albumArtEl.classList.remove('has-image');
            if (albumArtGlow) {
                albumArtGlow.style.backgroundImage = '';
                albumArtGlow.classList.remove('active');
            }
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

    activeLineIndex = -1;

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

    const notice = `<div class="lyrics-plain-notice">${t('lyrics.syncNotFound')}</div>`;

    const content = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '') {
            return '<div class="lyrics-line empty-line"></div>';
        }
        return `<div class="lyrics-line" style="opacity:0.65;">${escapeHtml(trimmed)}</div>`;
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
        return `<div class="lyrics-line far" data-index="${index}" data-time="${line.time}">${escapeHtml(line.text)}</div>`;
    }).join('');

    setupLyricsSeek();
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

function applyLineClasses(activeIndex) {
    const allLines = document.querySelectorAll('#lyricsText .lyrics-line[data-index]');
    allLines.forEach(el => {
        const idx = parseInt(el.dataset.index, 10);
        const diff = Math.abs(idx - activeIndex);

        el.classList.remove('active', 'near-1', 'near-2', 'far');

        if (diff === 0) {
            el.classList.add('active');
        } else if (diff === 1) {
            el.classList.add('near-1');
        } else if (diff === 2) {
            el.classList.add('near-2');
        } else {
            el.classList.add('far');
        }
    });
}

function highlightCurrentLine(currentTime, shouldScroll = true) {
    if (currentTime === undefined || currentTime <= 0) return;

    let activeIndex = -1;

    for (let i = lyricsLines.length - 1; i >= 0; i--) {
        if (lyricsLines[i].time >= 0 && lyricsLines[i].time <= currentTime) {
            activeIndex = i;
            break;
        }
    }


    if (activeIndex === activeLineIndex) {
        if (shouldScroll && activeIndex >= 0) {
            const activeLine = document.querySelector(`#lyricsText .lyrics-line[data-index="${activeIndex}"]`);
            if (activeLine) {
                const container = document.getElementById('lyricsContent');
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const lineRect = activeLine.getBoundingClientRect();
                    const lineCenter = lineRect.top + lineRect.height / 2;
                    const containerCenter = containerRect.top + containerRect.height / 2;
                    const diff = Math.abs(lineCenter - containerCenter);
                    if (diff > containerRect.height * 0.3) {
                        const offset = lineRect.top - containerRect.top - (containerRect.height / 2) + (lineRect.height / 2);
                        container.scrollBy({ top: offset, behavior: 'smooth' });
                    }
                }
            }
        }
        return;
    }

    activeLineIndex = activeIndex;

    if (activeIndex < 0) {
        document.querySelectorAll('#lyricsText .lyrics-line[data-index]').forEach(el => {
            el.classList.remove('active', 'near-1', 'near-2');
            el.classList.add('far');
        });
        return;
    }

    applyLineClasses(activeIndex);

    if (shouldScroll) {
        const activeLine = document.querySelector(`#lyricsText .lyrics-line[data-index="${activeIndex}"]`);
        if (activeLine) {
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
                setTimeout(() => {
                    forceSyncLyrics(window.playerState?.currentTime || 0);
                }, 150);
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
                setTimeout(() => {
                    forceSyncLyrics(window.playerState?.currentTime || 0);
                }, 150);
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