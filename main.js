const { app, BrowserWindow, ipcMain } = require('electron');
const { searchTrack } = require('./backend/utils/searchModule');
const player = require('./backend/utils/playSongs');
const likedSongs = require('./backend/utils/likedSongs');
const favorites = require('./backend/utils/favorites');
const playlist = require('./backend/utils/playlist');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 510,
        frame: false,
        titleBarStyle: 'hidden',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('pages/index.html');

    mainWindow.maximize();

    mainWindow.webContents.on('context-menu', (e) => {
        e.preventDefault();
    });


    mainWindow.on('system-context-menu', (event, point) => {
        event.preventDefault();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
app.whenReady().then(async () => {
    likedSongs.initDatabase();
    favorites.initDatabase();
    playlist.initDatabase();
    
    
    app.on('browser-window-created', (_, window) => {
        window.webContents.on('context-menu', (e) => {
            e.preventDefault();
        });
    });
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.handle('search-track', async (event, query) => {
    try {
        const results = await searchTrack(query, 24);
        return results;
    } catch (error) {
        console.error('Search error:', error);
        throw error;
    }
});


ipcMain.on('request-play', (event, track) => {
    player.play(track);
});

ipcMain.on('request-stop', () => {
    player.stop();
});

ipcMain.on('request-pause', () => {
    player.pause();
});

ipcMain.on('request-resume', () => {
    player.resume();
});

ipcMain.on('request-seek', (event, position) => {
    player.seek(position);
});

ipcMain.on('request-volume', (event, volume) => {
    player.setVolume(volume);
});

ipcMain.on('request-repeat', (event, repeat) => {
    player.setRepeat(repeat);
});

ipcMain.on('request-shuffle', (event, shuffle) => {
    player.setShuffle(shuffle);
});

ipcMain.on('request-next', () => {
    player.playNext();
});

ipcMain.on('request-previous', () => {
    player.playPrevious();
});

ipcMain.on('request-play-history', (event, index) => {
    player.playHistoryItem(index);
});

ipcMain.handle('get-history', () => {
    return player.getHistory();
});

ipcMain.handle('get-player-status', () => {
    return player.getStatus();
});

ipcMain.on('request-like-song', (event, track) => {
    likedSongs.addLikedSong(track);
});

ipcMain.on('request-unlike-song', (event, trackId) => {
    likedSongs.removeLikedSong(trackId);
});

ipcMain.handle('check-is-liked', (event, trackId) => {
    return likedSongs.isLiked(trackId);
});

ipcMain.handle('get-liked-songs', () => {
    return likedSongs.getAllLikedSongs();
});

ipcMain.on('request-favorite-song', (event, track) => {
    favorites.addFavorite(track);
});

ipcMain.on('request-unfavorite-song', (event, trackId) => {
    favorites.removeFavorite(trackId);
});

ipcMain.handle('check-is-favorite', (event, trackId) => {
    return favorites.isFavorite(trackId);
});

ipcMain.handle('get-favorites', () => {
    return favorites.getAllFavorites();
});

ipcMain.handle('update-favorite-notes', (event, trackId, notes) => {
    return favorites.updateFavoriteNotes(trackId, notes);
});

ipcMain.handle('update-favorite-order', (event, trackId, newOrder) => {
    return favorites.updateFavoriteOrder(trackId, newOrder);
});

ipcMain.handle('reorder-favorites', (event, draggedId, targetId) => {
    return favorites.reorderFavorites(draggedId, targetId);
});

ipcMain.handle('create-playlist', async (event, playlistData) => {
    try {
        const result = playlist.createPlaylist(playlistData);
        return result;
    } catch (error) {
        console.error('Error creating playlist:', error);
        throw error;
    }
});

ipcMain.handle('get-all-playlists', async () => {
    try {
        const playlists = playlist.getAllPlaylists();
        return playlists;
    } catch (error) {
        console.error('Error getting playlists:', error);
        throw error;
    }
});

ipcMain.handle('get-playlist-by-id', async (event, playlistId) => {
    try {
        const playlistData = playlist.getPlaylistById(playlistId);
        return playlistData;
    } catch (error) {
        console.error('Error getting playlist:', error);
        throw error;
    }
});

ipcMain.handle('update-playlist', async (event, playlistId, playlistData) => {
    try {
        const result = playlist.updatePlaylist(playlistId, playlistData);
        return result;
    } catch (error) {
        console.error('Error updating playlist:', error);
        throw error;
    }
});

ipcMain.handle('delete-playlist', async (event, playlistId) => {
    try {
        const result = playlist.deletePlaylist(playlistId);
        return result;
    } catch (error) {
        console.error('Error deleting playlist:', error);
        throw error;
    }
});

ipcMain.handle('add-song-to-playlist', async (event, playlistId, track) => {
    try {
        const result = playlist.addSongToPlaylist(playlistId, track);
        return result;
    } catch (error) {
        console.error('Error adding song to playlist:', error);
        throw error;
    }
});

ipcMain.handle('remove-song-from-playlist', async (event, playlistId, trackId) => {
    try {
        const result = playlist.removeSongFromPlaylist(playlistId, trackId);
        return result;
    } catch (error) {
        console.error('Error removing song from playlist:', error);
        throw error;
    }
});

ipcMain.handle('get-playlist-songs', async (event, playlistId) => {
    try {
        const songs = playlist.getPlaylistSongs(playlistId);
        return songs;
    } catch (error) {
        console.error('Error getting playlist songs:', error);
        throw error;
    }
});

ipcMain.handle('is-song-in-playlist', async (event, playlistId, trackId) => {
    try {
        const isInPlaylist = playlist.isSongInPlaylist(playlistId, trackId);
        return isInPlaylist;
    } catch (error) {
        console.error('Error checking if song is in playlist:', error);
        throw error;
    }
});

ipcMain.handle('reorder-playlist-songs', async (event, playlistId, draggedId, targetId) => {
    try {
        const result = playlist.reorderPlaylistSongs(playlistId, draggedId, targetId);
        return result;
    } catch (error) {
        console.error('Error reordering playlist songs:', error);
        throw error;
    }
});

player.on('play', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-play', data);
    }
});

player.on('stop', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-stop', data);
    }
});

player.on('pause', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-pause', data);
    }
});

player.on('resume', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-resume', data);
    }
});

player.on('progress', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-progress', data);
    }
});

player.on('error', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-error', data);
    }
});

player.on('history-updated', (data) => {
    if (mainWindow) {
        mainWindow.webContents.send('player-history-updated', data);
    }
});

app.on('before-quit', () => {
    player.stop();
});
