import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  montant: { type: DataTypes.FLOAT, allowNull: false },
  type: { type: DataTypes.ENUM('credit', 'debit'), allowNull: false },
  motif: { type: DataTypes.STRING, allowNull: false }, // e.g. 'cashback', 'utilise_commande'
});

export default WalletTransaction;
