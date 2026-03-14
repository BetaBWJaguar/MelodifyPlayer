const { ipcRenderer } = require('electron');

let searchTimeout = null;
let isPlaying = false;
let currentSearchRequest = null;

ipcRenderer.on("player-play", (event, data) => {
    isPlaying = true;
    updatePlayerUI(data);
});

ipcRenderer.on("player-stop", (event, data) => {
    isPlaying = false;
});

ipcRenderer.on("player-error", (event, data) => {
    alert(`Playback error: ${data.error}`);
    isPlaying = false;
});


function initSearchPage() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    const searchContent = document.getElementById('searchContent');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');

    searchInput.focus();

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        clearBtn.style.display = query ? 'flex' : 'none';

        clearTimeout(searchTimeout);

        if (currentSearchRequest) {
            currentSearchRequest = null;
        }

        if (query.length === 0) {
            showEmptyState();
            return;
        }

        if (query.length < 2) {
            return;
        }

        loadingState.style.display = 'flex';
        searchContent.style.display = 'none';

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        showEmptyState();
        searchInput.focus();
        
        if (currentSearchRequest) {
            currentSearchRequest = null;
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                loadingState.style.display = 'flex';
                searchContent.style.display = 'none';
                performSearch(query);
            }
        }
    });
}

async function performSearch(query) {
    const requestId = Date.now();
    currentSearchRequest = requestId;

    try {
        const searchPromise = ipcRenderer.invoke('search-track', query);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Search timeout')), 15000)
        );

        const tracks = await Promise.race([searchPromise, timeoutPromise]);

        if (currentSearchRequest === requestId) {
            displayResults(tracks);
        }
    } catch (error) {
        console.error('Search error:', error);
        
        if (currentSearchRequest === requestId) {
            showErrorState(error.message);
        }
    } finally {
        if (currentSearchRequest === requestId) {
            currentSearchRequest = null;
        }
    }
}

function displayResults(tracks) {
    const searchContent = document.getElementById('searchContent');
    const loadingState = document.getElementById('loadingState');

    loadingState.style.display = 'none';
    searchContent.style.display = 'block';

    if (!tracks || tracks.length === 0) {
        const lang = window.language || { t: (k) => k };
        searchContent.innerHTML = `
            <div class="no-results">
                <h3 data-i18n="search.noResults">${lang.t('search.noResults')}</h3>
                <p data-i18n="search.tryDifferent">${lang.t('search.tryDifferent')}</p>
            </div>
        `;
        return;
    }

    const resultsHTML = `
        <div class="search-results">
            ${tracks.map((track, index) => createTrackCard(track, index)).join('')}
        </div>
    `;

    searchContent.innerHTML = resultsHTML;

    const trackCards = document.querySelectorAll('.track-card');
    trackCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;

        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const trackName = card.dataset.trackName;
            const artistName = card.dataset.artistName;
            const imageUrl = card.dataset.imageUrl;
            console.log('Track clicked:', trackName, artistName, imageUrl);
            playTrack(trackName, artistName, imageUrl);
        });
    });
}

function createTrackCard(track, index) {
    const imageUrl = track.image || '';

    if (imageUrl) {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(track.name)}"
                 data-artist-name="${escapeHtml(track.artist)}"
                 data-image-url="${escapeHtml(imageUrl)}"
                 data-index="${index}">
                <div class="track-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(track.name)}" loading="lazy">
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(track.name)}"
                 data-artist-name="${escapeHtml(track.artist)}"
                 data-image-url=""
                 data-index="${index}">
                <div class="track-card-image no-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
                </div>
            </div>
        `;
    }
}

function showEmptyState() {
    const searchContent = document.getElementById('searchContent');
    const loadingState = document.getElementById('loadingState');
    const lang = window.language || { t: (k) => k };

    loadingState.style.display = 'none';
    searchContent.style.display = 'block';
    searchContent.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <h2 data-i18n="search.startSearching">${lang.t('search.startSearching')}</h2>
            <p data-i18n="search.findFavorites">${lang.t('search.findFavorites')}</p>
        </div>
    `;
}

function showErrorState(errorMessage = '') {
    const searchContent = document.getElementById('searchContent');
    const loadingState = document.getElementById('loadingState');
    const lang = window.language || { t: (k) => k };

    loadingState.style.display = 'none';
    searchContent.style.display = 'block';
    
    const isTimeout = errorMessage.includes('timeout');
    const errorTitle = isTimeout ? lang.t('search.timeout') : lang.t('search.somethingWentWrong');
    const errorDesc = isTimeout 
        ? (lang.t('search.timeoutMessage'))
        : (lang.t('search.unableToFetch'));

    searchContent.innerHTML = `
        <div class="error-state">
            <h3>${escapeHtml(errorTitle)}</h3>
            <p>${escapeHtml(errorDesc)}</p>
            <button class="btn btn-primary" onclick="location.reload()">${lang.t('search.tryAgain')}</button>
        </div>
    `;
}

function playTrack(trackName, artistName, imageUrl) {
    const track = {
        name: trackName,
        artist: artistName,
        image: imageUrl
    };

    console.log('[Search] Requesting to play:', track);
    ipcRenderer.send('request-play', track);
}

function updatePlayerUI(track) {
    const trackInfoElement = document.querySelector('.track-info');
    const albumArtElement = document.querySelector('.album-art');

    if (trackInfoElement) {
        const trackNameElement = trackInfoElement.querySelector('.track-name');
        const artistNameElement = trackInfoElement.querySelector('.artist-name');

        if (trackNameElement) {
            trackNameElement.textContent = track.name;
            trackNameElement.removeAttribute('data-i18n');
        }
        if (artistNameElement) {
            artistNameElement.textContent = track.artist;
            artistNameElement.removeAttribute('data-i18n');
        }
    }

    if (albumArtElement) {
        albumArtElement.classList.remove('gradient-1', 'gradient-2', 'gradient-3', 'gradient-4');

        if (track.image) {
            albumArtElement.style.backgroundImage = `url(${track.image})`;
            albumArtElement.style.backgroundSize = 'cover';
            albumArtElement.style.backgroundPosition = 'center';
        } else {
            const gradients = ['gradient-1', 'gradient-2', 'gradient-3', 'gradient-4'];
            const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
            albumArtElement.classList.add(randomGradient);
            albumArtElement.style.backgroundImage = '';
        }
    }

    console.log(`Playing: ${track.name} by ${track.artist}`);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initSearchPage };
