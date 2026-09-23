import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🛒 BuyHere API prête sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/** Arrêt propre : termine les requêtes en cours puis ferme le pool MySQL. */
async function shutdown(signal: string) {
  console.log(`${signal} reçu, arrêt en cours...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
