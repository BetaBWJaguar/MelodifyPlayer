const { ipcRenderer } = require('electron');

let coverImageData = null;

async function initCreatePlaylistPage() {
    setupCoverImageUpload();
    setupFormValidation();
    setupEventListeners();
}

function setupCoverImageUpload() {
    const coverImageContainer = document.getElementById('coverImageContainer');
    const coverImagePlaceholder = document.getElementById('coverImagePlaceholder');
    const coverImagePreview = document.getElementById('coverImagePreview');
    const coverImageInput = document.getElementById('coverImageInput');
    const changeCoverBtn = document.getElementById('changeCoverBtn');
    const removeCoverBtn = document.getElementById('removeCoverBtn');

    coverImageContainer.addEventListener('click', (e) => {
        if (e.target === removeCoverBtn || e.target.closest('#removeCoverBtn')) {
            return;
        }
        if (coverImagePreview.style.display === 'none') {
            coverImageInput.click();
        }
    });

    coverImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                const lang = window.language || { t: (k) => k };
                const errorMessage = lang.t('createPlaylist.invalidImage');
                showNotification(errorMessage);
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                const lang = window.language || { t: (k) => k };
                const errorMessage = lang.t('createPlaylist.imageTooLarge');
                showNotification(errorMessage);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                coverImageData = event.target.result;
                coverImagePreview.src = coverImageData;
                coverImagePreview.style.display = 'block';
                coverImagePlaceholder.style.display = 'none';
                changeCoverBtn.style.display = 'block';
                removeCoverBtn.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    });

    changeCoverBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        coverImageInput.click();
    });

    removeCoverBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCoverImage();
    });
}

function removeCoverImage() {
    const coverImagePreview = document.getElementById('coverImagePreview');
    const coverImagePlaceholder = document.getElementById('coverImagePlaceholder');
    const coverImageInput = document.getElementById('coverImageInput');
    const changeCoverBtn = document.getElementById('changeCoverBtn');
    const removeCoverBtn = document.getElementById('removeCoverBtn');

    coverImageData = null;
    coverImagePreview.src = '';
    coverImagePreview.style.display = 'none';
    coverImagePlaceholder.style.display = 'flex';
    changeCoverBtn.style.display = 'none';
    removeCoverBtn.style.display = 'none';
    coverImageInput.value = '';
}

function setupFormValidation() {
    const playlistName = document.getElementById('playlistName');
    const playlistDescription = document.getElementById('playlistDescription');
    const nameCharCount = document.getElementById('nameCharCount');
    const descCharCount = document.getElementById('descCharCount');
    const saveBtn = document.getElementById('saveBtn');

    playlistName.addEventListener('input', () => {
        const length = playlistName.value.length;
        nameCharCount.textContent = length;
        if (length > 100) {
            nameCharCount.style.color = '#ef4444';
        } else {
            nameCharCount.style.color = '';
        }
        updateSaveButtonState();
    });

    playlistDescription.addEventListener('input', () => {
        const length = playlistDescription.value.length;
        descCharCount.textContent = length;
        if (length > 500) {
            descCharCount.style.color = '#ef4444';
        } else {
            descCharCount.style.color = '';
        }
    });

    function updateSaveButtonState() {
        const name = playlistName.value.trim();
        saveBtn.disabled = name.length === 0 || name.length > 100;
    }

    updateSaveButtonState();
}

function setupEventListeners() {
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');

    cancelBtn.addEventListener('click', () => {
        navigateBack();
    });

    saveBtn.addEventListener('click', async () => {
        await savePlaylist();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            navigateBack();
        }
    });
}

async function savePlaylist() {
    const playlistName = document.getElementById('playlistName');
    const playlistDescription = document.getElementById('playlistDescription');
    const saveBtn = document.getElementById('saveBtn');

    const name = playlistName.value.trim();
    const description = playlistDescription.value.trim();

    if (!name) {
        const lang = window.language || { t: (k) => k };
        const errorMessage = lang.t('createPlaylist.nameRequired');
        showNotification(errorMessage);
        return;
    }

    if (name.length > 100) {
        const lang = window.language || { t: (k) => k };
        const errorMessage = lang.t('createPlaylist.nameTooLong');
        showNotification(errorMessage);
        return;
    }

    if (description.length > 500) {
        const lang = window.language || { t: (k) => k };
        const errorMessage = lang.t('createPlaylist.descriptionTooLong');
        showNotification(errorMessage);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const playlistData = {
            name: name,
            description: description,
            cover_image: coverImageData
        };

        await ipcRenderer.invoke('create-playlist', playlistData);
        
        const lang = window.language || { t: (k) => k };
        const successMessage = lang.t('createPlaylist.createdSuccessfully');
        showNotification(successMessage);
        navigateBack();
    } catch (error) {
        console.error('Error creating playlist:', error);
        const lang = window.language || { t: (k) => k };
        const errorMessage = lang.t('createPlaylist.errorCreating') || `Error creating playlist: ${error.message}`;
        showNotification(errorMessage);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = window.language?.t('createPlaylist.create') || 'Create';
    }
}

function navigateBack() {
    ipcRenderer.send('navigate-to', 'library');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { initCreatePlaylistPage };
