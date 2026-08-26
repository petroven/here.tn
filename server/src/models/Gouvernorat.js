import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Gouvernorat = sequelize.define('Gouvernorat', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: false, unique: true },
  nomAr: { type: DataTypes.STRING, allowNull: true },
  code: { type: DataTypes.STRING(2), allowNull: true },
  fraisLivraison: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 8 },
});

export default Gouvernorat;
