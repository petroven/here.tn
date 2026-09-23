import 'dotenv/config';
import { z } from 'zod';

/**
 * Variables d'environnement validées au démarrage : l'API refuse de démarrer
 * avec une configuration invalide plutôt que d'échouer plus tard en production.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('*'),

  DATABASE_URL: z.string().startsWith('mysql://'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  SHIPPING_FEE: z.coerce.number().int().nonnegative().default(7000),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().int().nonnegative().default(150000),

  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  APP_RETURN_URL: z.string().default('buyhere://payment-return'),

  KONNECT_API_URL: z.string().url().default('https://api.sandbox.konnect.network/api/v2'),
  KONNECT_API_KEY: z.string().optional(),
  KONNECT_WALLET_ID: z.string().optional(),

  FLOUCI_API_URL: z.string().url().default('https://developers.flouci.com/api'),
  FLOUCI_APP_TOKEN: z.string().optional(),
  FLOUCI_APP_SECRET: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration invalide :');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
