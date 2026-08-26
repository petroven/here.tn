import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  token: { type: DataTypes.STRING, allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  used: { type: DataTypes.BOOLEAN, defaultValue: false },
});

export default PasswordResetToken;
