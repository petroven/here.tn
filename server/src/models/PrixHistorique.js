import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PrixHistorique = sequelize.define('PrixHistorique', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  prix: { type: DataTypes.FLOAT, allowNull: false },
  dateDebut: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  dateFin: { type: DataTypes.DATE, allowNull: true },
});

export default PrixHistorique;
