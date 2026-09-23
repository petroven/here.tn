import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

export type AccessPayload = { sub: string; role: Role };

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/** JWT court (15 min par défaut) envoyé dans l'en-tête Authorization. */
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

/**
 * Refresh token opaque (aléatoire, 48 octets). Seul son hash est stocké :
 * une fuite de la base ne permet pas de se connecter.
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  return token;
}

/** Paire access + refresh renvoyée au client après login / register / refresh. */
export async function issueTokenPair(user: { id: string; role: Role }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken };
}
