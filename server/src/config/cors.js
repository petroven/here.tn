// Shared CORS allowlist for both Express (server.js) and Socket.io
// (realtime/io.js). In dev we allow the configured CLIENT_URL plus the
// common Vite ports so switching ports locally doesn't break anything; in
// production only CLIENT_URL (your real domain) is ever allowed.
//
// process.env.CLIENT_URL is read lazily, inside the callback, rather than
// once at module load — ESM import statements run before server.js's own
// `dotenv.config()` call, so reading it at the top level here would always
// see it as undefined and silently drop the real production domain.
const devFallbackOrigins = ['http://localhost:5173', 'http://localhost:5174'];

function getAllowedOrigins() {
  const isProduction = process.env.NODE_ENV === 'production';
  return [process.env.CLIENT_URL, ...(isProduction ? [] : devFallbackOrigins)].filter(Boolean);
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
