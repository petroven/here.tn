import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Variante = sequelize.define('Variante', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taille: { type: DataTypes.STRING, allowNull: true },
  couleur: { type: DataTypes.STRING, allowNull: true },
  pointure: { type: DataTypes.STRING, allowNull: true },
  sku: { type: DataTypes.STRING, allowNull: true },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  prixSupplement: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  image: { type: DataTypes.STRING, allowNull: true },
});

export default Variante;
