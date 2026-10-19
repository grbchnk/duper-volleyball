// Static module dependencies finish before the page's load event. In
// particular, visible lobby buttons cannot race a dynamic import's handlers.
import './main.js';
document.documentElement.dataset.gameReady = 'true';
