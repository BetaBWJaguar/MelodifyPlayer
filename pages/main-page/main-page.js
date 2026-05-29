const { ipcRenderer } = require('electron');

let allPlaylists = [];
let recommendations = [];
let recentTracks = [];
let discoverRecommendations = [];


export function initMainPage() {
    const mainPageEl = document.querySelector('.main-page');
    if (mainPageEl) {
        mainPageEl.classList.add('page-enter');
        mainPageEl.addEventListener('animationend', () => {
            mainPageEl.classList.remove('page-enter');
        }, { once: true });
    }

    updateGreeting();
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = window.language?.getTranslation(key);
        if (text) el.textContent = text;
    });
    
    setupSeeAllButton();
    setupRefreshDiscoverButton();
    loadPlaylists();
    loadRecentlyPlayed();
    loadRecommendations();
    loadDiscoverRecommendations();
    loadTopArtists();

    if (window.language && !window._mainPageLangCallbackRegistered) {
        window._mainPageLangCallbackRegistered = true;
        window.language.onLanguageChange(() => {
            if (!document.getElementById('greetingTitle')) return;
            updateGreeting();
            if (allPlaylists.length > 0) {
                renderPlaylists(allPlaylists);
            } else {
                loadPlaylists();
            }
            if (recentTracks.length > 0) {
                renderRecentlyPlayed(recentTracks);
            } else {
                loadRecentlyPlayed();
            }
            if (recommendations.length > 0) {
                renderRecommendations(recommendations);
            } else {
                loadRecommendations();
            }
            if (discoverRecommendations.length > 0) {
                renderDiscoverRecommendations(discoverRecommendations);
            } else {
                loadDiscoverRecommendations();
            }
            loadTopArtists();
        });
    }

    if (!window._mainPageHistoryListenerRegistered) {
        window._mainPageHistoryListenerRegistered = true;
        ipcRenderer.on('player-history-updated', () => {
            if (!document.getElementById('greetingTitle')) return;
            loadRecentlyPlayed();
            loadTopArtists();
            loadDiscoverRecommendations();
        });
    }
}


async function loadRecentlyPlayed() {
    const grid = document.getElementById('recentlyPlayedGrid');
    const lang = window.language || { getTranslation: (k) => k };

    try {
        const dbTracks = await ipcRenderer.invoke('get-db-recent-tracks', 6);
        recentTracks = dbTracks || [];
        renderRecentlyPlayed(recentTracks);
    } catch (error) {
        console.error('Error loading recent tracks:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noRecent') || 'No recent plays'}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || 'Start listening to see your history'}</p>
            </div>
        `;
    }
}

function renderRecentlyPlayed(tracks) {
    const grid = document.getElementById('recentlyPlayedGrid');
    const lang = window.language || { getTranslation: (k) => k };

    if (!tracks || tracks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noRecent') || ''}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || ''}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = tracks.map((track, index) => createRecentCard(track, index)).join('');

    grid.querySelectorAll('.recent-card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const track = tracks[index];
            if (track) {
                ipcRenderer.send('request-exit-playlist-mode');
                ipcRenderer.send('request-play', {
                    name: track.name,
                    artist: track.artist,
                    image: track.image,
                    id: track.id
                });
            }
        });
    });
}

function createRecentCard(track, index) {
    const imageUrl = track.image || '';
    if (imageUrl) {
        return `
            <div class="recent-card" data-index="${index}">
                <div class="recommendation-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(track.name)}" loading="lazy">
                    <button class="recommendation-play-btn" title="${(window.language || { t: (k) => k }).t('player.play')}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                </div>
                <div class="recommendation-card-info">
                    <h3 class="recommendation-card-title" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
                    <p class="recommendation-card-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="recent-card" data-index="${index}">
                <div class="recommendation-card-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <button class="recommendation-play-btn" title="${(window.language || { t: (k) => k }).t('player.play')}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                </div>
                <div class="recommendation-card-info">
                    <h3 class="recommendation-card-title" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h3>
                    <p class="recommendation-card-artist" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
                </div>
            </div>
        `;
    }
}

async function loadTopArtists() {
    const grid = document.getElementById('topArtistsGrid');
    const lang = window.language || { getTranslation: (k) => k };

    try {
        const artists = await ipcRenderer.invoke('get-db-top-artists', 6);
        renderTopArtists(artists);
    } catch (error) {
        console.error('Error loading top artists:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noArtists') || 'No artists yet'}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || 'Listen to music to see your top artists'}</p>
            </div>
        `;
    }
}

function getTopArtists(history, limit = 6) {
    const artistCount = {};

    (history || []).forEach(track => {
        const artist = track.artist || 'Unknown';
        artistCount[artist] = (artistCount[artist] || 0) + 1;
    });

    return Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));
}

function renderTopArtists(artists) {
    const grid = document.getElementById('topArtistsGrid');
    const lang = window.language || { getTranslation: (k) => k };
    const colors = ['#e94560', '#533483', '#27ae60', '#f39c12', '#3498db', '#9b59b6'];

    if (!artists || artists.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noArtists') || ''}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || ''}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = artists.map((artist, i) => {
        const color = colors[i % colors.length];
        return `
            <div class="artist-card" style="animation-delay: ${i * 0.06}s">
                <div class="artist-avatar" style="background: ${color}18; border-color: ${color}50;">
                    <span style="color: ${color}">${artist.name.charAt(0).toUpperCase()}</span>
                </div>
                <div class="artist-info">
                    <span class="artist-name" title="${escapeHtml(artist.name)}">${escapeHtml(artist.name)}</span>
                    <span class="artist-count">${artist.count} ${lang.getTranslation('mainPage.plays') || 'plays'}</span>
                </div>
            </div>
        `;
    }).join('');
}

function setupSeeAllButton() {
    const seeAllBtn = document.querySelector('.see-all');
    if (seeAllBtn) {
        seeAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToLibrary();
        });
    }
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
        window.pendingPlaylistId = playlistId;
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
    const MAX_RECOMMENDATIONS = 8;
    const songMap = new Map();

    if (likedSongs && likedSongs.length > 0) {
        likedSongs.forEach(song => {
            const trackId = song.track_id;
            if (!trackId) return;
            if (!songMap.has(trackId)) {
                songMap.set(trackId, {
                    id: trackId,
                    title: song.track_name || song.name,
                    artist: song.artist_name || song.artist,
                    image: song.image,
                    type: 'liked'
                });
            }
        });
    }

    if (favorites && favorites.length > 0) {
        favorites.forEach(fav => {
            const trackId = fav.track_id;
            if (!trackId) return;
            if (songMap.has(trackId)) {
                songMap.get(trackId).type = 'both';
            } else {
                songMap.set(trackId, {
                    id: trackId,
                    title: fav.track_name || fav.name,
                    artist: fav.artist_name || fav.artist,
                    image: fav.image,
                    type: 'favorite'
                });
            }
        });
    }

    const allSongs = Array.from(songMap.values());
    for (let i = allSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
    }

    return allSongs.slice(0, MAX_RECOMMENDATIONS);
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
                <h3>${lang.getTranslation('mainPage.noRecommendations') || ''}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || ''}</p>
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
    const lang = window.language || { getTranslation: (k) => k };
    let typeLabel;
    switch (rec.type) {
        case 'liked':
            typeLabel = lang.getTranslation('mainPage.liked');
            break;
        case 'favorite':
            typeLabel = lang.getTranslation('mainPage.favorite');
            break;
        case 'both':
            typeLabel = lang.getTranslation('mainPage.likedAndFavorite');
            break;
        default:
            typeLabel = '';
    }

    if (imageUrl) {
        return `
            <div class="recommendation-card" data-track-id="${escapeHtml(rec.id)}" data-index="${index}">
                <div class="recommendation-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(rec.title)}" loading="lazy">
                    <button class="recommendation-play-btn" title="${(window.language || { t: (k) => k }).t('player.play')}">
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
                    <button class="recommendation-play-btn" title="${(window.language || { t: (k) => k }).t('player.play')}">
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

function setupRefreshDiscoverButton() {
    const refreshBtn = document.getElementById('refreshDiscoverBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.classList.add('spinning');
            btn.disabled = true;

            const grid = document.getElementById('discoverGrid');
            grid.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

            try {
                discoverRecommendations = await ipcRenderer.invoke('refresh-recommendations');
                renderDiscoverRecommendations(discoverRecommendations);
            } catch (error) {
                console.error('Error refreshing discover recommendations:', error);
            } finally {
                btn.classList.remove('spinning');
                btn.disabled = false;
            }
        });
    }
}

async function loadDiscoverRecommendations() {
    const grid = document.getElementById('discoverGrid');
    const lang = window.language || { getTranslation: (k) => k };

    if (!grid) return;

    try {
        discoverRecommendations = await ipcRenderer.invoke('get-personalized-recommendations', 8);
        renderDiscoverRecommendations(discoverRecommendations);
    } catch (error) {
        console.error('Error loading discover recommendations:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noDiscover') || 'No recommendations yet'}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || 'Start listening to get personalized recommendations'}</p>
            </div>
        `;
    }
}

function renderDiscoverRecommendations(recs) {
    const grid = document.getElementById('discoverGrid');
    const lang = window.language || { getTranslation: (k) => k };

    if (!grid) return;

    if (!recs || recs.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
                <h3>${lang.getTranslation('mainPage.noDiscover') || ''}</h3>
                <p>${lang.getTranslation('mainPage.startListening') || ''}</p>
            </div>
        `;
        return;
    }

    const recsHTML = recs.map((rec, index) => createDiscoverCard(rec, index)).join('');
    grid.innerHTML = recsHTML;

    const cards = grid.querySelectorAll('.discover-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rec = recs[index];
            if (rec) {
                playDiscoverTrack(rec);
            }
        });
    });
}

function createDiscoverCard(rec, index) {
    const imageUrl = rec.image || '';
    const lang = window.language || { getTranslation: (k) => k };
    let reasonText = '';
    if (rec.reasonKey) {
        const template = lang.getTranslation(`mainPage.${rec.reasonKey}`) || '';
        if (template && rec.reasonArtist) {
            reasonText = template.replace('{artist}', rec.reasonArtist);
        } else {
            reasonText = template || lang.getTranslation('mainPage.discoverReason') || '';
        }
    } else {
        reasonText = rec.reason || lang.getTranslation('mainPage.discoverReason') || '';
    }

    if (imageUrl) {
        return `
            <div class="recommendation-card discover-card" data-index="${index}">
                <div class="recommendation-card-image">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(rec.name)}" loading="lazy">
                    <button class="recommendation-play-btn" title="${(window.language || { t: (k) => k }).t('player.play')}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="recommendation-card-info">
                    <h3 class="recommendation-card-title" title="${escapeHtml(rec.name)}">${escapeHtml(rec.name)}</h3>
                    <p class="recommendation-card-artist" title="${escapeHtml(rec.artist)}">${escapeHtml(rec.artist)}</p>
                    <p class="discover-card-reason">${escapeHtml(reasonText)}</p>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="recommendation-card discover-card" data-index="${index}">
                <div class="recommendation-card-image">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <button class="recommendation-play-btn" title="${(window.language || { t: (k) => k }).t('player.play')}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="recommendation-card-info">
                    <h3 class="recommendation-card-title" title="${escapeHtml(rec.name)}">${escapeHtml(rec.name)}</h3>
                    <p class="recommendation-card-artist" title="${escapeHtml(rec.artist)}">${escapeHtml(rec.artist)}</p>
                    <p class="discover-card-reason">${escapeHtml(reasonText)}</p>
                </div>
            </div>
        `;
    }
}

function playDiscoverTrack(rec) {
    const track = {
        name: rec.name,
        artist: rec.artist,
        image: rec.image
    };
    ipcRenderer.send('request-exit-playlist-mode');
    ipcRenderer.send('request-play', track);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}