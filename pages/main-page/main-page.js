const { ipcRenderer } = require('electron');

let allPlaylists = [];
let recommendations = [];

export function initMainPage() {
    updateGreeting();
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = window.language?.getTranslation(key);
        if (text) el.textContent = text;
    });
    
    loadPlaylists();
    loadRecommendations();
}

export function updateGreeting() {
    const greetingTitle = document.getElementById('greetingTitle');
    if (!greetingTitle) return;

    const now = new Date();
    const hour = now.getHours();

    let greetingKey;
    if (hour >= 5 && hour < 12) greetingKey = 'mainPage.morning';
    else if (hour >= 12 && hour < 17) greetingKey = 'mainPage.afternoon';
    else if (hour >= 17 && hour < 22) greetingKey = 'mainPage.evening';
    else greetingKey = 'mainPage.night';

    if (window.language) {
        const text = window.language.getTranslation(greetingKey);
        greetingTitle.textContent = text;
    }
}

window.initMainPage = initMainPage;

async function loadPlaylists() {
    const playlistsGrid = document.getElementById('playlistsGrid');
    const lang = window.language || { getTranslation: (k) => k };

    try {
        const playlists = await ipcRenderer.invoke('get-all-playlists');
        allPlaylists = playlists || [];
        renderPlaylists(allPlaylists);
    } catch (error) {
        console.error('Error loading playlists:', error);
        playlistsGrid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noPlaylists')}</h3>
                <p>${lang.getTranslation('mainPage.createFirstPlaylist')}</p>
            </div>
        `;
    }
}

function renderPlaylists(playlists) {
    const playlistsGrid = document.getElementById('playlistsGrid');
    const lang = window.language || { getTranslation: (k) => k };

    if (!playlists || playlists.length === 0) {
        playlistsGrid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noPlaylists')}</h3>
                <p>${lang.getTranslation('mainPage.createFirstPlaylist')}</p>
            </div>
        `;
        return;
    }

    const playlistsHTML = playlists.map((playlist, index) => createPlaylistCard(playlist, index)).join('');
    playlistsGrid.innerHTML = playlistsHTML;

    const playlistCards = document.querySelectorAll('.playlists-grid .playlist-card');
    playlistCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const playlistId = card.dataset.playlistId;
            const playlist = allPlaylists.find(p => p.id == playlistId);
            if (playlist) {
                navigateToLibrary(playlistId);
            }
        });
    });
}

function createPlaylistCard(playlist, index) {
    const imageUrl = playlist.cover_image || '';
    const trackCount = playlist.song_count || 0;
    const lang = window.language || { getTranslation: (k) => k };

    if (imageUrl) {
        return `
            <div class="playlist-card" data-playlist-id="${escapeHtml(playlist.id)}" data-index="${index}">
                <div class="playlist-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(playlist.name)}" loading="lazy">
                </div>
                <div class="playlist-card-info">
                    <h3 class="playlist-card-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</h3>
                    <p class="playlist-card-count">${trackCount} ${lang.getTranslation('library.tracks') || 'tracks'}</p>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="playlist-card" data-playlist-id="${escapeHtml(playlist.id)}" data-index="${index}">
                <div class="playlist-card-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <div class="playlist-card-info">
                    <h3 class="playlist-card-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</h3>
                    <p class="playlist-card-count">${trackCount} ${lang.getTranslation('library.tracks') || 'tracks'}</p>
                </div>
            </div>
        `;
    }
}

function navigateToLibrary(playlistId = null) {
    const navItem = document.querySelector(`[data-page="library"]`);
    if (navItem) {
        navItem.click();
    }
}

async function loadRecommendations() {
    const recommendationsGrid = document.getElementById('recommendationsGrid');
    const lang = window.language || { getTranslation: (k) => k };

    try {
        const likedSongs = await ipcRenderer.invoke('get-liked-songs');
        
        const favorites = await ipcRenderer.invoke('get-favorites');
        
        recommendations = createRecommendations(likedSongs, favorites);
        renderRecommendations(recommendations);
    } catch (error) {
        console.error('Error loading recommendations:', error);
        recommendationsGrid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noRecommendations') || 'No recommendations yet'}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || 'Start listening to get personalized recommendations'}</p>
            </div>
        `;
    }
}

function createRecommendations(likedSongs, favorites) {
    const recs = [];
    
    if (likedSongs && likedSongs.length > 0) {
        likedSongs.slice(0, 4).forEach((song, index) => {
            recs.push({
                id: song.id || song.videoId,
                title: song.name || song.track_name,
                artist: song.artist,
                image: song.image,
                type: 'liked'
            });
        });
    }
    
    if (favorites && favorites.length > 0) {
        favorites.slice(0, 4).forEach((fav, index) => {
            if (recs.length < 8) {
                recs.push({
                    id: fav.id || fav.videoId,
                    title: fav.name || fav.track_name,
                    artist: fav.artist,
                    image: fav.image,
                    type: 'favorite'
                });
            }
        });
    }
    
    return recs;
}

function renderRecommendations(recs) {
    const recommendationsGrid = document.getElementById('recommendationsGrid');
    const lang = window.language || { getTranslation: (k) => k };

    if (!recs || recs.length === 0) {
        recommendationsGrid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noRecommendations') || 'No recommendations yet'}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || 'Start listening to get personalized recommendations'}</p>
            </div>
        `;
        return;
    }

    const recsHTML = recs.map((rec, index) => createRecommendationCard(rec, index)).join('');
    recommendationsGrid.innerHTML = recsHTML;

    const recCards = document.querySelectorAll('.recommendations-grid .recommendation-card');
    recCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const trackId = card.dataset.trackId;
            const rec = recommendations.find(r => r.id === trackId);
            if (rec) {
                playTrack(rec);
            }
        });
    });
}

function createRecommendationCard(rec, index) {
    const imageUrl = rec.image || '';
    const typeLabel = rec.type === 'liked' ? 'Liked' : 'Favorite';

    if (imageUrl) {
        return `
            <div class="recommendation-card" data-track-id="${escapeHtml(rec.id)}" data-index="${index}">
                <div class="recommendation-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(rec.title)}" loading="lazy">
                    <button class="recommendation-play-btn" title="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="recommendation-card-info">
                    <h3 class="recommendation-card-title" title="${escapeHtml(rec.title)}">${escapeHtml(rec.title)}</h3>
                    <p class="recommendation-card-artist" title="${escapeHtml(rec.artist)}">${escapeHtml(rec.artist)}</p>
                    <p class="recommendation-card-type">${typeLabel}</p>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="recommendation-card" data-track-id="${escapeHtml(rec.id)}" data-index="${index}">
                <div class="recommendation-card-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <button class="recommendation-play-btn" title="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="recommendation-card-info">
                    <h3 class="recommendation-card-title" title="${escapeHtml(rec.title)}">${escapeHtml(rec.title)}</h3>
                    <p class="recommendation-card-artist" title="${escapeHtml(rec.artist)}">${escapeHtml(rec.artist)}</p>
                    <p class="recommendation-card-type">${typeLabel}</p>
                </div>
            </div>
        `;
    }
}

function playTrack(rec) {
    const track = {
        name: rec.title,
        artist: rec.artist,
        image: rec.image,
        id: rec.id
    };
    ipcRenderer.send('request-exit-playlist-mode');
    ipcRenderer.send('request-play', track);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}