import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sequelize, Transaction } from 'sequelize';
import dotenv from 'dotenv';
import { seedGeographie } from '../utils/shipping.js';
import { seedDemoAccounts, seedMarketplaceCategories } from '../utils/seed.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite by default (zero-setup local dev). Set DATABASE_URL to a
// postgres://... connection string to switch to PostgreSQL for a real
// deployment — same models, same auto-migration logic below, no other
// code change needed. sslmode is required by most managed Postgres hosts
// (Render, Supabase, Railway...); DATABASE_SSL=false opts out for a
// self-hosted instance that doesn't present a trusted certificate.
const databaseUrl = process.env.DATABASE_URL;
const isPostgres = databaseUrl && /^postgres(ql)?:\/\//.test(databaseUrl);

let sequelize;
if (isPostgres) {
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.DATABASE_SSL === 'false'
      ? {}
      : { ssl: { require: true, rejectUnauthorized: false } },
  });
} else {
  const databaseDirectory = path.resolve(__dirname, '../../data');
  fs.mkdirSync(databaseDirectory, { recursive: true });
  // SQLITE_STORAGE permet aux tests automatisés (server/tests/) de pointer
  // vers un fichier isolé (data/test.db) plutôt que la base de démo réelle —
  // évite tout conflit de verrou de fichier avec un `npm run dev` en cours et
  // toute pollution des comptes de démonstration.
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_STORAGE || path.join(databaseDirectory, 'marketplace.db'),
    logging: false,
    // SQLite n'accepte qu'un écrivain à la fois, et Sequelize ouvre une
    // connexion distincte par transaction. Une transaction DEFERRED qui lit
    // puis écrit pendant qu'une autre écrit échoue en SQLITE_BUSY sans
    // jamais attendre (SQLite refuse pour éviter un interblocage).
    // IMMEDIATE prend le verrou d'écriture dès le BEGIN, là où le délai
    // d'attente ci-dessous s'applique : les transactions concurrentes
    // (commandes simultanées, notifications et matching livreur en tâche de
    // fond) s'exécutent alors l'une après l'autre au lieu d'échouer.
    transactionType: Transaction.TYPES.IMMEDIATE,
  });

  // Délai d'attente du verrou sur CHAQUE connexion (Sequelize n'expose aucun
  // hook de connexion pour SQLite), et mode WAL : les lectures ne sont plus
  // bloquées pendant une écriture. journal_mode est persistant dans le
  // fichier, busyTimeout est propre à chaque connexion.
  const connectionManager = sequelize.connectionManager;
  const getConnection = connectionManager.getConnection.bind(connectionManager);
  connectionManager.getConnection = async (options) => {
    const connection = await getConnection(options);
    if (!connection.__heretnConfigured) {
      connection.__heretnConfigured = true;
      connection.configure('busyTimeout', 5000);
      connection.run('PRAGMA journal_mode = WAL');
    }
    return connection;
  };
}

export const syncDatabase = async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  for (const model of Object.values(sequelize.models)) {
    const tableName = model.getTableName();
    const normalizedTableName = typeof tableName === 'string' ? tableName : tableName.tableName;
    if (!tables.includes(normalizedTableName)) continue;

    const existingColumns = await queryInterface.describeTable(normalizedTableName);
    for (const [attributeName, attribute] of Object.entries(model.rawAttributes)) {
      const columnName = attribute.field || attributeName;
      if (existingColumns[columnName]) continue;

      await queryInterface.addColumn(normalizedTableName, columnName, {
        type: attribute.type,
        allowNull: true,
        defaultValue: attribute.defaultValue,
      });
      console.log(`[DB] Added missing column ${normalizedTableName}.${columnName}`);
    }

    // PostgreSQL stocke un ENUM comme un vrai type : sync() ne lui ajoute
    // jamais les nouvelles valeurs d'un modèle (ex: les statuts de commande
    // 'preparation'/'retour'…), et toute écriture échouerait. SQLite stocke
    // un ENUM en TEXT sans contrainte, rien à faire.
    if (isPostgres) {
      for (const [attributeName, attribute] of Object.entries(model.rawAttributes)) {
        if (!attribute.type?.values || attribute.type.key !== 'ENUM') continue;
        const columnName = attribute.field || attributeName;
        const enumName = `enum_${normalizedTableName}_${columnName}`;
        for (const value of attribute.type.values) {
          await sequelize.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value.replace(/'/g, "''")}'`);
        }
      }
    }
  }

  await seedGeographie();
  await seedMarketplaceCategories();
  await seedDemoAccounts();

  const { chargerComptesSupprimes } = await import('../utils/comptesSupprimes.js');
  await chargerComptesSupprimes();
};

export default sequelize;
