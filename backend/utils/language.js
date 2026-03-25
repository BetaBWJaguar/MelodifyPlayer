class Language {
    constructor() {
        this.currentLang = localStorage.getItem('melodify-lang') || 'en';
        this.translations = {};
        this.isLoaded = false;
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`../locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang}.json`);
            }
            this.translations = await response.json();
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Error loading translations:', error);
            return false;
        }
    }


    async init() {
        await this.loadTranslations(this.currentLang);
    }

    t(key) {
        if (!this.isLoaded) {
            return key;
        }

        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key;
            }
        }

        return value || key;
    }

    getTranslation(key) {
        return this.t(key);
    }

    async setLanguage(lang) {
        if (lang !== 'en' && lang !== 'tr') {
            console.warn(`Unsupported language: ${lang}`);
            return false;
        }

        this.currentLang = lang;
        localStorage.setItem('melodify-lang', lang);

        const success = await this.loadTranslations(lang);
        if (success) {
            this.updateUI();
        }

        return success;
    }


    getCurrentLanguage() {
        return this.currentLang;
    }


    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            const key = el.getAttribute('data-i18n-alt');
            el.alt = this.t(key);
        });
    }


    async toggleLanguage() {
        const newLang = this.currentLang === 'en' ? 'tr' : 'en';
        return await this.setLanguage(newLang);
    }
}

const language = new Language();

module.exports = language;
