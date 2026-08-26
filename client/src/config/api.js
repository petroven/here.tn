// Single source of truth for the backend base URL. Everything in this
// codebase used to hardcode `http://localhost:5000/api`, which only works
// while the API happens to live at that exact address — set VITE_API_URL
// in .env to point anywhere else (staging, prod, a different port).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Same host, no /api suffix — needed for the Socket.io connection and for
// building absolute links (uploaded image URLs, OAuth redirect targets).
// When VITE_API_URL is a relative path (e.g. '/api', used for a single-
// service deploy where the API and the built client share one origin),
// API_URL.replace(...) alone would yield '' — socket.io-client needs a real
// origin to connect to, so fall back to the page's own origin in that case.
export const SERVER_ORIGIN = /^https?:\/\//.test(API_URL)
  ? API_URL.replace(/\/api\/?$/, '')
  : window.location.origin;
