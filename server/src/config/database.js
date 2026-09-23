import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sequelize } from 'sequelize';
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
  });
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
  }

  await seedGeographie();
  await seedMarketplaceCategories();
  await seedDemoAccounts();
};

export default sequelize;
