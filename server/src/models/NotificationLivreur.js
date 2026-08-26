import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const NotificationLivreur = sequelize.define('NotificationLivreur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  statut: {
    type: DataTypes.ENUM('envoyee', 'acceptee', 'expiree', 'refusee'),
    defaultValue: 'envoyee',
  },
  distanceKm: { type: DataTypes.FLOAT, allowNull: true },
  ordre: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  dateEnvoi: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  dateExpiration: { type: DataTypes.DATE, allowNull: false },
  dateReponse: { type: DataTypes.DATE, allowNull: true },
});

export default NotificationLivreur;
