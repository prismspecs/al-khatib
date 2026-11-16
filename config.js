// Runtime configuration for the Al-Khatib Glossar frontend.
// This file is copied to the WordPress theme and loaded before the app bundle.
// Hosts are NOT hard-coded into the JS bundle; everything is relative by default,
// with optional overrides here for local/dev/prod parity.

window.AKG = {
    // Base URL of the WordPress install (REST API lives under /wp-json/).
    // Empty string = same origin.
    apiBase: '',

    // Base URL of the theme directory (map assets, fonts, images).
    // Empty string = same origin, theme dir auto-detected by the theme PHP.
    themeBase: '',

    // Default interface language: 'de' | 'en' | 'ar'
    defaultLang: 'de',
};
