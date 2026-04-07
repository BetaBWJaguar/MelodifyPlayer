const { ipcRenderer } = require('electron');

let allPlaylists = [];
let searchTerm = '';
let currentEditingPlaylistId = null;
let currentViewingPlaylistId = null;

// Mock data for playlists (will be replaced with backend data)
const mockPlaylists = [
    {
        id: '1',
        name: 'Chill Vibes',
        description: 'Relaxing songs for studying',
        image: null,
        tracks: [
            { name: 'Blinding Lights', artist: 'The Weeknd', image: 'https://i.scdn.co/image/ab67616d0000b273959e6096d6c7d7b8a6b4e8a6', duration: '3:20' },
            { name: 'Levitating', artist: 'Dua Lipa', image: 'https://i.scdn.co/image/ab67616d0000b273959e6096d6c7d7b8a6b4e8a6', duration: '3:23' },
            { name: 'Stay', artist: 'The Kid LAROI, Justin Bieber', image: 'https://i.scdn.co/image/ab67616d0000b273959e6096d6c7d7b8a6b4e8a6', duration: '2:21' }
        ]
    },
    {
        id: '2',
        name: 'Workout Mix',
        description: 'High energy songs for gym',
        image: null,
        tracks: [
            { name: 'Stronger', artist: 'Kanye West', image: 'https://i.scdn.co/image/ab67616d0000b273959e6096d6c7d7b8a6b4e8a6', duration: '5:11' },
            { name: 'Eye of the Tiger', artist: 'Survivor', image: 'https://i.scdn.co/image/ab67616d0000b273959e6096d6c7d7b8a6b4e8a6', duration: '4:05' }
        ]
    }
];

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
    const imageUrl = playlist.image || '';
    const trackCount = playlist.tracks ? playlist.tracks.length : 0;
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
            // TODO: Call backend to update playlist
            console.log('Saving playlist:', currentEditingPlaylistId, name, description);
            closeEditModal();
            await loadPlaylists();
        } catch (error) {
            console.error('Error saving playlist:', error);
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

    const playlist = allPlaylists.find(p => p.id === playlistId);
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
            // TODO: Call backend to delete playlist
            console.log('Deleting playlist:', currentEditingPlaylistId);
            closeDeleteModal();
            await loadPlaylists();
        } catch (error) {
            console.error('Error deleting playlist:', error);
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

    const playlist = allPlaylists.find(p => p.id === playlistId);
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

    playBtn.addEventListener('click', () => {
        const playlist = allPlaylists.find(p => p.id === currentViewingPlaylistId);
        if (playlist && playlist.tracks && playlist.tracks.length > 0) {
            const firstTrack = playlist.tracks[0];
            playTrack(firstTrack.name, firstTrack.artist, firstTrack.image, firstTrack.id);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeViewModal();
        }
    });
}

function openViewModal(playlistId) {
    const modal = document.getElementById('playlistViewModal');
    const playlistViewImage = document.getElementById('playlistViewImage');
    const playlistViewName = document.getElementById('playlistViewName');
    const playlistViewDesc = document.getElementById('playlistViewDesc');
    const playlistViewCount = document.getElementById('playlistViewCount');
    const playlistTracksList = document.getElementById('playlistTracksList');
    const lang = window.language || { t: (k) => k };

    const playlist = allPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;

    currentViewingPlaylistId = playlistId;
    playlistViewName.textContent = playlist.name;
    playlistViewDesc.textContent = playlist.description || '';
    playlistViewCount.textContent = `${playlist.tracks ? playlist.tracks.length : 0} ${lang.t('library.tracks')}`;

    if (playlist.image) {
        playlistViewImage.innerHTML = `<img src="${escapeHtml(playlist.image)}" alt="">`;
        playlistViewImage.classList.remove('no-image');
    } else {
        playlistViewImage.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
        `;
        playlistViewImage.classList.add('no-image');
    }

    if (playlist.tracks && playlist.tracks.length > 0) {
        playlistTracksList.innerHTML = playlist.tracks.map(track => createPlaylistTrackItem(track)).join('');
    } else {
        playlistTracksList.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <p>${lang.t('library.noTracks')}</p>
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
    const lang = window.language || { t: (k) => k };

    if (imageUrl) {
        return `
            <div class="playlist-track-item" data-track-name="${escapeHtml(track.name)}" data-track-artist="${escapeHtml(track.artist)}" data-track-image="${escapeHtml(imageUrl)}">
                <div class="playlist-track-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(track.name)}" loading="lazy">
                </div>
                <div class="playlist-track-info">
                    <span class="playlist-track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
                    <span class="playlist-track-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
                </div>
                <span class="playlist-track-duration">${track.duration || ''}</span>
            </div>
        `;
    } else {
        return `
            <div class="playlist-track-item" data-track-name="${escapeHtml(track.name)}" data-track-artist="${escapeHtml(track.artist)}" data-track-image="">
                <div class="playlist-track-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <div class="playlist-track-info">
                    <span class="playlist-track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
                    <span class="playlist-track-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</span>
                </div>
                <span class="playlist-track-duration">${track.duration || ''}</span>
            </div>
        `;
    }
}

async function loadPlaylists() {
    const libraryContent = document.getElementById('libraryContent');
    const lang = window.language || { t: (k) => k };

    try {
        // TODO: Replace with actual backend call
        // const playlists = await ipcRenderer.invoke('get-playlists');
        allPlaylists = mockPlaylists || [];
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

export { initLibraryPage as initLibraryPage };
