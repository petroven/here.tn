import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Jeton Expo Push d'un appareil — un utilisateur peut en avoir plusieurs
// (téléphone + tablette). Un jeton est unique : s'il est ré-enregistré par
// un autre compte (changement d'utilisateur sur le même téléphone), il est
// simplement réattribué.
const PushToken = sequelize.define('PushToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  token: { type: DataTypes.STRING, allowNull: false, unique: true },
  plateforme: { type: DataTypes.STRING, allowNull: true }, // 'ios' | 'android'
});

export default PushToken;
