const { ipcRenderer } = require('electron');

let isPlaying = false;

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
    await loadFavorites();
}

async function loadFavorites() {
    const favoritesContent = document.getElementById('favoritesContent');
    const lang = window.language || { t: (k) => k };

    try {
        const songs = await ipcRenderer.invoke('get-favorites');

        if (!songs || songs.length === 0) {
            favoritesContent.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    <h2 data-i18n="favorites.noFavorites">${lang.t('favorites.noFavorites')}</h2>
                    <p data-i18n="favorites.startFavoriting">${lang.t('favorites.startFavoriting')}</p>
                </div>
            `;
            return;
        }

        const songsHTML = `
            <div class="favorites-list">
                ${songs.map((song, index) => createTrackCard(song, index)).join('')}
            </div>
        `;

        favoritesContent.innerHTML = songsHTML;

        const trackCards = document.querySelectorAll('.track-card');
        trackCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.05}s`;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.remove-favorite-btn')) {
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

        const removeButtons = document.querySelectorAll('.remove-favorite-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const trackId = btn.dataset.trackId;
                removeFavorite(trackId);
            });
        });

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
    const lang = window.language || { t: (k) => k };

    if (imageUrl) {
        return `
            <div class="track-card"
                 data-track-name="${escapeHtml(song.track_name)}"
                 data-artist-name="${escapeHtml(song.artist_name)}"
                 data-image="${escapeHtml(imageUrl)}"
                 data-track-id="${escapeHtml(trackId)}"
                 data-index="${index}">
                <div class="track-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(song.track_name)}" loading="lazy">
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(song.track_name)}">${escapeHtml(song.track_name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(song.artist_name)}">${escapeHtml(song.artist_name)}</span>
                </div>
                <div class="track-card-actions">
                    <button class="remove-favorite-btn" data-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.removeFromFavorites')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
                 data-index="${index}">
                <div class="track-card-image no-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <div class="track-card-info">
                    <span class="track-card-name" title="${escapeHtml(song.track_name)}">${escapeHtml(song.track_name)}</span>
                    <span class="track-card-artist" title="${escapeHtml(song.artist_name)}">${escapeHtml(song.artist_name)}</span>
                </div>
                <div class="track-card-actions">
                    <button class="remove-favorite-btn" data-track-id="${escapeHtml(trackId)}" title="${lang.t('favorites.removeFromFavorites')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                    </button>
                </div>
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

    console.log('[Favorites] Requesting to play:', track);
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
