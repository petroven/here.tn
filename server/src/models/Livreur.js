import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Livreur = sequelize.define('Livreur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  statut: {
    type: DataTypes.ENUM('disponible', 'occupe', 'hors_ligne'),
    defaultValue: 'hors_ligne',
  },
  vehiculeType: {
    type: DataTypes.ENUM('moto', 'voiture', 'velo', 'camionnette'),
    allowNull: true,
    defaultValue: 'moto',
  },
  latitude: { type: DataTypes.FLOAT, allowNull: true },
  longitude: { type: DataTypes.FLOAT, allowNull: true },
  dernierePositionMaj: { type: DataTypes.DATE, allowNull: true },
  noteMoyenne: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  nombreLivraisons: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

export default Livreur;
