import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Retour = sequelize.define('Retour', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  motif: { type: DataTypes.TEXT, allowNull: false },
  // Catégorie du motif, choisie par le client — détermine qui paie les frais
  // de retour par défaut (le vendeur en cas de défaut/non-conformité, le
  // client en cas de simple changement d'avis), voir utils/returnPolicy.js.
  motifCategorie: {
    type: DataTypes.ENUM('defaut', 'non_conforme', 'changement_avis'),
    allowNull: false,
    defaultValue: 'non_conforme',
  },
  // Photos obligatoires jointes par le client à l'ouverture de la demande.
  photos: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  statut: {
    // 'litige' = le vendeur n'a pas répondu sous 48h (voir
    // dateLimiteReponseVendeur) ou a refusé sans accord du client — la
    // demande est alors escaladée à la médiation admin.
    type: DataTypes.ENUM('demande', 'approuve', 'refuse', 'rembourse', 'litige'),
    defaultValue: 'demande',
  },
  dateLimiteReponseVendeur: { type: DataTypes.DATE, allowNull: true },
  fraisRetourALaCharge: { type: DataTypes.ENUM('vendeur', 'client'), allowNull: true },
  montantRemboursement: { type: DataTypes.FLOAT, allowNull: true },
  commentaireVendeur: { type: DataTypes.TEXT, allowNull: true },
  dateTraitement: { type: DataTypes.DATE, allowNull: true },
});

export default Retour;
