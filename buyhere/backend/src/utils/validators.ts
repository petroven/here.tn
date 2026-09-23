import { z } from 'zod';
import type { User } from '@prisma/client';

/** Téléphone tunisien : 8 chiffres, avec ou sans +216. Normalisé en +216XXXXXXXX. */
export const TunisianPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => /^(\+216|00216)?[2-9]\d{7}$/.test(v), 'Numéro tunisien invalide (8 chiffres)')
  .transform((v) => `+216${v.slice(-8)}`);

/** Mot de passe : 8 à 72 caractères (limite bcrypt), au moins une lettre et un chiffre. */
export const Password = z
  .string()
  .min(8, '8 caractères minimum')
  .max(72, '72 caractères maximum')
  .regex(/[A-Za-z]/, 'Doit contenir une lettre')
  .regex(/\d/, 'Doit contenir un chiffre');

/** Vue publique d'un utilisateur : jamais de hash de mot de passe ni de token push. */
export function toUserDto(u: User) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    language: u.language,
    createdAt: u.createdAt,
  };
}
