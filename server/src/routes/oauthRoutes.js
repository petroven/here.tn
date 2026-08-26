import express from 'express';
import passport from '../config/passport.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

function redirectWithError(res, message) {
  return res.redirect(`${CLIENT_URL}/oauth/callback?error=${encodeURIComponent(message)}`);
}

function handleOAuthCallback(strategy) {
  return (req, res, next) => {
    passport.authenticate(strategy, { session: false }, (err, user, info) => {
      if (err) {
        console.error(`[OAUTH:${strategy}] Erreur:`, err);
        return redirectWithError(res, 'Une erreur est survenue lors de la connexion.');
      }
      if (!user) {
        return redirectWithError(res, info?.message || 'Connexion refusée.');
      }

      // Redirect with a one-time token in the query string — the frontend
      // callback page reads it immediately, stores it, and the URL is
      // replaced (no history entry keeps the token around).
      const token = generateToken(user);
      return res.redirect(`${CLIENT_URL}/oauth/callback?token=${token}`);
    })(req, res, next);
  };
}

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/auth/google/callback', handleOAuthCallback('google'));

router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
router.get('/auth/facebook/callback', handleOAuthCallback('facebook'));

export default router;
