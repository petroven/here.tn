import { Server } from 'socket.io';
import { Livreur } from '../models/index.js';
import { corsOptions } from '../config/cors.js';
import { verifierJeton } from '../middleware/auth.js';

let ioInstance = null;

export function initIo(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: corsOptions,
  });

  // Mêmes règles que l'API (jeton révoqué refusé, rôle relu en base).
  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = token ? await verifierJeton(token) : null;
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('unauthorized'));
    }
  });

  ioInstance.on('connection', async (socket) => {
    if (socket.user.role === 'livreur') {
      try {
        const profil = await Livreur.findOne({ where: { utilisateurId: socket.user.id } });
        if (profil) socket.join(`livreur:${profil.id}`);
      } catch (error) {
        console.error('[SOCKET] Erreur lors de la connexion livreur:', error);
      }
    }
  });

  return ioInstance;
}

export function getIo() {
  if (!ioInstance) throw new Error('Socket.io n\'est pas initialisé.');
  return ioInstance;
}
