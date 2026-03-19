const language = require('../backend/utils/language');
window.language = language;

let playerState = {
    isPlaying: false,
    isPaused: false,
    currentTrack: null,
    duration: 0,
    currentTime: 0,
    volume: 100,
    isMuted: false,
    previousVolume: 100,
    repeat: false
};

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


async function loadPage(page) {
    const pageContainer = document.getElementById("page-container");

    if (!pageContainer) {
        return;
    }

    try {
        const html = await fetch(`../pages/${page}/${page}.html`)
            .then(res => res.text());

        pageContainer.innerHTML = html;

        loadCSS(page);
        loadJS(page);
    } catch (error) {
        console.error(`error`);
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

    const module = await import(`../pages/${page}/${page}.js`);

    const initFunction = `init${capitalize(page)}Page`;

    if (module[initFunction]) {
        module[initFunction]();
    }

}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}


document.addEventListener('DOMContentLoaded', async () => {
    const { ipcRenderer } = require('electron');

    await language.init();
    language.updateUI();
    
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
        });
    });
    
    const originalLoadPage = loadPage;
    loadPage = async function(page) {
        await originalLoadPage(page);
        setTimeout(() => language.updateUI(), 50);
    };


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
    
    if (volumeSlider) {
        const updateVolumeFill = () => {
            const value = volumeSlider.value;
            const min = volumeSlider.min || 0;
            const max = volumeSlider.max || 100;
            const percentage = ((value - min) / (max - min)) * 100;
            volumeSlider.style.setProperty('--value', `${percentage}%`);
        };
        
        updateVolumeFill();
        
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            playerState.volume = volume;
            playerState.isMuted = volume === 0;
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
                playerState.previousVolume = playerState.volume;
                playerState.isMuted = true;
                playerState.volume = 0;
                if (volumeSlider) {
                    volumeSlider.value = 0;
                    updateVolumeFill();
                }
            }
            updateVolumeIcon();
            ipcRenderer.send('request-volume', playerState.volume);
        });
    }
    
    if (volumeBtn) {
        updateVolumeIcon();
    }

    const repeatBtn = document.getElementById('repeatBtn');
    const updateRepeatButton = () => {
        if (!repeatBtn) return;
        
        if (playerState.repeat) {
            repeatBtn.classList.add('active', 'repeat-one');
        } else {
            repeatBtn.classList.remove('active', 'repeat-one');
        }
    };
    
    if (repeatBtn) {
        repeatBtn.addEventListener('click', () => {
            playerState.repeat = !playerState.repeat;
            updateRepeatButton();
            ipcRenderer.send('request-repeat', playerState.repeat);
            console.log('Repeat mode:', playerState.repeat);
        });
        updateRepeatButton();
    }

    const progress = document.querySelector('.progress');
    if (progress) {
        progress.addEventListener('click', (e) => {
            if (playerState.duration <= 0) return;
            
            const rect = progress.getBoundingClientRect();
            const actualHeight = 4;
            const offsetY = (rect.height - actualHeight) / 2;
            const actualTop = rect.top + offsetY;
            
            const percent = (e.clientX - rect.left) / rect.width;
            
            const clampedPercent = Math.max(0, Math.min(1, percent));
            const seekTime = clampedPercent * playerState.duration;
            
            ipcRenderer.send('request-seek', seekTime);
        });
    }

    ipcRenderer.on('player-play', (event, data) => {
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
            }
            if (artistNameEl && data.artist) {
                artistNameEl.textContent = data.artist;
            }
            if (albumArtEl && data.gradient) {
                albumArtEl.className = `album-art ${data.gradient}`;
            }
            
            updatePlayButton();
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
                console.log('State after stop event:', playerState);
                updatePlayButton();
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
        
        updatePlayButton();
    });
