const language = require('../backend/utils/language');
window.language = language;

window.playerState = {
    isPlaying: false,
    isPaused: false,
    currentTrack: null,
    duration: 0,
    currentTime: 0,
    volume: 100,
    isMuted: false,
    previousVolume: 100,
    repeat: false,
    playlistRepeat: 'none', // 'none', 'all', 'one'
    shuffle: false,
    history: [],
    historyIndex: -1,
    playlistMode: false,
    currentPlaylistId: null,
    playlistName: null,
    playlistIndex: 0,
    totalTracks: 0
};
const playerState = window.playerState;

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgressBar() {
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const progressFill = document.getElementById('progressFill');
    
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(playerState.currentTime);
    }
    
    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(playerState.duration);
    }
    
    if (progressFill && playerState.duration > 0) {
        const percent = (playerState.currentTime / playerState.duration) * 100;
        progressFill.style.width = `${Math.min(percent, 100)}%`;
    }
}

let currentPageCleanup = null;


async function loadPage(page) {
    const pageContainer = document.getElementById("page-container");

    if (!pageContainer) return;

    if (currentPageCleanup) {
        try {
            currentPageCleanup();
        } catch (e) {
            console.error('Cleanup error:', e);
        }
        currentPageCleanup = null;
    }

    try {
        const html = await fetch(`../pages/${page}/${page}.html`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            });

        pageContainer.innerHTML = html;
        loadCSS(page);

        const module = await loadJS(page);

        if (module) {
            const pascalPage = toPascalCase(page);

            if (module.cleanupLyricsPage) {
                currentPageCleanup = module.cleanupLyricsPage;
            }

            if (module.cleanupSearchPage) {
                currentPageCleanup = module.cleanupSearchPage;
            }

            const cleanupName = `cleanup${pascalPage}Page`;
            if (module[cleanupName]) {
                currentPageCleanup = module[cleanupName];
            }
        }

    } catch (error) {
        console.error(`[LoadPage] Error loading ${page}:`, error);
        pageContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #888;">Error loading page: ${page}</div>`;
    }
}


function loadCSS(page) {
    const existing = document.getElementById("page-css");
    if (existing) existing.remove();

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `../pages/${page}/${page}.css`;
    link.id = "page-css";
    document.head.appendChild(link);
}

async function loadJS(page) {
    try {
        const module = await import(`../pages/${page}/${page}.js`);
        const initFunction = `init${toPascalCase(page)}Page`;


        if (module[initFunction]) {
            await module[initFunction]();
        } else {
            console.warn(`[LoadJS] ${initFunction} not found in module`);
        }

        return module;
    } catch (error) {
        console.error(`[LoadJS] Error loading ${page}.js:`, error);
        return null;
    }
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function toPascalCase(text) {
    return text.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}


document.addEventListener('DOMContentLoaded', async () => {
    const { ipcRenderer } = require('electron');
    window.ipcRenderer = ipcRenderer;

    await language.init();

    window.lyricsCache = {};

    function preFetchLyrics(trackName, artistName) {
        if (!trackName) return;

        const key = `${trackName.toLowerCase()}__${artistName?.toLowerCase()}`;
        if (window.lyricsCache[key]) return;

        let cleanName = trackName
            .replace(/\(.*?(feat|ft|featuring).*?\)/gi, '')
            .replace(/\[.*?(feat|ft|featuring).*?\]/gi, '')
            .replace(/official\s*(music\s*)?video/gi, '')
            .replace(/lyrics?\s*(video)?/gi, '')
            .replace(/\(.*?remaster.*?\)/gi, '')
            .replace(/\[.*?remaster.*?\]/gi, '')
            .trim();

        let cleanArtist = artistName ? artistName.replace(/\(.*?\)/g, '').trim() : '';
        const query = cleanArtist ? `${cleanName} ${cleanArtist}` : cleanName;

        fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        })
            .then(res => res.json())
            .then(results => {
                if (results && results.length > 0) {
                    let bestMatch = results.find(r => r.syncedLyrics && r.syncedLyrics.trim().length > 10);
                    if (!bestMatch) {
                        bestMatch = results.find(r => r.plainLyrics && r.plainLyrics.trim().length > 10);
                    }

                    if (bestMatch) {
                        window.lyricsCache[key] = {
                            synced: !!bestMatch.syncedLyrics,
                            text: bestMatch.syncedLyrics || bestMatch.plainLyrics
                        };
                    }
                }
            })
            .catch(err => console.log('[Prefetch] Lyrics background fetch failed'));
    }


    const originalLoadPage = loadPage;
    loadPage = async function(page) {
        await originalLoadPage(page);

        if (page === 'main-page') {
            if (typeof window.initMainPage === 'function') {
                window.initMainPage();
            }
        }

        setTimeout(() => language.updateUI(), 0);
    };

    await loadPage('main-page');


    const langEn = document.getElementById('langEn');
    const langTr = document.getElementById('langTr');
    if (langEn && langTr) {
        const currentLang = language.getCurrentLanguage();
        langEn.classList.toggle('active', currentLang === 'en');
        langTr.classList.toggle('active', currentLang === 'tr');
    }
    
    const startBtn = document.getElementById('startBtn');
    
    const closeBtn = document.getElementById('closeBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-close');
        });
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-minimize');
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-maximize');
        });
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {

        });
    }


    if (langEn) {
        langEn.addEventListener('click', async () => {
            await language.setLanguage('en');
            langEn.classList.add('active');
            if (langTr) langTr.classList.remove('active');
        });
    }
    
    if (langTr) {
        langTr.addEventListener('click', async () => {
            await language.setLanguage('tr');
            langTr.classList.add('active');
            if (langEn) langEn.classList.remove('active');
        });
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const page = item.dataset.page;
            loadPage(page);
            
            const sidebar = document.querySelector('.sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    });

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function toggleMobileMenu(show) {
        if (show === undefined) {
            sidebar?.classList.toggle('active');
            sidebarOverlay?.classList.toggle('active');
        } else if (show) {
            sidebar?.classList.add('active');
            sidebarOverlay?.classList.add('active');
        } else {
            sidebar?.classList.remove('active');
            sidebarOverlay?.classList.remove('active');
        }
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            toggleMobileMenu();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            toggleMobileMenu(false);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleMobileMenu(false);
        }

        if (e.key === 'MediaPlayPause') {
            e.preventDefault();
            if (playerState.isPlaying && !playerState.isPaused) {
                ipcRenderer.send('request-pause');
            } else if (playerState.isPaused) {
                ipcRenderer.send('request-resume');
            }
        }

        if (e.key === 'MediaStop') {
            e.preventDefault();
            ipcRenderer.send('request-stop');
        }

        if (e.key === 'MediaTrackNext') {
            e.preventDefault();
            ipcRenderer.send('request-next');
        }

        if (e.key === 'MediaTrackPrevious') {
            e.preventDefault();
            ipcRenderer.send('request-previous');
        }

        if (e.key === ' ' && !e.target.closest('input, textarea, [contenteditable]')) {
            e.preventDefault();
            if (playerState.isPlaying && !playerState.isPaused) {
                ipcRenderer.send('request-pause');
            } else if (playerState.isPaused) {
                ipcRenderer.send('request-resume');
            }
        }
    });



    const playlistCards = document.querySelectorAll('.playlist-card');
    playlistCards.forEach(card => {
        card.addEventListener('click', () => {
        });
    });

    const playBtn = document.querySelector('.play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            console.log('Play button clicked. Current state:', playerState);
            
            if (playerState.isPlaying && !playerState.isPaused) {
                console.log('Sending request-pause');
                ipcRenderer.send('request-pause');
            } else if (playerState.isPaused) {
                console.log('Sending request-resume');
                ipcRenderer.send('request-resume');
            } else {
                console.log('No action - not playing and not paused');
            }
        });
    }

    const volumeSlider = document.getElementById('volumeSlider');
    const volumeBtn = document.getElementById('volumeBtn');
    
    const updateVolumeIcon = () => {
        if (!volumeBtn) return;
        
        let iconPath;
        if (playerState.isMuted || playerState.volume === 0) {
            iconPath = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
        } else if (playerState.volume < 50) {
            iconPath = 'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z';
        } else {
            iconPath = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
        }
        
        volumeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="${iconPath}"/></svg>`;
    };
    
    const updateVolumeFill = () => {
        if (!volumeSlider) return;
        const value = volumeSlider.value;
        const min = volumeSlider.min || 0;
        const max = volumeSlider.max || 100;
        const percentage = ((value - min) / (max - min)) * 100;
        volumeSlider.style.setProperty('--value', `${percentage}%`);
    };
    
    updateVolumeFill();
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            playerState.volume = volume;
            playerState.isMuted = volume === 0;
            if (!playerState.isMuted && volume > 0) {
                playerState.previousVolume = volume;
            }
            console.log('Volume changed to:', volume);
            updateVolumeFill();
            updateVolumeIcon();
            ipcRenderer.send('request-volume', volume);
        });
    }
    
    if (volumeBtn) {
        volumeBtn.addEventListener('click', () => {
            if (playerState.isMuted) {
                playerState.isMuted = false;
                playerState.volume = playerState.previousVolume || 100;
                if (volumeSlider) {
                    volumeSlider.value = playerState.volume;
                    updateVolumeFill();
                }
            } else {
                if (playerState.volume > 0) {
                    playerState.previousVolume = playerState.volume;
                }
                playerState.isMuted = true;
                playerState.volume = 0;
                if (volumeSlider) {
                    volumeSlider.value = 0;
                    updateVolumeFill();
                }
            }
            updateVolumeIcon();
            console.log('Volume button clicked - Volume:', playerState.volume, 'Muted:', playerState.isMuted);
            ipcRenderer.send('request-volume', playerState.volume);
        });
    }
    
    if (volumeBtn) {
        updateVolumeIcon();
    }

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
        });
    }

    const lyricsBtn = document.getElementById('lyricsBtn');
    if (lyricsBtn) {
        lyricsBtn.addEventListener('click', () => {
            loadPage('lyrics');
        });
    }

    const repeatBtn = document.getElementById('repeatBtn');
    const updateRepeatButton = () => {
        if (!repeatBtn) return;
        
        repeatBtn.classList.remove('active', 'repeat-one', 'repeat-all');
        
        if (playerState.playlistMode) {
            if (playerState.playlistRepeat === 'all') {
                repeatBtn.classList.add('active', 'repeat-all');
            } else if (playerState.playlistRepeat === 'one') {
                repeatBtn.classList.add('active', 'repeat-one');
            }
        } else {
            if (playerState.repeat) {
                repeatBtn.classList.add('active', 'repeat-one');
            }
        }
    };
    
    if (repeatBtn) {
        repeatBtn.addEventListener('click', () => {
            if (playerState.playlistMode) {
                const modes = ['none', 'all', 'one'];
                const currentIndex = modes.indexOf(playerState.playlistRepeat);
                playerState.playlistRepeat = modes[(currentIndex + 1) % modes.length];
                updateRepeatButton();
                ipcRenderer.send('request-playlist-repeat', playerState.playlistRepeat);
                console.log('Playlist repeat mode:', playerState.playlistRepeat);
            } else {
                playerState.repeat = !playerState.repeat;
                updateRepeatButton();
                ipcRenderer.send('request-repeat', playerState.repeat);
                console.log('Repeat mode:', playerState.repeat);
            }
        });
        updateRepeatButton();
    }

    const shuffleBtn = document.getElementById('shuffleBtn');
    const updateShuffleButton = () => {
        if (!shuffleBtn) return;
        
        if (playerState.shuffle) {
            shuffleBtn.classList.add('active');
        } else {
            shuffleBtn.classList.remove('active');
        }
    };
    
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            playerState.shuffle = !playerState.shuffle;
            updateShuffleButton();
            ipcRenderer.send('request-shuffle', playerState.shuffle);
            console.log('Shuffle mode:', playerState.shuffle);
        });
        updateShuffleButton();
    }

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (playerState.playlistMode || playerState.historyIndex > 0) {
                ipcRenderer.send('request-previous');
            } else {
                console.log('No previous tracks');
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            ipcRenderer.send('request-next');
        });
    }

    const likeBtn = document.getElementById('likeBtn');
    const updateLikeButton = async () => {
        if (!likeBtn) return;
        
        const trackId = playerState.currentTrack?.id || playerState.currentTrack?.videoId;
        if (trackId) {
            const isLiked = await ipcRenderer.invoke('check-is-liked', trackId);
            if (isLiked) {
                likeBtn.classList.add('active');
            } else {
                likeBtn.classList.remove('active');
            }
        } else {
            likeBtn.classList.remove('active');
        }
    };
    
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            const trackId = playerState.currentTrack?.id || playerState.currentTrack?.videoId;
            if (!trackId) return;
            
            const isLiked = await ipcRenderer.invoke('check-is-liked', trackId);
            
            if (isLiked) {
                ipcRenderer.send('request-unlike-song', trackId);
                console.log('Removed from liked:', trackId);
            } else {
                ipcRenderer.send('request-like-song', playerState.currentTrack);
                console.log('Added to liked:', trackId);
            }
            await updateLikeButton();
        });
        updateLikeButton();
    }

    const favoriteBtn = document.getElementById('favoriteBtn');
    const updateFavoriteButton = async () => {
        if (!favoriteBtn) return;
        
        const trackId = playerState.currentTrack?.id || playerState.currentTrack?.videoId;
        if (trackId) {
            const isFavorite = await ipcRenderer.invoke('check-is-favorite', trackId);
            if (isFavorite) {
                favoriteBtn.classList.add('active');
            } else {
                favoriteBtn.classList.remove('active');
            }
        } else {
            favoriteBtn.classList.remove('active');
        }
    };
    
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async () => {
            const trackId = playerState.currentTrack?.id || playerState.currentTrack?.videoId;
            if (!trackId) return;
            
            const isFavorite = await ipcRenderer.invoke('check-is-favorite', trackId);
            
            if (isFavorite) {
                ipcRenderer.send('request-unfavorite-song', trackId);
                console.log('Removed from favorites:', trackId);
            } else {
                ipcRenderer.send('request-favorite-song', playerState.currentTrack);
                console.log('Added to favorites:', trackId);
            }
            await updateFavoriteButton();
        });
        updateFavoriteButton();
    }

    const progress = document.querySelector('.progress');
    if (progress) {
        const handleProgressInteraction = (clientX) => {
            if (playerState.duration <= 0) return;
            
            const rect = progress.getBoundingClientRect();
            const percent = (clientX - rect.left) / rect.width;
            
            const clampedPercent = Math.max(0, Math.min(1, percent));
            const seekTime = clampedPercent * playerState.duration;
            
            ipcRenderer.send('request-seek', seekTime);
        };

        progress.addEventListener('click', (e) => {
            handleProgressInteraction(e.clientX);
        });

        progress.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });

        progress.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            handleProgressInteraction(touch.clientX);
        }, { passive: false });
    }

    ipcRenderer.on('player-play', async (event, data) => {
        console.log('Player started:', data);
        playerState.isPlaying = true;
        playerState.isPaused = false;
        playerState.currentTrack = data;
        playerState.duration = data.actualDuration !== undefined && data.actualDuration !== null
            ? data.actualDuration
            : (data.duration || 0);


        const trackNameEl = document.getElementById('trackName');
        const artistNameEl = document.getElementById('artistName');
        const albumArtEl = document.getElementById('albumArt');

        if (trackNameEl && data.name) {
            trackNameEl.textContent = data.name;
            trackNameEl.removeAttribute('data-i18n');
        }
        if (artistNameEl && data.artist) {
            artistNameEl.textContent = data.artist;
            artistNameEl.removeAttribute('data-i18n');
        }
        if (albumArtEl) {
            albumArtEl.classList.remove('gradient-1', 'gradient-2', 'gradient-3', 'gradient-4');

            if (data.image) {
                albumArtEl.style.backgroundImage = `url(${data.image})`;
                albumArtEl.style.backgroundSize = 'cover';
                albumArtEl.style.backgroundPosition = 'center';
            } else {
                const gradientOptions = ['gradient-1', 'gradient-2', 'gradient-3', 'gradient-4'];
                const randomGradient = gradientOptions[Math.floor(Math.random() * gradientOptions.length)];
                albumArtEl.classList.add(randomGradient);
                albumArtEl.style.backgroundImage = '';
            }
        }

        updatePlayButton();
        await updateLikeButton();
        await updateFavoriteButton();
        updatePrevButton();

        preFetchLyrics(data.name, data.artist);
    });
        
        ipcRenderer.on('player-pause', (event, data) => {
                console.log('Player paused event received:', data);
                playerState.isPaused = true;
                playerState.isPlaying = false;
                console.log('State after pause event:', playerState);
                updatePlayButton();
            });
            
            ipcRenderer.on('player-resume', (event, data) => {
                console.log('Player resumed event received:', data);
                playerState.isPaused = false;
                playerState.isPlaying = true;
                console.log('State after resume event:', playerState);
                updatePlayButton();
            });
            
            ipcRenderer.on('player-stop', (event, data) => {
                    console.log('Player stopped event received:', data);
                    playerState.isPlaying = false;
                    playerState.isPaused = false;
                    playerState.currentTrack = null;
                    updatePlayButton();
                    updateLikeButton();
                    updateFavoriteButton();
                });
    
            ipcRenderer.on('player-history-updated', (event, data) => {
                playerState.history = data.history || [];
                playerState.historyIndex = data.currentIndex !== undefined ? data.currentIndex : -1;
                updatePrevButton();
                updateHistoryButton();
                updateHistoryList();
            });
        
        ipcRenderer.on('player-error', (event, data) => {
            console.error('Player error:', data);
            playerState.isPlaying = false;
            playerState.isPaused = false;
            updatePlayButton();
        });
        
        ipcRenderer.on('player-progress', (event, data) => {
            console.log('Progress update:', data);
            playerState.currentTime = data.currentTime || 0;
            playerState.duration = data.duration || playerState.duration;
            updateProgressBar();
        });
        
        ipcRenderer.on('player-playlist-updated', (event, data) => {
            console.log('Playlist status updated:', data);
            playerState.playlistMode = data.playlistMode || false;
            playerState.currentPlaylistId = data.currentPlaylistId || null;
            playerState.playlistName = data.playlistName || null;
            playerState.playlistIndex = data.playlistIndex || 0;
            playerState.totalTracks = data.totalTracks || 0;
            if (data.playlistRepeat) {
                playerState.playlistRepeat = data.playlistRepeat;
            }
            updatePlaylistInfo();
            updatePrevButton();
            updateRepeatButton();
        });
        
        function updatePrevButton() {
            const prevBtn = document.getElementById('prevBtn');
            if (prevBtn) {
                const canGoPrevious = playerState.playlistMode || playerState.historyIndex > 0;
                if (canGoPrevious) {
                    prevBtn.style.opacity = '1';
                    prevBtn.style.pointerEvents = 'auto';
                } else {
                    prevBtn.style.opacity = '0.5';
                    prevBtn.style.pointerEvents = 'none';
                }
            }
        }

        function updatePlayButton() {
            const playBtn = document.querySelector('.play-btn');
            if (playBtn) {
                if (playerState.isPaused) {
                    playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                } else if (playerState.isPlaying) {
                    playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                } else {
                    playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                }
            }
        }

        function updateHistoryButton() {
            const historyBtn = document.getElementById('historyBtn');
            if (historyBtn) {
                if (playerState.history.length > 0) {
                    historyBtn.classList.add('has-history');
                } else {
                    historyBtn.classList.remove('has-history');
                }
            }
        }

        function updatePlaylistInfo() {
            const playlistInfo = document.getElementById('playlistInfo');
            const playlistNameEl = document.getElementById('playlistName');
            const playlistPositionEl = document.getElementById('playlistPosition');
            
            if (playerState.playlistMode && playerState.playlistName) {
                if (playlistInfo) {
                    playlistInfo.style.display = 'flex';
                }
                if (playlistNameEl) {
                    playlistNameEl.textContent = playerState.playlistName;
                }
                if (playlistPositionEl) {
                    const currentIndex = playerState.playlistIndex + 1;
                    const total = playerState.totalTracks;
                    playlistPositionEl.textContent = `${currentIndex}/${total}`;
                }
            } else {
                if (playlistInfo) {
                    playlistInfo.style.display = 'none';
                }
            }
        }

        function updateHistoryList() {
            const historyList = document.getElementById('historyList');
            if (!historyList) return;

            if (playerState.history.length === 0) {
                const emptyText = language.getTranslation('history.empty');
                historyList.innerHTML = `<div class="history-empty">${emptyText}</div>`;
                return;
            }

            historyList.innerHTML = '';
            
            playerState.history.forEach((track, index) => {
                const isCurrent = index === playerState.historyIndex;
                const item = document.createElement('div');
                item.className = `history-item ${isCurrent ? 'current' : ''}`;
                
                const art = document.createElement('div');
                art.className = 'history-item-art';
                const imageUrl = track.image || track.thumbnail;
                if (imageUrl) {
                    art.style.backgroundImage = `url(${imageUrl})`;
                } else {
                    const gradientOptions = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                              'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                              'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                              'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'];
                    const randomGradient = gradientOptions[Math.floor(Math.random() * gradientOptions.length)];
                    art.style.background = randomGradient;
                }
                
                const info = document.createElement('div');
                info.className = 'history-item-info';
                
                const name = document.createElement('div');
                name.className = 'history-item-name';
                name.textContent = track.name || 'Unknown Track';
                
                const artist = document.createElement('div');
                artist.className = 'history-item-artist';
                artist.textContent = track.artist || 'Unknown Artist';
                
                info.appendChild(name);
                info.appendChild(artist);
                
                item.appendChild(art);
                item.appendChild(info);
                
                item.addEventListener('click', () => {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('request-play-history', index);
                    toggleHistoryDropdown(false);
                });
                
                historyList.appendChild(item);
            });
        }

        function toggleHistoryDropdown(show) {
            const dropdown = document.getElementById('historyDropdown');
            if (dropdown) {
                if (show === undefined) {
                    dropdown.classList.toggle('show');
                } else if (show) {
                    dropdown.classList.add('show');
                } else {
                    dropdown.classList.remove('show');
                }
            }
        }

        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHistoryDropdown();
            });
        }

        const historyClose = document.getElementById('historyClose');
        if (historyClose) {
            historyClose.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHistoryDropdown(false);
            });
        }

        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('historyDropdown');
            const historyBtn = document.getElementById('historyBtn');
            if (dropdown && historyBtn && !dropdown.contains(e.target) && !historyBtn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        updatePlayButton();
        updateHistoryButton();
        updateHistoryList();
    });
