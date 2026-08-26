import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Delegation = sequelize.define('Delegation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  nomAr: { type: DataTypes.STRING, allowNull: true },
});

export default Delegation;
