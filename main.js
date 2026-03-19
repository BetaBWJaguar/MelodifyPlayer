const { app, BrowserWindow, ipcMain } = require('electron');
const { searchTrack } = require('./backend/utils/searchModule');
const player = require('./backend/utils/playSongs');

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

ipcMain.handle('get-player-status', () => {
    return player.getStatus();
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

app.on('before-quit', () => {
    player.stop();
});
