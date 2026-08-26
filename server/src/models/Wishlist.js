import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Wishlist = sequelize.define('Wishlist', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
}, {
  indexes: [{ unique: true, fields: ['utilisateurId', 'produitId'] }],
});

export default Wishlist;
