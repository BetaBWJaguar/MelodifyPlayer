const { ipcRenderer } = require('electron');

let allPlaylists = [];
let searchTerm = '';
let currentEditingPlaylistId = null;
let currentViewingPlaylistId = null;
let draggedTrackId = null;
let draggedTrackElement = null;

async function initLibraryPage() {
    console.log('Initializing library page...');
    setupSearch();
    setupEditModal();
    setupDeleteModal();
    setupViewModal();
    await loadPlaylists();
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        clearSearchBtn.style.display = searchTerm.length > 0 ? 'flex' : 'none';
        applySearch();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        clearSearchBtn.style.display = 'none';
        applySearch();
    });
}

function applySearch() {
    let filteredPlaylists = [...allPlaylists];

    if (searchTerm) {
        filteredPlaylists = filteredPlaylists.filter(playlist =>
            playlist.name.toLowerCase().includes(searchTerm) ||
            (playlist.description && playlist.description.toLowerCase().includes(searchTerm))
        );
    }

    renderPlaylists(filteredPlaylists);
}

function renderPlaylists(playlists) {
    const libraryContent = document.getElementById('libraryContent');
    const lang = window.language || { t: (k) => k };

    if (!playlists || playlists.length === 0) {
        const emptyMessage = searchTerm
            ? lang.t('library.noResults')
            : lang.t('library.noPlaylists');
        
        libraryContent.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h2>${emptyMessage}</h2>
                <p>${searchTerm ? lang.t('library.tryDifferentSearch') : lang.t('library.startCreating')}</p>
            </div>
        `;
        return;
    }

    const playlistsHTML = `
        <div class="playlists-grid">
            ${playlists.map((playlist, index) => createPlaylistCard(playlist, index)).join('')}
        </div>
    `;

    libraryContent.innerHTML = playlistsHTML;

    const playlistCards = document.querySelectorAll('.playlist-card');
    playlistCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.edit-playlist-btn') ||
                e.target.closest('.delete-playlist-btn') ||
                e.target.closest('.play-overlay-btn')) {
                return;
            }
            const playlistId = card.dataset.playlistId;
            openViewModal(playlistId);
        });
    });

    const playButtons = document.querySelectorAll('.play-overlay-btn');
    playButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.playlist-card');
            const playlistId = card.dataset.playlistId;
            openViewModal(playlistId);
        });
    });

    const editButtons = document.querySelectorAll('.edit-playlist-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const playlistId = btn.dataset.playlistId;
            openEditModal(playlistId);
        });
    });

    const deleteButtons = document.querySelectorAll('.delete-playlist-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const playlistId = btn.dataset.playlistId;
            openDeleteModal(playlistId);
        });
    });
}

function createPlaylistCard(playlist, index) {
    const imageUrl = playlist.cover_image || '';
    const trackCount = playlist.song_count || 0;
    const lang = window.language || { t: (k) => k };

    if (imageUrl) {
        return `
            <div class="playlist-card"
                 data-playlist-id="${escapeHtml(playlist.id)}"
                 data-index="${index}">
                <div class="playlist-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(playlist.name)}" loading="lazy">
                    <div class="play-overlay">
                        <button class="play-overlay-btn" title="${lang.t('library.play')}">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="playlist-card-info">
                    <span class="playlist-card-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</span>
                    <span class="playlist-card-desc" title="${escapeHtml(playlist.description || '')}">${escapeHtml(playlist.description || '')}</span>
                    <span class="playlist-card-count">${trackCount} ${lang.t('library.tracks')}</span>
                </div>
                <div class="playlist-card-actions">
                    <button class="edit-playlist-btn" data-playlist-id="${escapeHtml(playlist.id)}" title="${lang.t('library.editPlaylist')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="delete-playlist-btn" data-playlist-id="${escapeHtml(playlist.id)}" title="${lang.t('library.deletePlaylist')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="playlist-card"
                 data-playlist-id="${escapeHtml(playlist.id)}"
                 data-index="${index}">
                <div class="playlist-card-image no-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <div class="play-overlay">
                        <button class="play-overlay-btn" title="${lang.t('library.play')}">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="playlist-card-info">
                    <span class="playlist-card-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</span>
                    <span class="playlist-card-desc" title="${escapeHtml(playlist.description || '')}">${escapeHtml(playlist.description || '')}</span>
                    <span class="playlist-card-count">${trackCount} ${lang.t('library.tracks')}</span>
                </div>
                <div class="playlist-card-actions">
                    <button class="edit-playlist-btn" data-playlist-id="${escapeHtml(playlist.id)}" title="${lang.t('library.editPlaylist')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="delete-playlist-btn" data-playlist-id="${escapeHtml(playlist.id)}" title="${lang.t('library.deletePlaylist')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
}

function setupEditModal() {
    const modal = document.getElementById('editPlaylistModal');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const saveBtn = document.getElementById('saveEditBtn');
    const nameInput = document.getElementById('playlistNameInput');
    const descInput = document.getElementById('playlistDescInput');
    const charCount = document.getElementById('descCharCount');

    closeBtn.addEventListener('click', closeEditModal);
    cancelBtn.addEventListener('click', closeEditModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditModal();
        }
    });

    descInput.addEventListener('input', () => {
        const length = descInput.value.length;
        charCount.textContent = length;
        if (length > 500) {
            charCount.style.color = '#ef4444';
        } else {
            charCount.style.color = '';
        }
    });

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        
        if (!name) {
            nameInput.style.borderColor = '#ef4444';
            return;
        }
        
        if (description.length > 500) {
            return;
        }
        
        try {
            await ipcRenderer.invoke('update-playlist', currentEditingPlaylistId, {
                name: name,
                description: description
            });
            closeEditModal();
            await loadPlaylists();
        } catch (error) {
            console.error('Error saving playlist:', error);
            alert('Error saving playlist: ' + error.message);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeEditModal();
        }
    });
}

function openEditModal(playlistId) {
    const modal = document.getElementById('editPlaylistModal');
    const nameInput = document.getElementById('playlistNameInput');
    const descInput = document.getElementById('playlistDescInput');
    const charCount = document.getElementById('descCharCount');
    const lang = window.language || { t: (k) => k };

    const playlist = allPlaylists.find(p => p.id == playlistId);
    if (!playlist) return;

    currentEditingPlaylistId = playlistId;
    nameInput.value = playlist.name || '';
    descInput.value = playlist.description || '';
    charCount.textContent = descInput.value.length;
    nameInput.style.borderColor = '';

    modal.classList.add('active');
    nameInput.focus();
}

function closeEditModal() {
    const modal = document.getElementById('editPlaylistModal');
    const nameInput = document.getElementById('playlistNameInput');
    const descInput = document.getElementById('playlistDescInput');
    
    modal.classList.remove('active');
    nameInput.value = '';
    descInput.value = '';
    currentEditingPlaylistId = null;
}

function setupDeleteModal() {
    const modal = document.getElementById('deleteModal');
    const closeBtn = document.getElementById('closeDeleteModal');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    closeBtn.addEventListener('click', closeDeleteModal);
    cancelBtn.addEventListener('click', closeDeleteModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDeleteModal();
        }
    });

    confirmBtn.addEventListener('click', async () => {
        try {
            await ipcRenderer.invoke('delete-playlist', currentEditingPlaylistId);
            closeDeleteModal();
            await loadPlaylists();
        } catch (error) {
            console.error('Error deleting playlist:', error);
            alert('Error deleting playlist: ' + error.message);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeDeleteModal();
        }
    });
}

function openDeleteModal(playlistId) {
    const modal = document.getElementById('deleteModal');
    const deleteMessage = document.getElementById('deleteMessage');
    const lang = window.language || { t: (k) => k };

    const playlist = allPlaylists.find(p => p.id == playlistId);
    if (!playlist) return;

    currentEditingPlaylistId = playlistId;
    deleteMessage.textContent = lang.t('library.deleteMessage').replace('{name}', playlist.name);

    modal.classList.add('active');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    
    modal.classList.remove('active');
    currentEditingPlaylistId = null;
}

function setupViewModal() {
    const modal = document.getElementById('playlistViewModal');
    const closeBtn = document.getElementById('closePlaylistViewModal');
    const closeViewBtn = document.getElementById('closePlaylistViewBtn');
    const playBtn = document.getElementById('playPlaylistBtn');

    closeBtn.addEventListener('click', closeViewModal);
    closeViewBtn.addEventListener('click', closeViewModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeViewModal();
        }
    });

    playBtn.addEventListener('click', async () => {
        try {
            const tracks = await ipcRenderer.invoke('get-playlist-songs', currentViewingPlaylistId);
            if (tracks && tracks.length > 0) {
                const firstTrack = tracks[0];
                playTrack(firstTrack.track_name, firstTrack.artist_name, firstTrack.image, firstTrack.track_id);
            }
        } catch (error) {
            console.error('Error playing playlist:', error);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeViewModal();
        }
    });
}

async function openViewModal(playlistId) {
    const modal = document.getElementById('playlistViewModal');
    const playlistViewImage = document.getElementById('playlistViewImage');
    const playlistViewName = document.getElementById('playlistViewName');
    const playlistViewDesc = document.getElementById('playlistViewDesc');
    const playlistViewCount = document.getElementById('playlistViewCount');
    const playlistTracksList = document.getElementById('playlistTracksList');
    const lang = window.language || { t: (k) => k };

    const playlist = allPlaylists.find(p => p.id == playlistId);
    if (!playlist) return;

    currentViewingPlaylistId = playlistId;
    playlistViewName.textContent = playlist.name;
    playlistViewDesc.textContent = playlist.description || '';
    playlistViewCount.textContent = `${playlist.song_count || 0} ${lang.t('library.tracks')}`;

    if (playlist.cover_image) {
        playlistViewImage.innerHTML = `<img src="${escapeHtml(playlist.cover_image)}" alt="">`;
        playlistViewImage.classList.remove('no-image');
    } else {
        playlistViewImage.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
        `;
        playlistViewImage.classList.add('no-image');
    }

    try {
        const tracks = await ipcRenderer.invoke('get-playlist-songs', playlistId);
        if (tracks && tracks.length > 0) {
            playlistTracksList.innerHTML = tracks.map(track => createPlaylistTrackItem(track)).join('');
            setupTrackDragAndDrop();
        } else {
            playlistTracksList.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <p>${lang.t('library.noTracks')}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading playlist tracks:', error);
        playlistTracksList.innerHTML = `
            <div class="error-state" style="padding: 40px 20px;">
                <p>Error loading tracks</p>
            </div>
        `;
    }

    modal.classList.add('active');
}

function closeViewModal() {
    const modal = document.getElementById('playlistViewModal');
    
    modal.classList.remove('active');
    currentViewingPlaylistId = null;
}

function createPlaylistTrackItem(track) {
    const imageUrl = track.image || '';
    const trackName = track.track_name || '';
    const artistName = track.artist_name || '';
    const lang = window.language || { t: (k) => k };

    if (imageUrl) {
        return `
            <div class="playlist-track-item" draggable="true" data-track-name="${escapeHtml(trackName)}" data-track-artist="${escapeHtml(artistName)}" data-track-image="${escapeHtml(imageUrl)}" data-track-id="${escapeHtml(track.track_id)}">
                <div class="playlist-track-drag-handle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                </div>
                <div class="playlist-track-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(trackName)}" loading="lazy">
                </div>
                <div class="playlist-track-info">
                    <span class="playlist-track-name" title="${escapeHtml(trackName)}">${escapeHtml(trackName)}</span>
                    <span class="playlist-track-artist" title="${escapeHtml(artistName)}">${escapeHtml(artistName)}</span>
                </div>
                <span class="playlist-track-duration">${track.duration ? formatDuration(track.duration) : ''}</span>
                <button class="playlist-track-remove-btn" title="${lang.t('library.removeTrack')}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        return `
            <div class="playlist-track-item" draggable="true" data-track-name="${escapeHtml(trackName)}" data-track-artist="${escapeHtml(artistName)}" data-track-image="" data-track-id="${escapeHtml(track.track_id)}">
                <div class="playlist-track-drag-handle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                </div>
                <div class="playlist-track-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <div class="playlist-track-info">
                    <span class="playlist-track-name" title="${escapeHtml(trackName)}">${escapeHtml(trackName)}</span>
                    <span class="playlist-track-artist" title="${escapeHtml(artistName)}">${escapeHtml(artistName)}</span>
                </div>
                <span class="playlist-track-duration">${track.duration ? formatDuration(track.duration) : ''}</span>
                <button class="playlist-track-remove-btn" title="${lang.t('library.removeTrack')}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `;
    }
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function setupTrackDragAndDrop() {
    const trackItems = document.querySelectorAll('.playlist-track-item');
    
    trackItems.forEach(item => {
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragend', handleDragEnd);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('drop', handleDrop);
        item.removeEventListener('dragleave', handleDragLeave);
        
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragleave', handleDragLeave);
        
        item.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-track-remove-btn') || e.target.closest('.playlist-track-drag-handle')) {
                return;
            }
            const trackName = item.dataset.trackName;
            const trackArtist = item.dataset.trackArtist;
            const trackImage = item.dataset.trackImage;
            const trackId = item.dataset.trackId;
            playTrack(trackName, trackArtist, trackImage, trackId);
        });
        
        const removeBtn = item.querySelector('.playlist-track-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const trackId = item.dataset.trackId;
                await removeTrackFromPlaylist(trackId);
            });
        }
    });
}

function handleDragStart(e) {
    draggedTrackElement = this;
    draggedTrackId = this.dataset.trackId;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTrackId);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.playlist-track-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedTrackElement = null;
    draggedTrackId = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedTrackElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.classList.remove('drag-over');
    
    if (draggedTrackId && this !== draggedTrackElement && currentViewingPlaylistId) {
        const targetTrackId = this.dataset.trackId;
        try {
            await ipcRenderer.invoke('reorder-playlist-songs', currentViewingPlaylistId, draggedTrackId, targetTrackId);
            await openViewModal(currentViewingPlaylistId);
        } catch (error) {
            console.error('Error reordering tracks:', error);
        }
    }
    
    return false;
}

async function removeTrackFromPlaylist(trackId) {
    if (!currentViewingPlaylistId) return;
    
    try {
        await ipcRenderer.invoke('remove-song-from-playlist', currentViewingPlaylistId, trackId);
        await openViewModal(currentViewingPlaylistId);
    } catch (error) {
        console.error('Error removing track from playlist:', error);
        alert('Error removing track: ' + error.message);
    }
}

async function addTrackToPlaylist(playlistId, track) {
    try {
        await ipcRenderer.invoke('add-song-to-playlist', playlistId, track);
        return true;
    } catch (error) {
        console.error('Error adding track to playlist:', error);
        return false;
    }
}

async function loadPlaylists() {
    const libraryContent = document.getElementById('libraryContent');
    const lang = window.language || { t: (k) => k };

    try {
        const playlists = await ipcRenderer.invoke('get-all-playlists');
        allPlaylists = playlists || [];
        applySearch();
    } catch (error) {
        console.error('Error loading playlists:', error);
        libraryContent.innerHTML = `
            <div class="error-state">
                <h3>${lang.t('library.error')}</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

function playTrack(trackName, artistName, image, trackId) {
    const track = {
        name: trackName,
        artist: artistName,
        image: image,
        id: trackId
    };

    ipcRenderer.send('request-play', track);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initLibraryPage as initLibraryPage, addTrackToPlaylist };
