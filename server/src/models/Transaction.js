import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Audit/security layer over Paiement — never stores raw card data, only the
// provider's reference/token and enough metadata to reconcile a webhook.
const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  montant: { type: DataTypes.FLOAT, allowNull: false },
  statut: {
    type: DataTypes.ENUM('initiee', 'en_attente', 'validee', 'echec', 'annulee'),
    defaultValue: 'initiee',
  },
  provider: { type: DataTypes.STRING, allowNull: false },
  providerReference: { type: DataTypes.STRING, allowNull: true, unique: true },
  idempotencyKey: { type: DataTypes.STRING, allowNull: false, unique: true },
  dateConfirmation: { type: DataTypes.DATE, allowNull: true },
});

export default Transaction;
