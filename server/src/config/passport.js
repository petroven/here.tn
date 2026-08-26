import passport from 'passport';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Utilisateur } from '../models/index.js';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

/**
 * Shared find-or-create logic for both providers. Returns either the
 * user (success) or a {conflict: true, message} shape when the email is
 * already registered on a different provider — the callback route turns
 * that into a clear error redirect instead of silently merging accounts.
 */
async function findOrCreateOAuthUser({ provider, providerId, email, nom, prenom, photo }) {
  if (!email) {
    return { conflict: true, message: `Aucun email public fourni par ${provider}. Impossible de créer le compte.` };
  }

  const existingByProvider = await Utilisateur.findOne({ where: { provider, providerId } });
  if (existingByProvider) return { user: existingByProvider };

  const existingByEmail = await Utilisateur.findOne({ where: { email } });
  if (existingByEmail) {
    if (existingByEmail.provider === 'local') {
      return {
        conflict: true,
        message: 'Cet email est déjà utilisé avec un compte classique (mot de passe). Connectez-vous avec votre mot de passe.',
      };
    }
    if (existingByEmail.provider !== provider) {
      return {
        conflict: true,
        message: `Cet email est déjà lié à un compte ${existingByEmail.provider === 'google' ? 'Google' : 'Facebook'}.`,
      };
    }
    return { user: existingByEmail };
  }

  // La colonne password reste NOT NULL en base (existante, non modifiable
  // sans risque sur SQLite) — on y stocke un hash aléatoire inutilisable ;
  // authController.login refuse de toute façon la connexion classique
  // pour tout compte dont provider !== 'local'.
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const user = await Utilisateur.create({
    nom: nom || 'Utilisateur',
    prenom: prenom || provider,
    email,
    password: unusablePassword,
    provider,
    providerId,
    photo: photo || null,
    role: 'client',
  });
  return { user };
}

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID || 'missing_google_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing_google_client_secret',
    callbackURL: `${API_BASE_URL}/api/auth/google/callback`,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateOAuthUser({
        provider: 'google',
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        nom: profile.name?.familyName || profile.displayName,
        prenom: profile.name?.givenName,
        photo: profile.photos?.[0]?.value,
      });
      if (result.conflict) return done(null, false, { message: result.message });
      return done(null, result.user);
    } catch (error) {
      return done(error);
    }
  },
));

passport.use(new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID || 'missing_facebook_app_id',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'missing_facebook_app_secret',
    callbackURL: `${API_BASE_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name', 'photos'],
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateOAuthUser({
        provider: 'facebook',
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        nom: profile.name?.familyName,
        prenom: profile.name?.givenName || profile.displayName,
        photo: profile.photos?.[0]?.value,
      });
      if (result.conflict) return done(null, false, { message: result.message });
      return done(null, result.user);
    } catch (error) {
      return done(error);
    }
  },
));

// Stateless JWT flow — no cookie session, so serialize/deserialize are
// only needed to satisfy passport's internal contract between the
// strategy callback and the route handler within a single request.
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

export default passport;
