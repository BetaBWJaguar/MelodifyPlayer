export function initMainPage() {
    updateGreeting();
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = window.language?.getTranslation(key);
        if (text) el.textContent = text;
    });
}

export function updateGreeting() {
    const greetingTitle = document.getElementById('greetingTitle');
    if (!greetingTitle) return;

    const now = new Date();
    const hour = now.getHours();

    let greetingKey;
    if (hour >= 5 && hour < 12) greetingKey = 'mainPage.morning';
    else if (hour >= 12 && hour < 17) greetingKey = 'mainPage.afternoon';
    else if (hour >= 17 && hour < 22) greetingKey = 'mainPage.evening';
    else greetingKey = 'mainPage.night';

    if (window.language) {
        const text = window.language.getTranslation(greetingKey);
        greetingTitle.textContent = text;
    }
}

window.initMainPage = initMainPage;