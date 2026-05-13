const { ipcRenderer } = require('electron');

let cachedOverview = null;
let cachedTopTracks = null;
let cachedTopArtists = null;
let cachedActivity = null;
let cachedDailyDuration = null;
let cachedCompletionRate = null;
let languageCallback = null;

async function initStatsPage() {
    try {
        const [overview, topTracks, topArtists, activity, dailyDuration, completionRate] = await Promise.all([
            ipcRenderer.invoke('get-stats-overview'),
            ipcRenderer.invoke('get-stats-top-tracks', 10),
            ipcRenderer.invoke('get-stats-top-artists', 10),
            ipcRenderer.invoke('get-stats-listening-activity', 7),
            ipcRenderer.invoke('get-stats-daily-listening-duration', 7),
            ipcRenderer.invoke('get-stats-completion-rate')
        ]);

        cachedOverview = overview;
        cachedTopTracks = topTracks;
        cachedTopArtists = topArtists;
        cachedActivity = activity;
        cachedDailyDuration = dailyDuration;
        cachedCompletionRate = completionRate;

        renderStats(overview, topTracks, topArtists, activity, dailyDuration, completionRate);

        languageCallback = () => {
            renderStats(cachedOverview, cachedTopTracks, cachedTopArtists, cachedActivity, cachedDailyDuration, cachedCompletionRate);
        };
        window.language.onLanguageChange(languageCallback);

    } catch (error) {
        console.error('Error loading stats:', error);
        renderError();
    }
}

function cleanupStatsPage() {
    if (languageCallback && window.language) {
        const idx = window.language.callbacks.indexOf(languageCallback);
        if (idx !== -1) {
            window.language.callbacks.splice(idx, 1);
        }
        languageCallback = null;
    }
}

function renderStats(overview, topTracks, topArtists, activity, dailyDuration, completionRate) {
    const lang = window.language || { t: (k) => k };
    const container = document.getElementById('statsContent');

    if (overview.totalPlays === 0) {
        container.innerHTML = `
            <div class="stats-empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
                <h2>${lang.t('stats.noData')}</h2>
                <p>${lang.t('stats.startListening')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${renderOverviewCards(overview, lang)}
        ${renderCompletionRate(completionRate, lang)}
        ${renderActivityChart(activity, lang)}
        ${renderDurationChart(dailyDuration, lang)}
        <div class="stats-grid">
            ${renderTopTracks(topTracks, lang)}
            ${renderTopArtists(topArtists, lang)}
        </div>
    `;
}

function renderOverviewCards(overview, lang) {
    const listeningTime = formatDuration(overview.totalListeningSeconds || 0, lang);

    return `
        <div class="stats-overview">
            <div class="stat-card">
                <div class="stat-icon plays">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
                <span class="stat-value">${formatNumber(overview.totalPlays)}</span>
                <span class="stat-label">${lang.t('stats.totalPlays')}</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon duration">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                </div>
                <span class="stat-value">${listeningTime}</span>
                <span class="stat-label">${lang.t('stats.totalListeningTime')}</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon tracks">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
                <span class="stat-value">${formatNumber(overview.uniqueTracks)}</span>
                <span class="stat-label">${lang.t('stats.uniqueTracks')}</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon artists">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                </div>
                <span class="stat-value">${formatNumber(overview.uniqueArtists)}</span>
                <span class="stat-label">${lang.t('stats.uniqueArtists')}</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon liked">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </div>
                <span class="stat-value">${formatNumber(overview.likedCount)}</span>
                <span class="stat-label">${lang.t('stats.likedSongs')}</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon favorites">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                </div>
                <span class="stat-value">${formatNumber(overview.favoritesCount)}</span>
                <span class="stat-label">${lang.t('stats.favorites')}</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon playlists">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/>
                    </svg>
                </div>
                <span class="stat-value">${formatNumber(overview.playlistsCount)}</span>
                <span class="stat-label">${lang.t('stats.playlists')}</span>
            </div>
        </div>
    `;
}

function renderCompletionRate(completionRate, lang) {
    if (!completionRate || completionRate.totalTracks === 0) {
        return '';
    }

    const percent = completionRate.avgCompletionPercent;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (percent / 100) * circumference;

    let statusText = '';
    let statusClass = '';
    if (percent >= 80) {
        statusText = lang.t('stats.completionHigh');
        statusClass = 'high';
    } else if (percent >= 50) {
        statusText = lang.t('stats.completionMedium');
        statusClass = 'medium';
    } else {
        statusText = lang.t('stats.completionLow');
        statusClass = 'low';
    }

    return `
        <div class="stats-section completion-rate-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.completionRate')}</h2>
            </div>
            <div class="completion-rate-content">
                <div class="completion-ring">
                    <svg viewBox="0 0 100 100" class="completion-svg">
                        <circle cx="50" cy="50" r="45" class="ring-bg"/>
                        <circle cx="50" cy="50" r="45" class="ring-progress ${statusClass}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}"/>
                    </svg>
                    <div class="completion-percent">
                        <span class="percent-value">${percent}%</span>
                    </div>
                </div>
                <div class="completion-details">
                    <p class="completion-status ${statusClass}">${statusText}</p>
                    <p class="completion-info">${lang.t('stats.completionInfo').replace('{completed}', completionRate.completedTracks).replace('{total}', completionRate.totalTracks)}</p>
                </div>
            </div>
        </div>
    `;
}

function renderActivityChart(activity, lang) {
    if (!activity || activity.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.listeningActivity')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noActivity')}</div>
                </div>
            </div>
        `;
    }

    const maxCount = Math.max(...activity.map(a => a.count), 1);

    const bars = activity.map(day => {
        const heightPercent = (day.count / maxCount) * 100;
        const dateLabel = formatDateLabel(day.date);
        return `
            <div class="activity-bar-wrapper">
                <div class="activity-bar" style="height: ${Math.max(heightPercent, 3)}%">
                    <span class="bar-tooltip">${day.count}</span>
                </div>
                <span class="activity-bar-label">${dateLabel}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.listeningActivity')}</h2>
            </div>
            <div class="activity-chart">
                <div class="activity-bars">
                    ${bars}
                </div>
            </div>
        </div>
    `;
}

function renderDurationChart(dailyDuration, lang) {
    if (!dailyDuration || dailyDuration.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.listeningDuration')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noActivity')}</div>
                </div>
            </div>
        `;
    }

    const maxSeconds = Math.max(...dailyDuration.map(d => d.total_seconds), 1);

    const bars = dailyDuration.map(day => {
        const heightPercent = (day.total_seconds / maxSeconds) * 100;
        const dateLabel = formatDateLabel(day.date);
        const durationLabel = formatDurationShort(day.total_seconds, lang);
        return `
            <div class="activity-bar-wrapper">
                <div class="activity-bar duration-bar" style="height: ${Math.max(heightPercent, 3)}%">
                    <span class="bar-tooltip">${durationLabel}</span>
                </div>
                <span class="activity-bar-label">${dateLabel}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.listeningDuration')}</h2>
            </div>
            <div class="activity-chart">
                <div class="activity-bars">
                    ${bars}
                </div>
            </div>
        </div>
    `;
}

function renderTopTracks(tracks, lang) {
    if (!tracks || tracks.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.topTracks')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noTopTracks')}</div>
                </div>
            </div>
        `;
    }

    const items = tracks.map((track, index) => {
        const rankClass = index < 3 ? `top-${index + 1}` : '';

        return `
            <div class="stats-list-item" data-track-id="${track.id}" onclick="playTrack(this)">
                <span class="stats-list-rank ${rankClass}">${index + 1}</span>
                <div class="stats-list-image">
                    ${track.image ? `<img src="${track.image}" alt="${escapeHtml(track.name)}">` : '<div class="stats-list-image artist-avatar" style="width:100%;height:100%;border-radius:8px;">♪</div>'}
                </div>
                <div class="stats-list-info">
                    <div class="stats-list-name">${escapeHtml(track.name)}</div>
                    <div class="stats-list-sub">${escapeHtml(track.artist || '')}</div>
                </div>
                <div class="stats-list-count">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    ${track.playCount} ${lang.t('stats.plays')}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.topTracks')}</h2>
            </div>
            <div class="stats-list">
                ${items}
            </div>
        </div>
    `;
}

function renderTopArtists(artists, lang) {
    if (!artists || artists.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.topArtists')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noTopArtists')}</div>
                </div>
            </div>
        `;
    }

    const colors = ['#e94560', '#667eea', '#4facfe', '#f093fb', '#fa709a', '#00f2fe', '#fee140', '#764ba2', '#f5576c', '#43e97b'];

    const items = artists.map((artist, index) => {
        const rankClass = index < 3 ? `top-${index + 1}` : '';
        const color = colors[index % colors.length];
        const initial = artist.name ? artist.name.charAt(0).toUpperCase() : '?';

        return `
            <div class="stats-list-item">
                <span class="stats-list-rank ${rankClass}">${index + 1}</span>
                <div class="stats-list-image artist-avatar" style="background: ${color}20; color: ${color};">
                    ${initial}
                </div>
                <div class="stats-list-info">
                    <div class="stats-list-name">${escapeHtml(artist.name)}</div>
                </div>
                <div class="stats-list-count">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    ${artist.playCount} ${lang.t('stats.plays')}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.topArtists')}</h2>
            </div>
            <div class="stats-list">
                ${items}
            </div>
        </div>
    `;
}

function playTrack(element) {
    const trackId = element.getAttribute('data-track-id');
    const name = element.querySelector('.stats-list-name')?.textContent || '';
    const artist = element.querySelector('.stats-list-sub')?.textContent || '';
    const img = element.querySelector('.stats-list-image img');
    const image = img ? img.src : '';

    if (trackId) {
        ipcRenderer.send('request-play', {
            id: trackId,
            name: name,
            artist: artist,
            image: image
        });
    }
}

function renderError() {
    const lang = window.language || { t: (k) => k };
    const container = document.getElementById('statsContent');
    container.innerHTML = `
        <div class="stats-empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h2>${lang.t('stats.error')}</h2>
            <p>${lang.t('stats.errorMessage')}</p>
        </div>
    `;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDuration(totalSeconds, lang) {
    if (!totalSeconds || totalSeconds <= 0) return '0';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        const hLabel = hours === 1 ? lang.t('stats.hour') : lang.t('stats.hours');
        if (minutes > 0) {
            const mLabel = lang.t('stats.minutesShort');
            return `${hours} ${hLabel} ${minutes} ${mLabel}`;
        }
        return `${hours} ${hLabel}`;
    }
    
    if (minutes > 0) {
        const mLabel = minutes === 1 ? lang.t('stats.minute') : lang.t('stats.minutes');
        return `${minutes} ${mLabel}`;
    }

    const secs = Math.floor(totalSeconds);
    const sLabel = lang.t('stats.seconds');
    return `${secs} ${sLabel}`;
}

function formatDurationShort(totalSeconds, lang) {
    if (!totalSeconds || totalSeconds <= 0) return '0m';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        const hShort = lang.t('stats.hoursShort');
        const mShort = lang.t('stats.minutesShort');
        return `${hours}${hShort} ${minutes}${mShort}`;
    }

    return `${minutes}${lang.t('stats.minutesShort')}`;
}

function formatDateLabel(dateStr) {
    try {
        const date = new Date(dateStr + 'T00:00:00');
        const lang = window.language || { getCurrentLanguage: () => 'en' };
        const locale = lang.getCurrentLanguage ? lang.getCurrentLanguage() : 'en';
        return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' });
    } catch {
        return dateStr;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initStatsPage, cleanupStatsPage };
