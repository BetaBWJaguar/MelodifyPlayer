const { ipcRenderer } = require('electron');

let cachedOverview = null;
let cachedTopTracks = null;
let cachedTopArtists = null;
let cachedActivity = null;
let cachedDailyDuration = null;
let cachedCompletionRate = null;
let cachedSkipRate = null;
let cachedFirstPlayDate = null;
let cachedListeningStreak = null;
let cachedBusiestDay = null;
let cachedAvgPlaysPerDay = null;
let cachedTopGenres = null;
let cachedListeningByHour = null;
let cachedRecentTracks = null;
let languageCallback = null;

async function initStatsPage() {
    try {
        const [overview, topTracks, topArtists, activity, dailyDuration, completionRate, skipRate, firstPlayDate, listeningStreak, busiestDay, avgPlaysPerDay, topGenres, listeningByHour, recentTracks] = await Promise.all([
            ipcRenderer.invoke('get-stats-overview'),
            ipcRenderer.invoke('get-stats-top-tracks', 10),
            ipcRenderer.invoke('get-stats-top-artists', 10),
            ipcRenderer.invoke('get-stats-listening-activity', 7),
            ipcRenderer.invoke('get-stats-daily-listening-duration', 7),
            ipcRenderer.invoke('get-stats-completion-rate'),
            ipcRenderer.invoke('get-stats-skip-rate'),
            ipcRenderer.invoke('get-stats-first-play-date'),
            ipcRenderer.invoke('get-stats-listening-streak'),
            ipcRenderer.invoke('get-stats-busiest-day'),
            ipcRenderer.invoke('get-stats-avg-plays-per-day'),
            ipcRenderer.invoke('get-stats-top-genres', 5),
            ipcRenderer.invoke('get-stats-listening-time-by-hour'),
            ipcRenderer.invoke('get-stats-recent-tracks', 10)
        ]);

        cachedOverview = overview;
        cachedTopTracks = topTracks;
        cachedTopArtists = topArtists;
        cachedActivity = activity;
        cachedDailyDuration = dailyDuration;
        cachedCompletionRate = completionRate;
        cachedSkipRate = skipRate;
        cachedFirstPlayDate = firstPlayDate;
        cachedListeningStreak = listeningStreak;
        cachedBusiestDay = busiestDay;
        cachedAvgPlaysPerDay = avgPlaysPerDay;
        cachedTopGenres = topGenres;
        cachedListeningByHour = listeningByHour;
        cachedRecentTracks = recentTracks;

        renderStats(overview, topTracks, topArtists, activity, dailyDuration, completionRate, skipRate, firstPlayDate, listeningStreak, busiestDay, avgPlaysPerDay, topGenres, listeningByHour, recentTracks);

        languageCallback = () => {
            renderStats(cachedOverview, cachedTopTracks, cachedTopArtists, cachedActivity, cachedDailyDuration, cachedCompletionRate, cachedSkipRate, cachedFirstPlayDate, cachedListeningStreak, cachedBusiestDay, cachedAvgPlaysPerDay, cachedTopGenres, cachedListeningByHour, cachedRecentTracks);
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

function renderStats(overview, topTracks, topArtists, activity, dailyDuration, completionRate, skipRate, firstPlayDate, listeningStreak, busiestDay, avgPlaysPerDay, topGenres, listeningByHour, recentTracks) {
    const lang = window.language || { t: (k) => k };
    const container = document.getElementById('statsContent');
    const exportBtn = document.getElementById('exportBtn');

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
        if (exportBtn) exportBtn.style.display = 'none';
        return;
    }

    if (exportBtn) exportBtn.style.display = 'flex';

    container.innerHTML = `
        ${renderOverviewCards(overview, lang)}
        ${renderExtraStats(firstPlayDate, listeningStreak, busiestDay, avgPlaysPerDay, listeningByHour, lang)}
        <div class="stats-rate-grid">
            ${renderCompletionRate(completionRate, lang)}
            ${renderSkipRate(skipRate, lang)}
        </div>
        ${renderActivityChart(activity, lang)}
        ${renderDurationChart(dailyDuration, lang)}
        ${renderListeningByHour(listeningByHour, lang)}
        ${renderTopGenres(topGenres, lang)}
        <div class="stats-grid">
            ${renderTopTracks(topTracks, lang)}
            ${renderTopArtists(topArtists, lang)}
        </div>
        ${renderRecentTracks(recentTracks, lang)}
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

function renderSkipRate(skipRate, lang) {
    if (!skipRate || skipRate.totalTracks === 0) {
        return '';
    }

    const percent = skipRate.skipPercent;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (percent / 100) * circumference;

    let statusText = '';
    let statusClass = '';
    if (percent <= 20) {
        statusText = lang.t('stats.skipRateLow');
        statusClass = 'low';
    } else if (percent <= 50) {
        statusText = lang.t('stats.skipRateMedium');
        statusClass = 'medium';
    } else {
        statusText = lang.t('stats.skipRateHigh');
        statusClass = 'high';
    }

    return `
        <div class="stats-section skip-rate-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.skipRate')}</h2>
            </div>
            <div class="completion-rate-content">
                <div class="completion-ring">
                    <svg viewBox="0 0 100 100" class="completion-svg">
                        <circle cx="50" cy="50" r="45" class="ring-bg"/>
                        <circle cx="50" cy="50" r="45" class="ring-progress skip-ring ${statusClass}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}"/>
                    </svg>
                    <div class="completion-percent">
                        <span class="percent-value">${percent}%</span>
                    </div>
                </div>
                <div class="completion-details">
                    <p class="completion-status ${statusClass}">${statusText}</p>
                    <p class="completion-info">${lang.t('stats.skipRateInfo').replace('{skipped}', skipRate.skippedTracks).replace('{total}', skipRate.totalTracks)}</p>
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

function renderExtraStats(firstPlayDate, listeningStreak, busiestDay, avgPlaysPerDay, listeningByHour, lang) {
    const peakHour = getPeakHour(listeningByHour);

    const cards = [
        {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
            label: lang.t('stats.firstPlayDate'),
            value: firstPlayDate ? formatDateShort(firstPlayDate, lang) : '-',
            color: '#764ba2',
            iconClass: 'first-play'
        },
        {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>`,
            label: lang.t('stats.listeningStreak'),
            value: `${listeningStreak} ${lang.t('stats.days')}`,
            color: '#f5576c',
            iconClass: 'streak'
        },
        {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`,
            label: lang.t('stats.busiestDay'),
            value: busiestDay ? lang.t('stats.' + busiestDay.day) : '-',
            color: '#fee140',
            iconClass: 'busiest'
        },
        {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
            label: lang.t('stats.avgPlaysPerDay'),
            value: avgPlaysPerDay.toString(),
            color: '#43e97b',
            iconClass: 'avg-plays'
        },
        {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
            label: lang.t('stats.peakHour'),
            value: peakHour !== null ? `${peakHour}:00` : '-',
            color: '#4facfe',
            iconClass: 'peak-hour'
        }
    ];

    const cardsHtml = cards.map(card => `
        <div class="extra-stat-card">
            <div class="extra-stat-icon" style="background: ${card.color}15; color: ${card.color};">
                ${card.icon}
            </div>
            <div class="extra-stat-info">
                <span class="extra-stat-label">${card.label}</span>
                <span class="extra-stat-value" style="color: ${card.color};">${card.value}</span>
            </div>
        </div>
    `).join('');

    return `
        <div class="extra-stats-grid">
            ${cardsHtml}
        </div>
    `;
}

function renderListeningByHour(listeningByHour, lang) {
    if (!listeningByHour || listeningByHour.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.listeningByHour')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noActivity')}</div>
                </div>
            </div>
        `;
    }

    const maxPlayCount = Math.max(...listeningByHour.map(h => h.playCount), 1);
    const peakHour = getPeakHour(listeningByHour);

    const hourMap = {};
    listeningByHour.forEach(h => { hourMap[h.hour] = h.playCount; });

    const bars = [];
    for (let h = 0; h < 24; h++) {
        const count = hourMap[h] || 0;
        const heightPercent = (count / maxPlayCount) * 100;
        const isPeak = h === peakHour;
        bars.push(`
            <div class="hour-bar-wrapper">
                <div class="hour-bar ${isPeak ? 'peak' : ''} ${count === 0 ? 'empty' : ''}" style="height: ${Math.max(heightPercent, count > 0 ? 3 : 0)}%">
                    ${count > 0 ? `<span class="bar-tooltip">${count}</span>` : ''}
                </div>
                ${h % 3 === 0 ? `<span class="hour-bar-label">${h}</span>` : '<span class="hour-bar-label"></span>'}
            </div>
        `);
    }

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.listeningByHour')}</h2>
                ${peakHour !== null ? `<span class="stats-section-subtitle">${lang.t('stats.peakHourInfo').replace('{hour}', peakHour)}</span>` : ''}
            </div>
            <div class="activity-chart">
                <div class="hour-bars">
                    ${bars.join('')}
                </div>
            </div>
        </div>
    `;
}

function renderTopGenres(topGenres, lang) {
    if (!topGenres || topGenres.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.topGenres')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noGenres')}</div>
                </div>
            </div>
        `;
    }

    const genreColors = ['#e94560', '#667eea', '#4facfe', '#f093fb', '#fa709a'];
    const maxCount = Math.max(...topGenres.map(g => g.playCount), 1);

    const items = topGenres.map((genre, index) => {
        const color = genreColors[index % genreColors.length];
        const barWidth = (genre.playCount / maxCount) * 100;

        return `
            <div class="genre-item">
                <div class="genre-info">
                    <span class="genre-dot" style="background: ${color};"></span>
                    <span class="genre-name">${escapeHtml(genre.genre)}</span>
                </div>
                <div class="genre-bar-container">
                    <div class="genre-bar" style="width: ${barWidth}%; background: ${color};"></div>
                </div>
                <span class="genre-count">${genre.playCount} ${lang.t('stats.plays')}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.topGenres')}</h2>
            </div>
            <div class="activity-chart">
                <div class="genre-list">
                    ${items}
                </div>
            </div>
        </div>
    `;
}

function renderRecentTracks(recentTracks, lang) {
    if (!recentTracks || recentTracks.length === 0) {
        return `
            <div class="stats-section">
                <div class="stats-section-header">
                    <h2>${lang.t('stats.recentTracks')}</h2>
                </div>
                <div class="activity-chart">
                    <div class="activity-empty">${lang.t('stats.noRecentTracks')}</div>
                </div>
            </div>
        `;
    }

    const items = recentTracks.map((track, index) => {
        const timeAgo = formatTimeAgo(track.played_at, lang);

        return `
            <div class="stats-list-item" data-track-id="${track.id}" onclick="playTrack(this)">
                <div class="stats-list-image">
                    ${track.image ? `<img src="${track.image}" alt="${escapeHtml(track.name)}">` : '<div class="stats-list-image artist-avatar" style="width:100%;height:100%;border-radius:8px;">♪</div>'}
                </div>
                <div class="stats-list-info">
                    <div class="stats-list-name">${escapeHtml(track.name)}</div>
                    <div class="stats-list-sub">${escapeHtml(track.artist || '')}</div>
                </div>
                <div class="stats-list-count recent-time">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                    ${timeAgo}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-section">
            <div class="stats-section-header">
                <h2>${lang.t('stats.recentTracks')}</h2>
            </div>
            <div class="stats-list">
                ${items}
            </div>
        </div>
    `;
}

function formatTimeAgo(dateStr, lang) {
    try {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} ${diffDays === 1 ? lang.t('stats.day') : lang.t('stats.days')}`;
        } else if (diffHours > 0) {
            return `${diffHours} ${diffHours === 1 ? lang.t('stats.hour') : lang.t('stats.hours')}`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} ${diffMinutes === 1 ? lang.t('stats.minute') : lang.t('stats.minutes')}`;
        } else {
            return lang.t('stats.seconds');
        }
    } catch {
        return '';
    }
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

async function exportStats() {
    const lang = window.language || { t: (k) => k };
    const exportBtn = document.getElementById('exportBtn');

    try {
        exportBtn.classList.add('exporting');

        const canvas = generateStatsCanvas(lang);
        const dataUrl = canvas.toDataURL('image/png');

        const result = await ipcRenderer.invoke('export-stats-image', dataUrl);

        exportBtn.classList.remove('exporting');

        if (result.success) {
            showExportToast(lang.t('stats.exportSuccess'), 'success');
        } else if (!result.canceled) {
            showExportToast(lang.t('stats.exportError'), 'error');
        }
    } catch (error) {
        console.error('Export error:', error);
        if (exportBtn) exportBtn.classList.remove('exporting');
        showExportToast(lang.t('stats.exportError'), 'error');
    }
}

function generateStatsCanvas(lang) {
    const overview = cachedOverview;
    const topTracks = cachedTopTracks;
    const topArtists = cachedTopArtists;
    const completionRate = cachedCompletionRate;
    const skipRate = cachedSkipRate;
    const activity = cachedActivity;
    const dailyDuration = cachedDailyDuration;
    const firstPlayDate = cachedFirstPlayDate;
    const listeningStreak = cachedListeningStreak;
    const busiestDay = cachedBusiestDay;
    const avgPlaysPerDay = cachedAvgPlaysPerDay;
    const topGenres = cachedTopGenres;
    const listeningByHour = cachedListeningByHour;

    const W = 800;
    const cardH = 180;
    const padding = 32;
    const rowH = 32;

    const topTracksCount = Math.min(topTracks ? topTracks.length : 0, 5);
    const topArtistsCount = Math.min(topArtists ? topArtists.length : 0, 5);
    const listBlockH = 40 + topTracksCount * rowH;
    const listBlock2H = 40 + topArtistsCount * rowH;

    const extraStatsH = 70;
    const activityChartH = 160;
    const durationChartH = 160;
    const hourChartH = 160;
    const genresH = topGenres && topGenres.length > 0 ? 40 + Math.min(topGenres.length, 5) * 28 : 0;

    const totalH = padding + 50 + cardH + 20 + 60 + 20 + extraStatsH + 20 +
        activityChartH + 20 + durationChartH + 20 + hourChartH + 20 +
        (genresH > 0 ? genresH + 20 : 0) +
        Math.max(listBlockH, listBlock2H) + padding;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, W, totalH);
    bgGrad.addColorStop(0, '#1a1a2e');
    bgGrad.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, totalH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('🎵 Melodify Stats', padding, padding + 30);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const dateStr = new Date().toLocaleDateString(lang.getCurrentLanguage ? (lang.getCurrentLanguage() === 'tr' ? 'tr-TR' : 'en-US') : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.fillText(dateStr, padding, padding + 50);

    let y = padding + 70;
    const cardW = (W - padding * 2 - 16 * 6) / 7;
    const cards = [
        { label: lang.t('stats.totalPlays'), value: formatNumber(overview.totalPlays), color: '#e94560' },
        { label: lang.t('stats.totalListeningTime'), value: formatDuration(overview.totalListeningSeconds || 0, lang), color: '#43e97b' },
        { label: lang.t('stats.uniqueTracks'), value: formatNumber(overview.uniqueTracks), color: '#4facfe' },
        { label: lang.t('stats.uniqueArtists'), value: formatNumber(overview.uniqueArtists), color: '#667eea' },
        { label: lang.t('stats.likedSongs'), value: formatNumber(overview.likedCount), color: '#f093fb' },
        { label: lang.t('stats.favorites'), value: formatNumber(overview.favoritesCount), color: '#fa709a' },
        { label: lang.t('stats.playlists'), value: formatNumber(overview.playlistsCount), color: '#00f2fe' }
    ];

    cards.forEach((card, i) => {
        const cx = padding + i * (cardW + 16);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(ctx, cx, y, cardW, cardH, 12);
        ctx.fill();

        ctx.fillStyle = card.color;
        ctx.beginPath();
        ctx.arc(cx + 16, y + 20, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(truncateText(ctx, card.value, cardW - 20), cx + 12, y + 55);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(truncateText(ctx, card.label, cardW - 20), cx + 12, y + 78);
    });

    y += cardH + 20;
    const rateW = (W - padding * 2 - 16) / 2;

    if (completionRate && completionRate.totalTracks > 0) {
        drawRateCard(ctx, padding, y, rateW, 50, lang.t('stats.completionRate'), completionRate.avgCompletionPercent + '%', completionRate.avgCompletionPercent >= 80 ? '#43e97b' : completionRate.avgCompletionPercent >= 50 ? '#fee140' : '#e94560');
    }

    if (skipRate && skipRate.totalTracks > 0) {
        drawRateCard(ctx, padding + rateW + 16, y, rateW, 50, lang.t('stats.skipRate'), skipRate.skipPercent + '%', skipRate.skipPercent <= 20 ? '#43e97b' : skipRate.skipPercent <= 50 ? '#fee140' : '#e94560');
    }

    y += 60 + 20;
    const extraCardW = (W - padding * 2 - 16 * 4) / 5;
    const peakHour = getPeakHour(listeningByHour);
    const extraCards = [
        { label: lang.t('stats.firstPlayDate'), value: firstPlayDate ? formatDateShort(firstPlayDate, lang) : '-', color: '#764ba2' },
        { label: lang.t('stats.listeningStreak'), value: listeningStreak + ' ' + lang.t('stats.days'), color: '#f5576c' },
        { label: lang.t('stats.busiestDay'), value: busiestDay ? lang.t('stats.' + busiestDay.day) : '-', color: '#fee140' },
        { label: lang.t('stats.avgPlaysPerDay'), value: avgPlaysPerDay.toString(), color: '#43e97b' },
        { label: lang.t('stats.peakHour'), value: peakHour !== null ? peakHour + ':00' : '-', color: '#4facfe' }
    ];

    extraCards.forEach((card, i) => {
        const cx = padding + i * (extraCardW + 16);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(ctx, cx, y, extraCardW, 60, 10);
        ctx.fill();

        ctx.fillStyle = card.color;
        roundRectLeft(ctx, cx, y, 4, 60, 10);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(truncateText(ctx, card.label, extraCardW - 20), cx + 14, y + 22);

        ctx.fillStyle = card.color;
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(truncateText(ctx, card.value, extraCardW - 20), cx + 14, y + 46);
    });

    y += 70 + 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(lang.t('stats.listeningActivity'), padding, y + 16);

    if (activity && activity.length > 0) {
        const chartX = padding;
        const chartY = y + 30;
        const chartW = W - padding * 2;
        const chartH = 100;
        const barW = Math.max(Math.min((chartW - (activity.length - 1) * 8) / activity.length, 60), 20);
        const totalBarsW = activity.length * barW + (activity.length - 1) * 8;
        const startX = chartX + (chartW - totalBarsW) / 2;
        const maxCount = Math.max(...activity.map(a => a.count), 1);

        activity.forEach((day, i) => {
            const bx = startX + i * (barW + 8);
            const heightPercent = day.count / maxCount;
            const barHeight = Math.max(heightPercent * chartH, 4);
            const by = chartY + chartH - barHeight;

            const barGrad = ctx.createLinearGradient(bx, by, bx, chartY + chartH);
            barGrad.addColorStop(0, '#e94560');
            barGrad.addColorStop(1, '#e9456060');
            ctx.fillStyle = barGrad;
            roundRect(ctx, bx, by, barW, barHeight, 4);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(day.count.toString(), bx + barW / 2, by - 4);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(formatDateLabel(day.date), bx + barW / 2, chartY + chartH + 14);
            ctx.textAlign = 'left';
        });
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(lang.t('stats.noActivity'), padding, y + 50);
    }

    y += activityChartH + 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(lang.t('stats.listeningDuration'), padding, y + 16);

    if (dailyDuration && dailyDuration.length > 0) {
        const chartX = padding;
        const chartY = y + 30;
        const chartW = W - padding * 2;
        const chartH = 100;
        const barW = Math.max(Math.min((chartW - (dailyDuration.length - 1) * 8) / dailyDuration.length, 60), 20);
        const totalBarsW = dailyDuration.length * barW + (dailyDuration.length - 1) * 8;
        const startX = chartX + (chartW - totalBarsW) / 2;
        const maxSeconds = Math.max(...dailyDuration.map(d => d.total_seconds), 1);

        dailyDuration.forEach((day, i) => {
            const bx = startX + i * (barW + 8);
            const heightPercent = day.total_seconds / maxSeconds;
            const barHeight = Math.max(heightPercent * chartH, 4);
            const by = chartY + chartH - barHeight;

            const barGrad = ctx.createLinearGradient(bx, by, bx, chartY + chartH);
            barGrad.addColorStop(0, '#43e97b');
            barGrad.addColorStop(1, '#43e97b60');
            ctx.fillStyle = barGrad;
            roundRect(ctx, bx, by, barW, barHeight, 4);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(formatDurationShort(day.total_seconds, lang), bx + barW / 2, by - 4);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(formatDateLabel(day.date), bx + barW / 2, chartY + chartH + 14);
            ctx.textAlign = 'left';
        });
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(lang.t('stats.noActivity'), padding, y + 50);
    }

    y += durationChartH + 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(lang.t('stats.listeningByHour'), padding, y + 16);

    if (listeningByHour && listeningByHour.length > 0) {
        const chartX = padding;
        const chartY = y + 30;
        const chartW = W - padding * 2;
        const chartH = 90;
        const barW = Math.max((chartW - 23 * 4) / 24, 8);
        const maxPlayCount = Math.max(...listeningByHour.map(h => h.playCount), 1);

        const hourMap = {};
        listeningByHour.forEach(h => { hourMap[h.hour] = h.playCount; });

        for (let h = 0; h < 24; h++) {
            const bx = chartX + h * (barW + 4);
            const count = hourMap[h] || 0;
            const heightPercent = count / maxPlayCount;
            const barHeight = Math.max(heightPercent * chartH, count > 0 ? 3 : 0);
            const by = chartY + chartH - barHeight;

            if (count > 0) {
                const isPeak = h === peakHour;
                const barGrad = ctx.createLinearGradient(bx, by, bx, chartY + chartH);
                barGrad.addColorStop(0, isPeak ? '#fee140' : '#667eea');
                barGrad.addColorStop(1, isPeak ? '#fee14060' : '#667eea60');
                ctx.fillStyle = barGrad;
                roundRect(ctx, bx, by, barW, barHeight, 2);
                ctx.fill();
            }

            if (h % 3 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(h.toString(), bx + barW / 2, chartY + chartH + 14);
                ctx.textAlign = 'left';
            }
        }
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(lang.t('stats.noActivity'), padding, y + 50);
    }

    y += hourChartH + 20;
    if (topGenres && topGenres.length > 0) {
        const genreColors = ['#e94560', '#667eea', '#4facfe', '#f093fb', '#fa709a'];
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(lang.t('stats.topGenres'), padding, y + 16);

        topGenres.slice(0, 5).forEach((genre, i) => {
            const gy = y + 36 + i * 28;
            ctx.fillStyle = genreColors[i % genreColors.length];
            ctx.beginPath();
            ctx.arc(padding + 8, gy + 4, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(truncateText(ctx, genre.genre, 300), padding + 22, gy + 8);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`${genre.playCount} ${lang.t('stats.plays')}`, padding + 340, gy + 8);
        });

        y += genresH + 20;
    }

    const halfW = (W - padding * 2 - 16) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(lang.t('stats.topTracks'), padding, y + 16);

    if (topTracks && topTracks.length > 0) {
        topTracks.slice(0, 5).forEach((track, i) => {
            const ty = y + 40 + i * rowH;
            ctx.fillStyle = i < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : 'rgba(255,255,255,0.4)';
            ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`${i + 1}`, padding, ty + 12);

            ctx.fillStyle = '#ffffff';
            ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const name = truncateText(ctx, track.name, halfW - 80);
            ctx.fillText(name, padding + 24, ty + 12);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`${track.playCount} ${lang.t('stats.plays')}`, padding + halfW - 70, ty + 12);
        });
    }

    const ax = padding + halfW + 16;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(lang.t('stats.topArtists'), ax, y + 16);

    if (topArtists && topArtists.length > 0) {
        const colors = ['#e94560', '#667eea', '#4facfe', '#f093fb', '#fa709a'];
        topArtists.slice(0, 5).forEach((artist, i) => {
            const ty = y + 40 + i * rowH;
            ctx.fillStyle = i < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : 'rgba(255,255,255,0.4)';
            ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`${i + 1}`, ax, ty + 12);

            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.arc(ax + 20, ty + 8, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const name = truncateText(ctx, artist.name, halfW - 90);
            ctx.fillText(name, ax + 32, ty + 12);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`${artist.playCount} ${lang.t('stats.plays')}`, ax + halfW - 70, ty + 12);
        });
    }

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Melodify Player', W - padding, totalH - 12);
    ctx.textAlign = 'left';

    return canvas;
}

function drawRateCard(ctx, x, y, w, h, label, value, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();

    ctx.fillStyle = color;
    roundRectLeft(ctx, x, y, 4, h, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(label, x + 14, y + 20);

    ctx.fillStyle = color;
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(value, x + 14, y + 42);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function roundRectLeft(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}
window.exportStats = exportStats;
window.playTrack = playTrack;

function showExportToast(message, type) {
    const existing = document.querySelector('.export-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `export-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    if (!totalSeconds || totalSeconds <= 0) return `0${lang.t('stats.secondsShort')}`;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
        const hShort = lang.t('stats.hoursShort');
        const mShort = lang.t('stats.minutesShort');
        const sShort = lang.t('stats.secondsShort');
        return `${hours}${hShort} ${minutes}${mShort} ${seconds}${sShort}`;
    }

    if (minutes > 0) {
        const mShort = lang.t('stats.minutesShort');
        const sShort = lang.t('stats.secondsShort');
        return `${minutes}${mShort} ${seconds}${sShort}`;
    }

    return `${seconds}${lang.t('stats.secondsShort')}`;
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

function getPeakHour(listeningByHour) {
    if (!listeningByHour || listeningByHour.length === 0) return null;
    let maxHour = null;
    let maxCount = 0;
    listeningByHour.forEach(h => {
        if (h.playCount > maxCount) {
            maxCount = h.playCount;
            maxHour = h.hour;
        }
    });
    return maxHour;
}

function formatDateShort(dateStr, lang) {
    try {
        const date = new Date(dateStr);
        const locale = lang.getCurrentLanguage ? lang.getCurrentLanguage() : 'en';
        return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

export { initStatsPage, cleanupStatsPage };
