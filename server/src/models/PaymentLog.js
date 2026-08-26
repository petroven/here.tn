import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Audit trail of payment events — who/when/amount/status only, never raw card data.
const PaymentLog = sequelize.define('PaymentLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  evenement: { type: DataTypes.STRING, allowNull: false }, // e.g. 'initiate', 'webhook_recu', 'webhook_rejete'
  statut: { type: DataTypes.STRING, allowNull: false },
  montant: { type: DataTypes.FLOAT, allowNull: true },
  provider: { type: DataTypes.STRING, allowNull: true },
  message: { type: DataTypes.STRING, allowNull: true },
  ip: { type: DataTypes.STRING, allowNull: true },
});

export default PaymentLog;
