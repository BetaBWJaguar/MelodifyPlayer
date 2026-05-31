const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const logFilePath = path.join(app.getPath('userData'), 'melodify-debug.log');

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try { fs.appendFileSync(logFilePath, line); } catch (e) { }
}

module.exports = { log };
