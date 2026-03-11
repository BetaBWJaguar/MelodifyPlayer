const pageContainer = document.getElementById("page-container");

async function loadPage(page) {

    const html = await fetch(`../pages/${page}/${page}.html`)
        .then(res => res.text());

    pageContainer.innerHTML = html;

    loadCSS(page);
    loadJS(page);

}

function loadCSS(page) {

    const existing = document.getElementById("page-css");

    if (existing) existing.remove();

    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.href = `../pages/${page}/${page}.css`;
    link.id = "page-css";

    document.head.appendChild(link);

}

async function loadJS(page) {

    const module = await import(`../pages/${page}/${page}.js`);

    const initFunction = `init${capitalize(page)}Page`;

    if (module[initFunction]) {
        module[initFunction]();
    }

}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}


document.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = require('electron');
    
    const startBtn = document.getElementById('startBtn');
    
    const closeBtn = document.getElementById('closeBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-close');
        });
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-minimize');
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-maximize');
        });
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {

        });
    }


    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const page = item.dataset.page;
            loadPage(page);
        });
    });


    const playlistCards = document.querySelectorAll('.playlist-card');
    playlistCards.forEach(card => {
        card.addEventListener('click', () => {
        });
    });

    const playBtn = document.querySelector('.play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            console.log('Play button clicked');
        });
    }

    const progress = document.querySelector('.progress');
    if (progress) {
        progress.addEventListener('click', (e) => {
            const rect = progress.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const progressFill = progress.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = `${percent}%`;
            }
        });
    }
});
