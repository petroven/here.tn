import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Coupon = sequelize.define('Coupon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  type: { type: DataTypes.ENUM('pourcentage', 'montant_fixe'), allowNull: false },
  valeur: { type: DataTypes.FLOAT, allowNull: false },
  dateExpiration: { type: DataTypes.DATE, allowNull: false },
  limiteUtilisation: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  utilisations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  montantMinimum: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
});

export default Coupon;
