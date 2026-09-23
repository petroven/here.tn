import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

/**
 * Instance unique de PrismaClient. En développement, `tsx watch` recharge les
 * modules : on la garde sur globalThis pour ne pas ouvrir un pool par rechargement.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: isProd ? ['error'] : ['warn', 'error'] });

if (!isProd) globalForPrisma.prisma = prisma;
