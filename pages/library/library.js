const { ipcRenderer } = require('electron');

let allPlaylists = [];
let searchTerm = '';
let currentEditingPlaylistId = null;
let currentViewingPlaylistId = null;
let draggedTrackId = null;
let draggedTrackElement = null;
let selectedTrackIds = new Set();
let downloadingTracks = new Map();
let currentPlaylistTracks = [];

ipcRenderer.on("download-progress", (event, data) => {
    const trackId = data.track.id || data.track.videoId;
    if (trackId) {
        downloadingTracks.set(trackId, data.percent);
        updateDownloadButton(trackId, data.percent);
    }
});

ipcRenderer.on("download-complete", (event, data) => {
    const trackId = data.track.id || data.track.videoId;
    if (trackId) {
        downloadingTracks.delete(trackId);
        updateDownloadButton(trackId, 'complete');
        const lang = window.language || { t: (k) => k };
        showNotification(lang.t('download.downloadComplete'));
    }
});

ipcRenderer.on("download-error", (event, data) => {
    const trackId = data.track.id || data.track.videoId;
    if (trackId) {
        downloadingTracks.delete(trackId);
        updateDownloadButton(trackId, 'error');
        const lang = window.language || { t: (k) => k };
        showNotification(`${lang.t('download.downloadError')}: ${data.error}`);
    }
});

async function initLibraryPage() {
    console.log('Initializing library page...');
    setupSearch();
    setupEditModal();
    setupDeleteModal();
    setupViewModal();
    setupMoveModal();
    setupCopyModal();
    await loadPlaylists();
    
    if (window.language && typeof window.language.onLanguageChange === 'function') {
        window.language.onLanguageChange(() => {
            applySearch();
            if (currentViewingPlaylistId) {
                updateViewModalLanguage();
            }
        });
    }
    
    if (window.pendingPlaylistId) {
        const playlistId = window.pendingPlaylistId;
        window.pendingPlaylistId = null;
        setTimeout(() => openViewModal(playlistId), 100);
    }
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
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.playlist-card');
            const playlistId = card.dataset.playlistId;
            const playlist = allPlaylists.find(p => p.id == playlistId);
            
            try {
                const tracks = await ipcRenderer.invoke('get-playlist-songs', playlistId);
                if (tracks && tracks.length > 0) {
                    ipcRenderer.send('request-play-playlist', playlistId, playlist?.name || '', tracks, 0);
                }
            } catch (error) {
                console.error('Error playing playlist:', error);
            }
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
            const lang = window.language || { t: (k) => k };
            showNotification(`${lang.t('library.errorSaving')}: ${error.message}`);
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
            const lang = window.language || { t: (k) => k };
            showNotification(`${lang.t('library.errorDeleting')}: ${error.message}`);
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
    const selectAllCheckbox = document.getElementById('selectAllTracks');
    const removeSelectedBtn = document.getElementById('removeSelectedBtn');
    const moveSelectedBtn = document.getElementById('moveSelectedBtn');
    const copySelectedBtn = document.getElementById('copySelectedBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');

    closeBtn.addEventListener('click', closeViewModal);
    closeViewBtn.addEventListener('click', closeViewModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeViewModal();
        }
    });

    playBtn.addEventListener('click', async () => {
        const playlist = allPlaylists.find(p => p.id == currentViewingPlaylistId);
        try {
            const tracks = await ipcRenderer.invoke('get-playlist-songs', currentViewingPlaylistId);
            if (tracks && tracks.length > 0) {
                ipcRenderer.send('request-play-playlist', currentViewingPlaylistId, playlist?.name || '', tracks, 0);
            }
        } catch (error) {
            console.error('Error playing playlist:', error);
        }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const trackCheckboxes = document.querySelectorAll('.track-checkbox');
        trackCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const trackId = checkbox.closest('.playlist-track-item').dataset.trackId;
            if (isChecked) {
                selectedTrackIds.add(trackId);
            } else {
                selectedTrackIds.delete(trackId);
            }
        });
        updateBulkActionsVisibility();
    });

    moveSelectedBtn.addEventListener('click', () => {
        openMoveModal();
    });

    copySelectedBtn.addEventListener('click', () => {
        openCopyModal();
    });

    downloadSelectedBtn.addEventListener('click', async () => {
        if (selectedTrackIds.size === 0) return;
        
        const lang = window.language || { t: (k) => k };
        
        try {
            const tracks = await ipcRenderer.invoke('get-playlist-songs', currentViewingPlaylistId);
            const tracksToDownload = tracks.filter(t => selectedTrackIds.has(t.track_id));
            

            for (const track of tracksToDownload) {
                const trackId = track.track_id;
                if (!downloadingTracks.has(trackId)) {
                    console.log('[Library] Starting download for:', track.track_name, 'by', track.artist_name);
                    downloadTrack({
                        name: track.track_name,
                        artist: track.artist_name,
                        image: track.image,
                        id: trackId
                    });
                }
            }
            
            showNotification(`${lang.t('download.downloading')} ${tracksToDownload.length} ${lang.t('library.tracks')}`);
        } catch (error) {
            showNotification(`${lang.t('download.downloadError')}: ${error.message}`);
        }
    });

    removeSelectedBtn.addEventListener('click', async () => {
        if (selectedTrackIds.size === 0) return;
        
        const lang = window.language || { t: (k) => k };
        const message = selectedTrackIds.size === 1
            ? lang.t('library.removeSingleTrack')
            : lang.t('library.removeMultipleTracks').replace('{count}', selectedTrackIds.size);
        
        if (confirm(message)) {
            try {
                for (const trackId of selectedTrackIds) {
                    await ipcRenderer.invoke('remove-song-from-playlist', currentViewingPlaylistId, trackId);
                }
                selectedTrackIds.clear();
                await loadPlaylists();
                await openViewModal(currentViewingPlaylistId);
            } catch (error) {
                console.error('Error removing selected tracks:', error);
                const lang = window.language || { t: (k) => k };
                showNotification(`${lang.t('library.errorRemovingTracks')}: ${error.message}`);
            }
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
    const playlistTracksHeader = document.getElementById('playlistTracksHeader');
    const selectAllCheckbox = document.getElementById('selectAllTracks');
    const lang = window.language || { t: (k) => k };

    const playlist = allPlaylists.find(p => p.id == playlistId);
    if (!playlist) return;

    currentViewingPlaylistId = playlistId;
    selectedTrackIds.clear();
    selectAllCheckbox.checked = false;
    
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
        currentPlaylistTracks = tracks || [];
        if (tracks && tracks.length > 0) {
            playlistTracksList.innerHTML = tracks.map(track => createPlaylistTrackItem(track)).join('');
            playlistTracksHeader.style.display = 'flex';
            updateBulkActionsVisibility();
            setupTrackDragAndDrop();
            setupTrackCheckboxes();
        } else {
            playlistTracksList.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <p>${lang.t('library.noTracks')}</p>
                </div>
            `;
            playlistTracksHeader.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading playlist tracks:', error);
        playlistTracksList.innerHTML = `
            <div class="error-state" style="padding: 40px 20px;">
                <p>${lang.t('library.errorLoadingTracks')}</p>
            </div>
        `;
        playlistTracksHeader.style.display = 'none';
    }

    modal.classList.add('active');
}

function closeViewModal() {
    const modal = document.getElementById('playlistViewModal');
    const playlistTracksHeader = document.getElementById('playlistTracksHeader');
    
    modal.classList.remove('active');
    currentViewingPlaylistId = null;
    selectedTrackIds.clear();
    playlistTracksHeader.style.display = 'none';
}

function updateViewModalLanguage() {
    const playlistViewCount = document.getElementById('playlistViewCount');
    const lang = window.language || { t: (k) => k };
    
    if (playlistViewCount && currentViewingPlaylistId) {
        const playlist = allPlaylists.find(p => p.id == currentViewingPlaylistId);
        if (playlist) {
            playlistViewCount.textContent = `${playlist.song_count || 0} ${lang.t('library.tracks')}`;
        }
    }
}

function setupMoveModal() {
    const modal = document.getElementById('moveToPlaylistModal');
    const closeBtn = document.getElementById('closeMoveModal');
    const cancelBtn = document.getElementById('cancelMoveBtn');
    const confirmBtn = document.getElementById('confirmMoveBtn');
    const playlistSelect = document.getElementById('movePlaylistSelect');

    closeBtn.addEventListener('click', closeMoveModal);
    cancelBtn.addEventListener('click', closeMoveModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMoveModal();
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const targetPlaylistId = playlistSelect.value;
        if (!targetPlaylistId) {
            const lang = window.language || { t: (k) => k };
            showNotification(lang.t('library.selectPlaylist'));
            return;
        }
        
        const lang = window.language || { t: (k) => k };
        const message = selectedTrackIds.size === 1
            ? lang.t('library.moveSingleTrack')
            : lang.t('library.moveMultipleTracks').replace('{count}', selectedTrackIds.size);
        
        if (confirm(message)) {
            try {
                const tracks = await ipcRenderer.invoke('get-playlist-songs', currentViewingPlaylistId);
                const tracksToMove = tracks.filter(t => selectedTrackIds.has(t.track_id));
                
                for (const track of tracksToMove) {
                    await ipcRenderer.invoke('add-song-to-playlist', targetPlaylistId, {
                        id: track.track_id,
                        name: track.track_name,
                        artist: track.artist_name,
                        image: track.image,
                        duration: track.duration
                    });
                }
                
                for (const trackId of selectedTrackIds) {
                    await ipcRenderer.invoke('remove-song-from-playlist', currentViewingPlaylistId, trackId);
                }
                
                selectedTrackIds.clear();
                closeMoveModal();
                await loadPlaylists();
                await openViewModal(currentViewingPlaylistId);
            } catch (error) {
                console.error('Error moving tracks:', error);
                const lang = window.language || { t: (k) => k };
                showNotification(`${lang.t('library.errorMovingTracks')}: ${error.message}`);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeMoveModal();
        }
    });
}

function openMoveModal() {
    const modal = document.getElementById('moveToPlaylistModal');
    const playlistSelect = document.getElementById('movePlaylistSelect');
    const countInfo = document.getElementById('moveCountInfo');
    const lang = window.language || { t: (k) => k };

    const otherPlaylists = allPlaylists.filter(p => p.id != currentViewingPlaylistId);
    playlistSelect.innerHTML = '<option value="">-- Select Playlist --</option>' +
        otherPlaylists.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

    countInfo.textContent = lang.t('library.selectedCount').replace('{count}', selectedTrackIds.size);
    modal.classList.add('active');
}

function closeMoveModal() {
    const modal = document.getElementById('moveToPlaylistModal');
    modal.classList.remove('active');
}

function setupCopyModal() {
    const modal = document.getElementById('copyToPlaylistModal');
    const closeBtn = document.getElementById('closeCopyModal');
    const cancelBtn = document.getElementById('cancelCopyBtn');
    const confirmBtn = document.getElementById('confirmCopyBtn');
    const playlistSelect = document.getElementById('copyPlaylistSelect');

    closeBtn.addEventListener('click', closeCopyModal);
    cancelBtn.addEventListener('click', closeCopyModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCopyModal();
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const targetPlaylistId = playlistSelect.value;
        if (!targetPlaylistId) {
            const lang = window.language || { t: (k) => k };
            showNotification(lang.t('library.selectPlaylist'));
            return;
        }
        
        try {
            const tracks = await ipcRenderer.invoke('get-playlist-songs', currentViewingPlaylistId);
            const tracksToCopy = tracks.filter(t => selectedTrackIds.has(t.track_id));
            
            for (const track of tracksToCopy) {
                await ipcRenderer.invoke('add-song-to-playlist', targetPlaylistId, {
                    id: track.track_id,
                    name: track.track_name,
                    artist: track.artist_name,
                    image: track.image,
                    duration: track.duration
                });
            }
            
            selectedTrackIds.clear();
            closeCopyModal();
            await loadPlaylists();
            await openViewModal(currentViewingPlaylistId);
        } catch (error) {
            console.error('Error copying tracks:', error);
            const lang = window.language || { t: (k) => k };
            showNotification(`${lang.t('library.errorCopyingTracks')}: ${error.message}`);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeCopyModal();
        }
    });
}

function openCopyModal() {
    const lang = window.language?.t?.bind(window.language) || ((k) => k);
    document.getElementById('copyPlaylistSelect').innerHTML =
        '<option value="">-- Select Playlist --</option>' +
        allPlaylists.filter(p => p.id != currentViewingPlaylistId).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    document.getElementById('copyCountInfo').textContent = lang('library.selectedCount').replace('{count}', selectedTrackIds.size);
    document.getElementById('copyToPlaylistModal').classList.add('active');
}

function closeCopyModal() {
    const modal = document.getElementById('copyToPlaylistModal');
    modal.classList.remove('active');
}

function createPlaylistTrackItem(track) {
    const imageUrl = track.image || '';
    const trackName = track.track_name || '';
    const artistName = track.artist_name || '';
    const trackId = track.track_id;
    const lang = window.language || { t: (k) => k };
    const downloadTitle = lang.t('download.download');

    if (imageUrl) {
        return `
            <div class="playlist-track-item" draggable="true" data-track-name="${escapeHtml(trackName)}" data-track-artist="${escapeHtml(artistName)}" data-track-image="${escapeHtml(imageUrl)}" data-track-id="${escapeHtml(trackId)}">
                <input type="checkbox" class="track-checkbox" data-track-id="${escapeHtml(trackId)}">
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
                <button class="playlist-track-download-btn" title="${downloadTitle}" data-track-id="${escapeHtml(trackId)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                </button>
                <button class="playlist-track-remove-btn" title="${lang.t('library.removeTrack')}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `;
    } else {
        return `
            <div class="playlist-track-item" draggable="true" data-track-name="${escapeHtml(trackName)}" data-track-artist="${escapeHtml(artistName)}" data-track-image="" data-track-id="${escapeHtml(trackId)}">
                <input type="checkbox" class="track-checkbox" data-track-id="${escapeHtml(trackId)}">
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
                <button class="playlist-track-download-btn" title="${downloadTitle}" data-track-id="${escapeHtml(trackId)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                </button>
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
    const dragEvents = { dragstart: handleDragStart, dragend: handleDragEnd, dragover: handleDragOver, drop: handleDrop, dragleave: handleDragLeave };
    document.querySelectorAll('.playlist-track-item').forEach(item => {
        Object.entries(dragEvents).forEach(([event, handler]) => item.addEventListener(event, handler));
        item.addEventListener('click', async (e) => {
            if (e.target.closest('.playlist-track-remove-btn, .playlist-track-drag-handle, .track-checkbox')) return;
            const { trackName, trackArtist, trackImage, trackId } = item.dataset;
            const playlist = allPlaylists.find(p => p.id == currentViewingPlaylistId);
            try {
                const tracks = await ipcRenderer.invoke('get-playlist-songs', currentViewingPlaylistId);
                const trackIndex = tracks?.findIndex(t => t.track_id === trackId);
                if (trackIndex !== -1) {
                    ipcRenderer.send('request-play-playlist', currentViewingPlaylistId, playlist?.name || '', tracks, trackIndex);
                } else {
                    playTrack(trackName, trackArtist, trackImage, trackId);
                }
            } catch {
                playTrack(trackName, trackArtist, trackImage, trackId);
            }
        });
        item.querySelector('.playlist-track-remove-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await removeTrackFromPlaylist(item.dataset.trackId);
        });
    });
}

function setupTrackCheckboxes() {
    const checkboxes = document.querySelectorAll('.track-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const trackId = e.target.dataset.trackId;
            if (e.target.checked) {
                selectedTrackIds.add(trackId);
            } else {
                selectedTrackIds.delete(trackId);
            }
            updateBulkActionsVisibility();
        });
    });
}


async function downloadTrack(track) {
    const trackId = track.id || track.videoId || track.track_id;

    if (!trackId) {
        return;
    }

    if (downloadingTracks.has(trackId)) {
        return;
    }

    downloadingTracks.set(trackId, 0);
    updateDownloadButton(trackId, 0);
    
    ipcRenderer.send('start-download', track);
}

function updateDownloadButton(trackId, status) {
    const downloadBtn = document.querySelector(`.playlist-track-download-btn[data-track-id="${escapeHtml(trackId)}"]`);
    if (!downloadBtn) return;

    const lang = window.language || { t: (k) => k };

    if (status === 'complete') {
        downloadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
        `;
        downloadBtn.title = lang.t('download.downloadComplete');
        downloadBtn.classList.add('download-complete');
    } else if (status === 'error') {
        downloadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
        `;
        downloadBtn.title = lang.t('download.downloadError');
        downloadBtn.classList.add('download-error');
    } else if (typeof status === 'number') {
        downloadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="${60 - (60 * status / 100)}" stroke-linecap="round"/>
            </svg>
        `;
        downloadBtn.title = `${lang.t('download.downloading')} ${status}%`;
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
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

function updateBulkActionsVisibility() {
    const removeSelectedBtn = document.getElementById('removeSelectedBtn');
    const moveSelectedBtn = document.getElementById('moveSelectedBtn');
    const copySelectedBtn = document.getElementById('copySelectedBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const selectAllCheckbox = document.getElementById('selectAllTracks');
    const trackCheckboxes = document.querySelectorAll('.track-checkbox');
    
    if (trackCheckboxes.length > 0) {
        const allChecked = Array.from(trackCheckboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked && trackCheckboxes.length > 0;
    } else {
        selectAllCheckbox.checked = false;
    }
    
    if (selectedTrackIds.size > 0) {
        removeSelectedBtn.style.display = 'flex';
        moveSelectedBtn.style.display = 'flex';
        copySelectedBtn.style.display = 'flex';
        downloadSelectedBtn.style.display = 'flex';
    } else {
        removeSelectedBtn.style.display = 'none';
        moveSelectedBtn.style.display = 'none';
        copySelectedBtn.style.display = 'none';
        downloadSelectedBtn.style.display = 'none';
    }
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
        await loadPlaylists();
        await openViewModal(currentViewingPlaylistId);
    } catch (error) {
        console.error('Error removing track from playlist:', error);
        const lang = window.language || { t: (k) => k };
        showNotification(`${lang.t('library.errorRemovingTrack')}: ${error.message}`);
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
    ipcRenderer.send('request-exit-playlist-mode');
    ipcRenderer.send('request-play', track);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initLibraryPage as initLibraryPage, addTrackToPlaylist };
