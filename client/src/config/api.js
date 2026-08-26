// Single source of truth for the backend base URL. Everything in this
// codebase used to hardcode `http://localhost:5000/api`, which only works
// while the API happens to live at that exact address — set VITE_API_URL
// in .env to point anywhere else (staging, prod, a different port).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Same host, no /api suffix — needed for the Socket.io connection and for
// building absolute links (uploaded image URLs, OAuth redirect targets).
export const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, '');
