// Shared CORS allowlist for both Express (server.js) and Socket.io
// (realtime/io.js). In dev we allow the configured CLIENT_URL plus the
// common Vite ports so switching ports locally doesn't break anything; in
// production only CLIENT_URL plus the official site domains below (and any
// extra origin listed, comma-separated, in CLIENT_URLS) are allowed.
//
// process.env.CLIENT_URL is read lazily, inside the callback, rather than
// once at module load — ESM import statements run before server.js's own
// `dotenv.config()` call, so reading it at the top level here would always
// see it as undefined and silently drop the real production domain.
const devFallbackOrigins = [
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
];

// Domaines officiels du site : la même app est servie sur buyhere.tn et
// buyhere.com, donc les deux doivent pouvoir appeler l'API quel que soit
// celui qui est configuré dans CLIENT_URL.
const officialOrigins = [
  'https://buyhere.tn', 'https://www.buyhere.tn',
  'https://buyhere.com', 'https://www.buyhere.com',
];

function getAllowedOrigins() {
  const isProduction = process.env.NODE_ENV === 'production';
  const extra = (process.env.CLIENT_URLS || '').split(',').map((v) => v.trim()).filter(Boolean);
  return [
    process.env.CLIENT_URL, ...extra, ...officialOrigins,
    ...(isProduction ? [] : devFallbackOrigins),
  ].filter(Boolean).map((o) => o.replace(/\/$/, ''));
}

export const corsOptions = {
  origin(origin, callback) {
    // No Origin header = server-to-server call, curl, mobile app, webhook —
    // never sent by a browser, so it can't be a cross-site attack vector.
    if (!origin || getAllowedOrigins().includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origine non autorisée (${origin}).`));
  },
  credentials: true,
};
