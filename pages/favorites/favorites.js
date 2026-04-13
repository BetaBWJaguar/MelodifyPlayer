const { ipcRenderer } = require('electron');

let isPlaying = false;
let currentEditingTrackId = null;
let draggedItem = null;
let allFavorites = [];
let currentFilter = 'all';
let searchTerm = '';

ipcRenderer.on("player-play", (event, data) => {
    isPlaying = true;
});

ipcRenderer.on("player-stop", (event, data) => {
    isPlaying = false;
});

ipcRenderer.on("player-error", (event, data) => {
    alert(`Playback error: ${data.error}`);
    isPlaying = false;
});

async function initFavoritesPage() {
    console.log('Initializing favorites page...');
    setupNotesModal();
    setupFilters();
    await loadFavorites();
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const filterNotesBtn = document.getElementById('filterNotesBtn');
    const filterAllBtn = document.getElementById('filterAllBtn');

    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        clearSearchBtn.style.display = searchTerm.length > 0 ? 'flex' : 'none';
        applyFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    filterNotesBtn.addEventListener('click', () => {
        currentFilter = 'notes';
        updateFilterButtons();
        applyFilters();
    });

    filterAllBtn.addEventListener('click', () => {
        currentFilter = 'all';
        updateFilterButtons();
        applyFilters();
    });

    updateFilterButtons();
}

function updateFilterButtons() {
    const filterNotesBtn = document.getElementById('filterNotesBtn');
    const filterAllBtn = document.getElementById('filterAllBtn');

    filterNotesBtn.classList.toggle('active', currentFilter === 'notes');
    filterAllBtn.classList.toggle('active', currentFilter === 'all');
}

function applyFilters() {
    let filteredSongs = [...allFavorites];

    if (searchTerm) {
        filteredSongs = filteredSongs.filter(song =>
            song.track_name.toLowerCase().includes(searchTerm) ||
            song.artist_name.toLowerCase().includes(searchTerm)
        );
    }

    if (currentFilter === 'notes') {
        filteredSongs = filteredSongs.filter(song => song.notes && song.notes.trim().length > 0);
    }

    renderFavorites(filteredSongs);
}

function renderFavorites(songs) {
    const favoritesContent = document.getElementById('favoritesContent');
    const lang = window.language || { t: (k) => k };

    if (!songs || songs.length === 0) {
        const emptyMessage = searchTerm || currentFilter === 'notes'
            ? lang.t('favorites.noResults')
            : lang.t('favorites.noFavorites');
        
        favoritesContent.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                <h2>${emptyMessage}</h2>
                <p>${searchTerm ? lang.t('favorites.tryDifferentSearch') : lang.t('favorites.startFavoriting')}</p>
            </div>
        `;
        return;
    }

    const songsHTML = `
        <div class="favorites-list" id="favoritesList">
            ${songs.map((song, index) => createTrackCard(song, index)).join('')}
        </div>
    `;

    favoritesContent.innerHTML = songsHTML;

    setupDragAndDrop();

    const trackCards = document.querySelectorAll('.track-card');
    trackCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.remove-favorite-btn') ||
                e.target.closest('.play-overlay-btn') ||
                e.target.closest('.notes-btn') ||
                e.target.closest('.drag-handle')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const trackName = card.dataset.trackName;
            const artistName = card.dataset.artistName;
            const image = card.dataset.image;
            const trackId = card.dataset.trackId;
            console.log('Track clicked:', trackName, artistName, image);
            playTrack(trackName, artistName, image, trackId);
        });
    });

    const playButtons = document.querySelectorAll('.play-overlay-btn');
    playButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.track-card');
            const trackName = card.dataset.trackName;
            const artistName = card.dataset.artistName;
            const image = card.dataset.image;
            const trackId = card.dataset.trackId;
            playTrack(trackName, artistName, image, trackId);
        });
    });

    const removeButtons = document.querySelectorAll('.remove-favorite-btn');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const trackId = btn.dataset.trackId;
            removeFavorite(trackId);
        });
    });

    const notesButtons = document.querySelectorAll('.notes-btn');
    notesButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.track-card');
            const track = {
                track_id: card.dataset.trackId,
                track_name: card.dataset.trackName,
                artist_name: card.dataset.artistName,
                image: card.dataset.image,
                notes: card.dataset.notes || ''
            };
            openNotesModal(track);
        });
    });
}

function setupNotesModal() {
    const modal = document.getElementById('notesModal');
    const closeBtn = document.getElementById('closeNotesModal');
    const cancelBtn = document.getElementById('cancelNotesBtn');
    const saveBtn = document.getElementById('saveNotesBtn');
    const notesInput = document.getElementById('notesInput');
    const charCount = document.getElementById('charCount');

    closeBtn.addEventListener('click', closeNotesModal);
    cancelBtn.addEventListener('click', closeNotesModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeNotesModal();
        }
    });

    notesInput.addEventListener('input', () => {
        const length = notesInput.value.length;
        charCount.textContent = length;
        if (length > 500) {
            charCount.style.color = '#ef4444';
        } else {
            charCount.style.color = '';
        }
    });

    saveBtn.addEventListener('click', async () => {
        const notes = notesInput.value.trim();
        if (notes.length > 500) {
            return;
        }
        
        try {
            await ipcRenderer.invoke('update-favorite-notes', currentEditingTrackId, notes);
            closeNotesModal();
            await loadFavorites();
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeNotesModal();
        }
    });
}

function openNotesModal(track) {
    const modal = document.getElementById('notesModal');
    const modalTrackName = document.getElementById('modalTrackName');
    const modalArtistName = document.getElementById('modalArtistName');
    const modalTrackImage = document.getElementById('modalTrackImage');
    const notesInput = document.getElementById('notesInput');
    const charCount = document.getElementById('charCount');

    currentEditingTrackId = track.track_id;
    modalTrackName.textContent = track.track_name;
    modalArtistName.textContent = track.artist_name;

    if (track.image) {
        modalTrackImage.innerHTML = `<img src="${escapeHtml(track.image)}" alt="">`;
    } else {
        modalTrackImage.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
        `;
    }

    notesInput.value = track.notes || '';
    charCount.textContent = notesInput.value.length;

    modal.classList.add('active');
    notesInput.focus();
}

function closeNotesModal() {
    const modal = document.getElementById('notesModal');
    const notesInput = document.getElementById('notesInput');
    
    modal.classList.remove('active');
    notesInput.value = '';
    currentEditingTrackId = null;
}

async function loadFavorites() {
    const favoritesContent = document.getElementById('favoritesContent');
    const lang = window.language || { t: (k) => k };

    try {
        const songs = await ipcRenderer.invoke('get-favorites');
        allFavorites = songs || [];
        applyFilters();
    } catch (error) {
        console.error('Error loading favorites:', error);
        favoritesContent.innerHTML = `
            <div class="error-state">
                <h3>${lang.t('favorites.error')}</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

function createTrackCard(song, index) {
    const imageUrl = song.image || '';
    const trackId = song.track_id;
    const notes = song.notes || '';
    const hasNotes = notes.length > 0;
    const lang = window.language || { t: (k) => k };

    if (imageUrl) {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(song.track_name)}"
                 data-artist-name="${escapeHtml(song.artist_name)}"
                 data-image="${escapeHtml(imageUrl)}"
                 data-track-id="${escapeHtml(trackId)}"
                 data-notes="${escapeHtml(notes)}"
                 data-index="${index}"
                 draggable="true">
                <div class="drag-handle" title="${lang.t('favorites.dragToReorder')}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                </div>
                <div class="track-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(song.track_name)}" loading="lazy">
                    <div class="play-overlay">
                        <button class="play-overlay-btn" data-play-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.play')}">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(song.track_name)}">${escapeHtml(song.track_name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(song.artist_name)}">${escapeHtml(song.artist_name)}</span>
                    ${hasNotes ? `<span class="track-card-notes-indicator" title="${escapeHtml(notes)}">📝</span>` : ''}
                </div>
                <div class="track-card-actions">
                    <button class="notes-btn ${hasNotes ? 'has-notes' : ''}" data-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.addNote')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="remove-favorite-btn" data-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.removeFromFavorites')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(song.track_name)}"
                 data-artist-name="${escapeHtml(song.artist_name)}"
                 data-image=""
                 data-track-id="${escapeHtml(trackId)}"
                 data-notes="${escapeHtml(notes)}"
                 data-index="${index}"
                 draggable="true">
                <div class="drag-handle" title="${lang.t('favorites.dragToReorder')}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                </div>
                <div class="track-card-image no-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <div class="play-overlay">
                        <button class="play-overlay-btn" data-play-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.play')}">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(song.track_name)}">${escapeHtml(song.track_name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(song.artist_name)}">${escapeHtml(song.artist_name)}</span>
                    ${hasNotes ? `<span class="track-card-notes-indicator" title="${escapeHtml(notes)}">📝</span>` : ''}
                </div>
                <div class="track-card-actions">
                    <button class="notes-btn ${hasNotes ? 'has-notes' : ''}" data-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.addNote')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="remove-favorite-btn" data-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.removeFromFavorites')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
}

function setupDragAndDrop() {
    const trackCards = document.querySelectorAll('.track-card');

    trackCards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedItem = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.trackId);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedItem = null;
            document.querySelectorAll('.track-card').forEach(c => c.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedItem && draggedItem !== card) {
                card.classList.add('drag-over');
            }
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');

            if (draggedItem && draggedItem !== card) {
                const draggedId = draggedItem.dataset.trackId;
                const targetId = card.dataset.trackId;

                try {
                    await ipcRenderer.invoke('reorder-favorites', draggedId, targetId);
                    await loadFavorites();
                } catch (error) {
                    console.error('Error reordering favorites:', error);
                }
            }
        });
    });
}

function playTrack(trackName, artistName, image, trackId) {
    const track = {
        name: trackName,
        artist: artistName,
        image: image,
        id: trackId
    };

    console.log('[Favorites] Requesting to play:', track);
    ipcRenderer.send('request-exit-playlist-mode');
    ipcRenderer.send('request-play', track);
}

async function removeFavorite(trackId) {
    try {
        ipcRenderer.send('request-unfavorite-song', trackId);
        await loadFavorites();
        
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn && playerState?.currentTrack) {
            const currentTrackId = playerState.currentTrack.id || playerState.currentTrack.videoId;
            if (currentTrackId === trackId) {
                favoriteBtn.classList.remove('active');
            }
        }
    } catch (error) {
        console.error('Error removing favorite:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initFavoritesPage as initFavoritesPage };
