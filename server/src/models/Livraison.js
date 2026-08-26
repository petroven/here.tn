import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Livraison = sequelize.define('Livraison', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trackingId: { type: DataTypes.STRING, allowNull: false, unique: true },
  awbNumber: { type: DataTypes.STRING, allowNull: true },
  statut: {
    type: DataTypes.ENUM('en_preparation', 'expedie', 'en_cours_livraison', 'livre', 'retourne'),
    defaultValue: 'en_preparation',
  },
  fraisLivraison: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  transporteur: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Aramex TN' },
  dateExpedition: { type: DataTypes.DATE, allowNull: true },
  dateLivraison: { type: DataTypes.DATE, allowNull: true },
  historiqueStatuts: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

  // Espace livreur (courses internes, distinctes du statut transporteur ci-dessus)
  statutAssignation: {
    type: DataTypes.ENUM('non_assignee', 'en_attente', 'assignee', 'en_cours', 'livree', 'echec'),
    defaultValue: 'en_attente',
  },
  latitudeDepart: { type: DataTypes.FLOAT, allowNull: true },
  longitudeDepart: { type: DataTypes.FLOAT, allowNull: true },
  latitudeArrivee: { type: DataTypes.FLOAT, allowNull: true },
  longitudeArrivee: { type: DataTypes.FLOAT, allowNull: true },
  distanceKm: { type: DataTypes.FLOAT, allowNull: true },
  dateAssignation: { type: DataTypes.DATE, allowNull: true },
  preuveLivraison: { type: DataTypes.STRING, allowNull: true },
});

export default Livraison;
