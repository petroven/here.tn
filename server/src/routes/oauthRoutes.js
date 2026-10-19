import express from 'express';
import passport, { oauthConfigure } from '../config/passport.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5174';

// Application mobile : elle ouvre /auth/<provider>?redirect=<url de retour>
// dans un navigateur, et reçoit le jeton sur cette URL. Seul le schéma de
// l'app (buyhere://) est accepté — plus exp:// (Expo Go) hors production —
// pour qu'un lien piégé ne puisse jamais envoyer le jeton vers un autre site.
function isAllowedAppRedirect(url) {
  if (typeof url !== 'string' || url.length > 300) return false;
  if (url.startsWith('buyhere://')) return true;
  return process.env.NODE_ENV !== 'production' && url.startsWith('exp://');
}

// Le paramètre OAuth "state" transporte l'URL de retour de l'app jusqu'au callback.
function encodeState(redirect) {
  return Buffer.from(JSON.stringify({ app: redirect })).toString('base64url');
}

function appRedirectFromState(state) {
  try {
    const { app } = JSON.parse(Buffer.from(String(state || ''), 'base64url').toString());
    return isAllowedAppRedirect(app) ? app : null;
  } catch {
    return null;
  }
}

function withParams(base, params) {
  return `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;
}

// Retour vers le site. Le jeton passe dans le fragment (#token=…) : un
// fragment n'est jamais envoyé au serveur, donc absent des logs d'accès
// (Render, Vercel) et de l'en-tête Referer. L'erreur, sans secret, reste en query.
export function urlRetourWeb({ token, error }) {
  if (error) return `${CLIENT_URL}/oauth/callback?error=${encodeURIComponent(error)}`;
  return `${CLIENT_URL}/oauth/callback#${new URLSearchParams({ token })}`;
}

function startOAuth(strategy, scope) {
  return (req, res, next) => {
    const { redirect } = req.query;
    const options = { scope, session: false };
    if (redirect !== undefined) {
      if (!isAllowedAppRedirect(redirect)) {
        return res.status(400).json({ success: false, message: 'URL de retour non autorisée.' });
      }
      options.state = encodeState(redirect);
    }
    // Clés absentes : message clair sur le site ou dans l'app, au lieu d'une
    // page d'erreur de Google/Facebook (« client_id=missing_… »).
    if (!oauthConfigure(strategy)) {
      const nom = strategy === 'google' ? 'Google' : 'Facebook';
      const message = `La connexion avec ${nom} n'est pas encore disponible. Utilisez votre email et votre mot de passe.`;
      console.warn(`[OAUTH:${strategy}] clés absentes sur le serveur : connexion ${nom} indisponible.`);
      return res.redirect(redirect !== undefined ? withParams(redirect, { error: message }) : urlRetourWeb({ error: message }));
    }
    return passport.authenticate(strategy, options)(req, res, next);
  };
}

function handleOAuthCallback(strategy) {
  return (req, res, next) => {
    const appRedirect = appRedirectFromState(req.query.state);
    const redirectWithError = (message) => (appRedirect
      ? res.redirect(withParams(appRedirect, { error: message }))
      : res.redirect(urlRetourWeb({ error: message })));

    passport.authenticate(strategy, { session: false }, (err, user, info) => {
      if (err) {
        console.error(`[OAUTH:${strategy}] Erreur:`, err);
        return redirectWithError('Une erreur est survenue lors de la connexion.');
      }
      if (!user) {
        return redirectWithError(info?.message || 'Connexion refusée.');
      }

      // App mobile : schéma buyhere:// (jamais servi par un serveur web).
      // Site : jeton dans le fragment, lu puis effacé par OAuthCallbackPage.
      const token = generateToken(user);
      if (appRedirect) return res.redirect(withParams(appRedirect, { token }));
      return res.redirect(urlRetourWeb({ token }));
    })(req, res, next);
  };
}

router.get('/auth/google', startOAuth('google', ['profile', 'email']));
router.get('/auth/google/callback', handleOAuthCallback('google'));

router.get('/auth/facebook', startOAuth('facebook', ['email']));
router.get('/auth/facebook/callback', handleOAuthCallback('facebook'));

export default router;
