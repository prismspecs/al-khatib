import { initApp } from './src/main.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        window.__AKG_APP = await initApp();
    });
} else {
    initApp().then(app => {
        window.__AKG_APP = app;
    });
}
