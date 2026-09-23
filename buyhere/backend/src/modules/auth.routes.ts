import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { issueTokenPair, sha256 } from '../lib/tokens.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { isProd } from '../config/env.js';
import { Password, TunisianPhone, toUserDto } from '../utils/validators.js';

const router = Router();

// Limite les tentatives de connexion / réinitialisation (anti brute-force).
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

const RegisterBody = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email('Email invalide'),
  phone: TunisianPhone.optional(),
  password: Password,
  language: z.enum(['fr', 'ar']).default('fr'),
});

/** Connexion par email OU téléphone dans le même champ `identifier`. */
const LoginBody = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

const RefreshBody = z.object({ refreshToken: z.string().min(20) });

const ForgotBody = z.object({ identifier: z.string().trim().min(3) });

const ResetBody = z.object({
  identifier: z.string().trim().min(3),
  code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres'),
  password: Password,
});

async function findByIdentifier(identifier: string) {
  if (identifier.includes('@')) {
    return prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
  }
  const phone = TunisianPhone.safeParse(identifier);
  return phone.success ? prisma.user.findUnique({ where: { phone: phone.data } }) : null;
}

// POST /auth/register
router.post('/register', authLimiter, validate({ body: RegisterBody }), async (req, res) => {
  const body = req.body as z.infer<typeof RegisterBody>;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: body.email }, ...(body.phone ? [{ phone: body.phone }] : [])] },
  });
  if (existing) {
    throw AppError.conflict(
      existing.email === body.email ? 'Cet email est déjà utilisé' : 'Ce numéro est déjà utilisé',
      'ACCOUNT_EXISTS',
    );
  }

  const user = await prisma.user.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      language: body.language,
      passwordHash: await bcrypt.hash(body.password, 12),
      cart: { create: {} },
    },
  });

  const tokens = await issueTokenPair(user);
  res.status(201).json({ user: toUserDto(user), ...tokens });
});

// POST /auth/login
router.post('/login', authLimiter, validate({ body: LoginBody }), async (req, res) => {
  const { identifier, password } = req.body as z.infer<typeof LoginBody>;
  const user = await findByIdentifier(identifier);

  // Message identique que l'utilisateur existe ou non (pas d'énumération de comptes).
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw AppError.unauthorized('Identifiants incorrects', 'INVALID_CREDENTIALS');
  }

  const tokens = await issueTokenPair(user);
  res.json({ user: toUserDto(user), ...tokens });
});

/**
 * POST /auth/refresh — rotation : l'ancien refresh token est révoqué et un
 * nouveau est émis. Réutiliser un token révoqué révoque toute la session
 * (détection de vol de token).
 */
router.post('/refresh', validate({ body: RefreshBody }), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof RefreshBody>;
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });

  if (!stored) throw AppError.unauthorized('Session invalide', 'INVALID_REFRESH');

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized('Session révoquée', 'REFRESH_REUSED');
  }
  if (stored.expiresAt < new Date()) throw AppError.unauthorized('Session expirée', 'REFRESH_EXPIRED');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokenPair(stored.user);
  res.json({ user: toUserDto(stored.user), ...tokens });
});

// POST /auth/logout — révoque le refresh token fourni (idempotent).
router.post('/logout', validate({ body: RefreshBody }), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof RefreshBody>;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  res.status(204).end();
});

/**
 * POST /auth/forgot-password — génère un code à 6 chiffres valable 15 min.
 * Réponse identique que le compte existe ou non.
 *
 * Envoi : branchez ici votre fournisseur email/SMS (ex. Brevo, Twilio,
 * TunisieSMS). En développement le code est journalisé et renvoyé dans
 * `devCode` pour faciliter les tests.
 */
router.post('/forgot-password', authLimiter, validate({ body: ForgotBody }), async (req, res) => {
  const { identifier } = req.body as z.infer<typeof ForgotBody>;
  const user = await findByIdentifier(identifier);

  let devCode: string | undefined;
  if (user) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await prisma.passwordReset.create({
      data: { userId: user.id, codeHash: sha256(code), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    console.info(`[AUTH] Code de réinitialisation pour ${user.email} : ${code}`);
    if (!isProd) devCode = code;
  }

  res.json({ message: 'Si un compte existe, un code de vérification a été envoyé.', devCode });
});

// POST /auth/reset-password — vérifie le code puis change le mot de passe.
router.post('/reset-password', authLimiter, validate({ body: ResetBody }), async (req, res) => {
  const { identifier, code, password } = req.body as z.infer<typeof ResetBody>;
  const user = await findByIdentifier(identifier);
  const invalid = AppError.badRequest('Code invalide ou expiré', 'RESET_CODE_INVALID');
  if (!user) throw invalid;

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset || reset.attempts >= 5) throw invalid;

  if (reset.codeHash !== sha256(code)) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Déconnecte toutes les sessions existantes.
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  res.json({ message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
});

export default router;
