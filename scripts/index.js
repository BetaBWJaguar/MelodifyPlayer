const language = require('../backend/utils/language');
window.language = language;

let playerState = {
    isPlaying: false,
    isPaused: false,
    currentTrack: null,
    duration: 0,
    currentTime: 0
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
