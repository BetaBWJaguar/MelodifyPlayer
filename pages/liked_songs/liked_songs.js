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

async function initLikedSongsPage() {
    console.log('Initializing liked songs page...');
    await loadLikedSongs();
}

async function loadLikedSongs() {
    const likedSongsContent = document.getElementById('likedSongsContent');
    const lang = window.language || { t: (k) => k };

    try {
        const songs = await ipcRenderer.invoke('get-liked-songs');

        if (!songs || songs.length === 0) {
            likedSongsContent.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                            2 5.42 4.42 3 7.5 3c1.74 0 3.41.81
                            4.5 2.09C13.09 3.81 14.76 3
                            16.5 3 19.58 3 22 5.42
                            22 8.5c0 3.78-3.4 6.86-8.55
                            11.54L12 21.35z"/>
                    </svg>
                    <h2 data-i18n="likedSongs.noLikedSongs">${lang.t('likedSongs.noLikedSongs')}</h2>
                    <p data-i18n="likedSongs.startLiking">${lang.t('likedSongs.startLiking')}</p>
                </div>
            `;
            return;
        }

        const songsHTML = `
            <div class="liked-songs-list">
                ${songs.map((song, index) => createTrackCard(song, index)).join('')}
            </div>
        `;

        likedSongsContent.innerHTML = songsHTML;

        const trackCards = document.querySelectorAll('.track-card');
        trackCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.05}s`;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.remove-like-btn')) {
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

        const removeButtons = document.querySelectorAll('.remove-like-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const trackId = btn.dataset.trackId;
                removeLikedSong(trackId);
            });
        });

    } catch (error) {
        console.error('Error loading liked songs:', error);
        likedSongsContent.innerHTML = `
            <div class="empty-state">
                <h2>${lang.t('likedSongs.error')}</h2>
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
                    <button class="remove-like-btn" data-track-id="${escapeHtml(trackId)}" title="${lang.t('likedSongs.removeFromLiked')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                                2 5.42 4.42 3 7.5 3c1.74 0 3.41.81
                                4.5 2.09C13.09 3.81 14.76 3
                                16.5 3 19.58 3 22 5.42
                                22 8.5c0 3.78-3.4 6.86-8.55
                                11.54L12 21.35z"/>
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
                    <button class="remove-like-btn" data-track-id="${escapeHtml(trackId)}" title="${lang.t('likedSongs.removeFromLiked')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                                2 5.42 4.42 3 7.5 3c1.74 0 3.41.81
                                4.5 2.09C13.09 3.81 14.76 3
                                16.5 3 19.58 3 22 5.42
                                22 8.5c0 3.78-3.4 6.86-8.55
                                11.54L12 21.35z"/>
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

    console.log('[Liked Songs] Requesting to play:', track);
    ipcRenderer.send('request-play', track);
}

async function removeLikedSong(trackId) {
    try {
        ipcRenderer.send('request-unlike-song', trackId);
        await loadLikedSongs();
        
        const likeBtn = document.getElementById('likeBtn');
        if (likeBtn && playerState?.currentTrack) {
            const currentTrackId = playerState.currentTrack.id || playerState.currentTrack.videoId;
            if (currentTrackId === trackId) {
                likeBtn.classList.remove('active');
            }
        }
    } catch (error) {
        console.error('Error removing liked song:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initLikedSongsPage as initLiked_songsPage };
