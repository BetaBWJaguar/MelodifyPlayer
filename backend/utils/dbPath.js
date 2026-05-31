const { app } = require('electron');
const path = require('path');
const fs = require('fs');


function getDbPath() {
    if (app.isPackaged) {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'melodify.db');

        if (!fs.existsSync(dbPath)) {
            const bundledPath = path.join(process.resourcesPath, 'melodify.db');
            if (fs.existsSync(bundledPath)) {
                fs.copyFileSync(bundledPath, dbPath);
            } else {
                console.log('[dbPath] No bundled database found, a new one will be created at:', dbPath);
            }
        }

        return dbPath;
    } else {
        const projectDir = path.join(__dirname, '../../');
        return path.join(projectDir, 'melodify.db');
    }
}

module.exports = { getDbPath };
