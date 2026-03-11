const { ipcRenderer } = require('electron');

let searchTimeout = null;

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
        }, 500);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        showEmptyState();
        searchInput.focus();
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
    try {
        const tracks = await ipcRenderer.invoke('search-track', query);
        displayResults(tracks);
    } catch (error) {
        console.error('Search error:', error);
        showErrorState();
    }
}

function displayResults(tracks) {
    const searchContent = document.getElementById('searchContent');
    const loadingState = document.getElementById('loadingState');

    loadingState.style.display = 'none';
    searchContent.style.display = 'block';

    if (!tracks || tracks.length === 0) {
        searchContent.innerHTML = `
            <div class="no-results">
                <h3>No results found</h3>
                <p>Try different keywords or check your spelling</p>
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

    loadingState.style.display = 'none';
    searchContent.style.display = 'block';
    searchContent.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <h2>Start searching</h2>
            <p>Find your favorite songs, artists, and albums</p>
        </div>
    `;
}

function showErrorState() {
    const searchContent = document.getElementById('searchContent');
    const loadingState = document.getElementById('loadingState');

    loadingState.style.display = 'none';
    searchContent.style.display = 'block';
    searchContent.innerHTML = `
        <div class="error-state">
            <h3>Something went wrong</h3>
            <p>Unable to fetch search results. Please try again.</p>
            <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
        </div>
    `;
}

function playTrack(trackName, artistName, imageUrl) {
    const trackInfoElement = document.querySelector('.track-info');
    const albumArtElement = document.querySelector('.album-art');

    if (trackInfoElement) {
        const trackNameElement = trackInfoElement.querySelector('.track-name');
        const artistNameElement = trackInfoElement.querySelector('.artist-name');

        if (trackNameElement) {
            trackNameElement.textContent = trackName;
        }
        if (artistNameElement) {
            artistNameElement.textContent = artistName;
        }
    }

    if (albumArtElement) {
        albumArtElement.classList.remove('gradient-1', 'gradient-2', 'gradient-3', 'gradient-4');

        if (imageUrl) {
            albumArtElement.style.backgroundImage = `url(${imageUrl})`;
            albumArtElement.style.backgroundSize = 'cover';
            albumArtElement.style.backgroundPosition = 'center';
        } else {
            const gradients = ['gradient-1', 'gradient-2', 'gradient-3', 'gradient-4'];
            const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
            albumArtElement.classList.add(randomGradient);
            albumArtElement.style.backgroundImage = '';
        }
    }

    console.log(`Playing: ${trackName} by ${artistName}`);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initSearchPage };
