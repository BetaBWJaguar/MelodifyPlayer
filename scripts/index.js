const language = require('../backend/utils/language');
window.language = language;

let playerState = {
    isPlaying: false,
    isPaused: false,
    currentTrack: null
};


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
            const rect = progress.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const progressFill = progress.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = `${percent}%`;
            }
        });
    }

    ipcRenderer.on('player-play', (event, data) => {
            console.log('Player started:', data);
            playerState.isPlaying = true;
            playerState.isPaused = false;
            playerState.currentTrack = data;
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
