import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Journal des actions sensibles des administrateurs (KYC, suspension,
// virements, retraits, remboursements, modération catalogue…). Uniquement
// en écriture depuis l'application : aucune route ne modifie ni ne
// supprime une ligne existante. Voir utils/audit.js.
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  acteurId: { type: DataTypes.INTEGER, allowNull: true },
  acteurRole: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: false }, // ex: 'kyc.valider', 'retrait.verser'
  entite: { type: DataTypes.STRING, allowNull: false }, // ex: 'Boutique', 'Commande'
  entiteId: { type: DataTypes.INTEGER, allowNull: true },
  avant: { type: DataTypes.JSON, allowNull: true },
  apres: { type: DataTypes.JSON, allowNull: true },
  commentaire: { type: DataTypes.STRING, allowNull: true },
  ip: { type: DataTypes.STRING, allowNull: true },
}, {
  indexes: [{ fields: ['entite', 'entiteId'] }, { fields: ['acteurId'] }],
});

export default AuditLog;
