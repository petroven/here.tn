import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Photo envoyée (produit, boutique, preuve de livraison…) stockée en base.
// Utilisé quand Cloudinary n'est pas configuré en production : le disque d'un
// hébergeur comme Render est effacé à chaque redéploiement, la base non.
// Servi par GET /uploads/db/:id (voir server.js) — voir utils/upload.js.
const Fichier = sequelize.define('Fichier', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: true },
  mime: { type: DataTypes.STRING, allowNull: false },
  taille: { type: DataTypes.INTEGER, allowNull: false },
  data: { type: DataTypes.BLOB('long'), allowNull: false },
});

export default Fichier;
