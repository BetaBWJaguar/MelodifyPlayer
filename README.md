<div align="center">

# 🎵 MelodifyPlayer

**A feature-rich desktop music player built with Electron.js**

*Search, stream, download, and organize your music — all in one place.*

[![Electron](https://img.shields.io/badge/Electron-40.x-9FEAF9.svg?logo=electron)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg?logo=windows)](https://github.com/TunaRP/MelodifyPlayer)

</div>

## ✨ Features

### 🎶 Music Playback
- **YouTube-powered streaming** — Search and play any song from YouTube
- **MPV audio engine** — High-quality audio playback via MPV player
- **Full playback controls** — Play, pause, stop, seek, next, previous
- **Repeat modes** — Repeat one, repeat all, or no repeat
- **Shuffle mode** — Randomize your queue
- **Media keys support** — Control playback with your keyboard's media keys (Play/Pause, Next, Previous, Stop)
- **Volume control** — Adjustable volume slider

### 🔍 Smart Search
- **Last.fm + YouTube integration** — Search tracks using Last.fm API and stream from YouTube
- **Real-time results** — Instant search with up to 24 results per query
- **Search caching** — Recent searches are cached for faster loading
- **Cancel support** — Cancel ongoing searches instantly

### 📋 Playlist Management
- **Create custom playlists** — Organize your music into unlimited playlists
- **Add/Remove songs** — Easily manage songs within playlists
- **Reorder songs** — Drag and drop to reorder tracks in playlists
- **Playlist playback** — Play entire playlists with repeat and shuffle support
- **Edit playlists** — Rename and modify existing playlists

### ❤️ Liked Songs
- **One-click like** — Heart any song to save it to your liked songs
- **Dedicated liked songs page** — Browse and play all your liked tracks
- **Quick access** — Sidebar shortcut for instant access

### ⭐ Favorites
- **Favorite with notes** — Add personal notes to your favorite tracks
- **Custom ordering** — Drag and drop to reorder favorites
- **Dedicated favorites page** — Manage all your favorited tracks in one place

### 📥 Music Download
- **yt-dlp powered** — Download tracks directly from YouTube
- **Download progress** — Real-time progress tracking
- **Download management** — View, play, and delete downloaded tracks
- **Auto file naming** — Clean, sanitized filenames for downloaded files
- **Custom download directory** — Files saved to `MelodifyDownloads` in your Downloads folder

### 🎤 Lyrics
- **Synced lyrics** — Real-time synchronized lyrics display
- **Auto-scroll** — Lyrics scroll automatically as the song plays
- **Line highlighting** — Current line is highlighted for easy following

### 🎯 Recommendations
- **Personalized suggestions** — AI-powered recommendations based on your listening history
- **Last.fm integration** — Uses Last.fm's recommendation engine
- **Smart caching** — Recommendations are cached and refreshed periodically
- **Based on favorites & liked songs** — Recommendations improve over time

### 📊 Statistics & Analytics
- **Overview dashboard** — Total plays, unique tracks, unique artists, total listening time
- **Top tracks** — Most played tracks with play counts
- **Top artists** — Most listened to artists
- **Listening activity** — Daily/weekly listening activity charts
- **Completion rate** — Track how often you finish songs
- **Skip rate** — See how often you skip tracks
- **Listening streak** — Track your consecutive listening days
- **Busiest day** — Find your most active listening day
- **Average plays per day** — Your daily listening average
- **Top categories** — Most listened to music genres
- **Listening time by hour** — See when you listen to music most
- **Export stats** — Save your statistics as PNG images

### 📚 Library
- **All-in-one library** — Browse all your music in one place
- **Downloaded tracks** — Access your offline music collection
- **Playlists overview** — Quick access to all your playlists

### 🌍 Multi-Language Support (i18n)
- **English** 🇬🇧 — Full English translation
- **Turkish** 🇹🇷 — Full Turkish translation
- **Easy to extend** — Add new languages by creating a JSON file in `locales/`

### 🎨 Modern UI
- **Custom frameless window** — Sleek, borderless design
- **Dark theme** — Easy on the eyes with a modern dark color scheme
- **Responsive sidebar** — Quick navigation between all pages
- **Smooth animations** — Fluid transitions and micro-interactions
- **SVG icons** — Crisp, scalable icons throughout the UI

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| [Electron.js](https://www.electronjs.org/) v40 | Desktop application framework |
| [Node.js](https://nodejs.org/) | Runtime environment |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Local SQLite database |
| [MPV Player](https://mpv.io/) | Audio playback engine |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | YouTube downloading |
| [Python](https://www.python.org/) | MPV subprocess management |
| [Last.fm API](https://www.last.fm/api) | Music metadata, search & recommendations |
| [undici](https://github.com/nodejs/undici) | HTTP client |
| [yt-search](https://github.com/talmobi/yt-search) | YouTube search |

---

## 📁 Project Structure

```
MelodifyPlayer/
├── main.js                          # Electron main process
├── package.json                     # Project configuration
├── MelodifyPlayer2.png              # Application icon
├── melodify.db                      # SQLite database
│
├── backend/
│   └── utils/
│       ├── dbPath.js                # Database path resolver
│       ├── downloadModule.js        # yt-dlp download manager
│       ├── favorites.js             # Favorites CRUD operations
│       ├── genreCategories.js       # Music genre categorization
│       ├── historyModule.js         # Listening history tracker
│       ├── language.js              # i18n language manager
│       ├── lastfmModule.js          # Last.fm API integration
│       ├── likedSongs.js            # Liked songs CRUD operations
│       ├── logger.js                # Logging utility
│       ├── playSongs.js             # Core player logic
│       ├── playlist.js              # Playlist CRUD operations
│       ├── pythonPlayer.js          # MPV/Python subprocess bridge
│       ├── recommendationModule.js  # Personalized recommendations
│       ├── searchModule.js          # Track search engine
│       ├── statsModule.js           # Statistics & analytics
│       ├── youtubeModule.js         # YouTube URL resolver
│       └── youtubePlayer.py         # Python MPV player script
│
├── pages/
│   ├── index.html                   # Main app shell (sidebar + player bar)
│   ├── create-playlist/             # Create/edit playlist page
│   ├── favorites/                   # Favorites management page
│   ├── library/                     # Music library page
│   ├── liked_songs/                 # Liked songs page
│   ├── lyrics/                      # Synced lyrics page
│   ├── main-page/                   # Home page with recommendations
│   ├── search/                      # Search page
│   └── stats/                       # Statistics dashboard page
│
├── scripts/
│   └── index.js                     # Renderer process main script
│
├── styles/
│   └── index.css                    # Global styles
│
├── locales/
│   ├── en.json                      # English translations
│   └── tr.json                      # Turkish translations
│
└── build/
    └── afterPack.js                 # Electron-builder afterPack hook
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

- **[Node.js](https://nodejs.org/)** (v18 or higher)
- **[Python](https://www.python.org/)** (3.7 or higher)
- **[MPV Player](https://mpv.io/)** — Must be available in your system PATH
- **Windows 10/11** (currently only Windows is supported)

### External Dependencies

You'll also need to set up the following external tools:

1. **yt-dlp** — Download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) and place `yt-dlp.exe` in:
   ```
   yt-dlp/yt-dlp.exe
   ```

2. **MPV Player** — Download from [mpv.io](https://mpv.io/installation/) and place `mpv.exe` in:
   ```
   mpv/mpv.exe
   ```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Media Play/Pause` | Toggle play/pause |
| `Media Next Track` | Play next track |
| `Media Previous Track` | Play previous track |

---

## 🗄️ Database

MelodifyPlayer uses **SQLite** (via `better-sqlite3`) for local data storage. The database file (`melodify.db`) stores:

- **`play_history`** — Listening history with timestamps, durations, and categories
- **`liked_songs`** — Liked songs with metadata
- **`favorites`** — Favorited songs with custom notes and ordering
- **`playlists`** — User-created playlists
- **`playlist_songs`** — Songs within playlists with ordering

---

## 🌐 API Integrations

### Last.fm API
MelodifyPlayer uses the Last.fm API for:
- **Track search** — Find tracks by name/artist
- **Similar tracks** — Get track recommendations
- **Artist info** — Fetch artist metadata and images
- **Genre tags** — Categorize music by genre
- **Recommendations** — Personalized track suggestions

---
### Adding a New Language

1. Create a new JSON file in `locales/` (e.g., `locales/de.json`)
2. Copy the structure from `locales/en.json`
3. Translate all values to the new language
4. The language will automatically be available in the app

---
## 👤 Author
**Tuna Rasim OCAK**

