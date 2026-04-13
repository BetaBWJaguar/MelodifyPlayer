const { ipcRenderer } = require('electron');

let searchTimeout = null;
let isPlaying = false;
let currentSearchRequest = null;
let displayedTracks = [];
let selectedTrackForPlaylist = null;
let allPlaylists = [];

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

ipcRenderer.on("search-new-track-found", (event, track) => {
    addNewTrack(track);
});


function initSearchPage() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    const searchContent = document.getElementById('searchContent');
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');

    setupAddToPlaylistModal();
    loadPlaylists();

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
        }, 150);
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
            setTimeout(() => reject(new Error('Search timeout')), 120000)
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
        displayedTracks = [];
        return;
    }

    displayedTracks = [...tracks];

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
            if (e.target.closest('.add-to-playlist-btn')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const trackName = card.dataset.trackName;
            const artistName = card.dataset.artistName;
            const imageUrl = card.dataset.imageUrl;
            console.log('Track clicked:', trackName, artistName, imageUrl);
            playTrack(trackName, artistName, imageUrl);
        });
    });

    const addToPlaylistButtons = document.querySelectorAll('.add-to-playlist-btn');
    addToPlaylistButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const trackIndex = parseInt(btn.dataset.trackIndex);
            const track = displayedTracks[trackIndex];
            if (track) {
                openAddToPlaylistModal(track);
            }
        });
    });
}

function updateTrackWithVideo(updatedTrack) {
    const trackIndex = displayedTracks.findIndex(t =>
        t.name === updatedTrack.name && t.artist === updatedTrack.artist
    );
    
    if (trackIndex === -1) return;
    
    displayedTracks[trackIndex] = updatedTrack;
    
    const trackCards = document.querySelectorAll('.track-card');
    const card = trackCards[trackIndex];
    
    if (card) {
        const imageUrl = updatedTrack.image || '';
        const imageDiv = card.querySelector('.track-card-image');
        
        if (imageDiv) {
            if (imageUrl) {
                imageDiv.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(updatedTrack.name)}" loading="lazy">`;
                imageDiv.classList.remove('no-image');
            } else {
                imageDiv.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                `;
                imageDiv.classList.add('no-image');
            }
            
            card.dataset.imageUrl = escapeHtml(imageUrl);
        }
    }
}

function addNewTrack(track) {
    const exists = displayedTracks.some(t =>
        t.name === track.name && t.artist === track.artist
    );
    
    if (exists) {
        updateTrackWithVideo(track);
        return;
    }
    
    if (!track.youtube) return;
    
    displayedTracks.push(track);
    
    const searchResults = document.querySelector('.search-results');
    if (!searchResults) return;
    
    const cardHTML = createTrackCard(track, displayedTracks.length - 1);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHTML;
    const card = tempDiv.firstElementChild;
    
    card.style.animationDelay = '0s';
    
    card.addEventListener('click', (e) => {
        if (e.target.closest('.add-to-playlist-btn')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const trackName = card.dataset.trackName;
        const artistName = card.dataset.artistName;
        const imageUrl = card.dataset.imageUrl;
        console.log('Track clicked:', trackName, artistName, imageUrl);
        playTrack(trackName, artistName, imageUrl);
    });

    const addToPlaylistBtn = card.querySelector('.add-to-playlist-btn');
    if (addToPlaylistBtn) {
        addToPlaylistBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const track = displayedTracks[displayedTracks.length - 1];
            if (track) {
                openAddToPlaylistModal(track);
            }
        });
    }

    searchResults.appendChild(card);
}

function createTrackCard(track, index) {
    const imageUrl = track.image || '';
    const trackId = track.id || track.videoId || '';

    if (imageUrl) {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(track.name)}"
                 data-artist-name="${escapeHtml(track.artist)}"
                 data-image-url="${escapeHtml(imageUrl)}"
                 data-track-id="${escapeHtml(trackId)}"
                 data-index="${index}">
                <div class="track-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(track.name)}" loading="lazy">
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
                </div>
                <button class="add-to-playlist-btn" title="Add to playlist" data-track-index="${index}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(track.name)}"
                 data-artist-name="${escapeHtml(track.artist)}"
                 data-image-url=""
                 data-track-id="${escapeHtml(trackId)}"
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
                <button class="add-to-playlist-btn" title="Add to playlist" data-track-index="${index}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </button>
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
    ipcRenderer.send('request-exit-playlist-mode');
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

function setupAddToPlaylistModal() {
    const modal = document.getElementById('addToPlaylistModal');
    const closeBtn = document.getElementById('closeAddToPlaylistModal');
    const createNewPlaylistBtn = document.getElementById('createNewPlaylistBtn');

    closeBtn.addEventListener('click', closeAddToPlaylistModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAddToPlaylistModal();
        }
    });

    createNewPlaylistBtn.addEventListener('click', () => {
        closeAddToPlaylistModal();
        const createPlaylistBtn = document.querySelector('.create-playlist-btn');
        if (createPlaylistBtn) {
            createPlaylistBtn.click();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeAddToPlaylistModal();
        }
    });
}

function openAddToPlaylistModal(track) {
    const modal = document.getElementById('addToPlaylistModal');
    const selectedTrackImage = document.getElementById('selectedTrackImage');
    const selectedTrackName = document.getElementById('selectedTrackName');
    const selectedTrackArtist = document.getElementById('selectedTrackArtist');
    const playlistList = document.getElementById('playlistList');
    const noPlaylistsMessage = document.getElementById('noPlaylistsMessage');

    selectedTrackForPlaylist = track;

    const imageUrl = track.image || '';
    if (imageUrl) {
        selectedTrackImage.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="">`;
        selectedTrackImage.classList.remove('no-image');
    } else {
        selectedTrackImage.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
        `;
        selectedTrackImage.classList.add('no-image');
    }

    selectedTrackName.textContent = track.name;
    selectedTrackArtist.textContent = track.artist;

    if (allPlaylists && allPlaylists.length > 0) {
        playlistList.innerHTML = allPlaylists.map(playlist => createPlaylistItem(playlist)).join('');
        playlistList.style.display = 'block';
        noPlaylistsMessage.style.display = 'none';

        const playlistItems = document.querySelectorAll('.playlist-item');
        playlistItems.forEach(item => {
            item.addEventListener('click', async () => {
                const playlistId = item.dataset.playlistId;
                await addTrackToPlaylist(playlistId, selectedTrackForPlaylist);
                closeAddToPlaylistModal();
            });
        });
    } else {
        playlistList.style.display = 'none';
        noPlaylistsMessage.style.display = 'block';
    }

    modal.classList.add('active');
}

function closeAddToPlaylistModal() {
    const modal = document.getElementById('addToPlaylistModal');
    modal.classList.remove('active');
    selectedTrackForPlaylist = null;
}

function createPlaylistItem(playlist) {
    const imageUrl = playlist.cover_image || '';
    const trackCount = playlist.song_count || 0;
    const lang = window.language || { t: (k) => k };

    if (imageUrl) {
        return `
            <div class="playlist-item" data-playlist-id="${escapeHtml(playlist.id)}">
                <div class="playlist-item-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(playlist.name)}" loading="lazy">
                </div>
                <div class="playlist-item-info">
                    <span class="playlist-item-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</span>
                    <span class="playlist-item-count">${trackCount} ${lang.t('library.tracks')}</span>
                </div>
                <button class="add-to-playlist-confirm-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        return `
            <div class="playlist-item" data-playlist-id="${escapeHtml(playlist.id)}">
                <div class="playlist-item-image no-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <div class="playlist-item-info">
                    <span class="playlist-item-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</span>
                    <span class="playlist-item-count">${trackCount} ${lang.t('library.tracks')}</span>
                </div>
                <button class="add-to-playlist-confirm-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                </button>
            </div>
        `;
    }
}

async function loadPlaylists() {
    try {
        const playlists = await ipcRenderer.invoke('get-all-playlists');
        allPlaylists = playlists || [];
    } catch (error) {
        console.error('Error loading playlists:', error);
        allPlaylists = [];
    }
}

async function addTrackToPlaylist(playlistId, track) {
    try {
        const result = await ipcRenderer.invoke('add-song-to-playlist', playlistId, track);
        
        if (!result) {
            const lang = window.language || { t: (k) => k };
            const errorMessage = lang.t('search.alreadyInPlaylist');
            showNotification(errorMessage);
            return;
        }

        const lang = window.language || { t: (k) => k };
        const successMessage = lang.t('search.addedToPlaylist');
        showNotification(successMessage);
        
        await loadPlaylists();
    } catch (error) {
        console.error('Error adding track to playlist:', error);
        const lang = window.language || { t: (k) => k };
        const errorMessage = lang.t('search.errorAdding') || 'Error adding track to playlist';
        showNotification(errorMessage + ': ' + error.message);
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

export { initSearchPage };
