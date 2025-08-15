// Vite entry: bundles Tailwind CSS, Alpine, Lottie, Mermaid, then runs existing app.js
import './styles.css';

// Third-party libs (self-hosted via bundle)
import mermaid from 'mermaid';
import Alpine from 'alpinejs';
import '@lottiefiles/lottie-player';
import PouchDB from 'pouchdb';

// Expose mermaid globally for existing code paths that expect window.mermaid
window.mermaid = mermaid;
window.PouchDB = PouchDB;

// Start Alpine (if any x-data is present)
window.Alpine = Alpine;
Alpine.start();

// Execute existing app logic
import '/app.js';

// Register service worker (Vite copies public/sw.js to /sw.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('SW registration failed', err);
    });
  });
}
