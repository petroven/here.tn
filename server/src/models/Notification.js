import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Notification in-app d'un utilisateur (client, vendeur…) — la même ligne
// sert de source à la cloche du site et à la notification push mobile
// (voir utils/notifications.js). `lien` est un chemin d'app sans schéma
// (ex: 'commande/12'), converti en buyhere://… côté mobile et en route
// React côté site.
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.STRING, allowNull: false }, // ex: 'commande_expediee', 'stock_faible'
  titre: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.STRING, allowNull: false },
  lien: { type: DataTypes.STRING, allowNull: true },
  data: { type: DataTypes.JSON, allowNull: true },
  lu: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  indexes: [{ fields: ['utilisateurId', 'lu'] }],
});

export default Notification;
