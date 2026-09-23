// Tests unitaires de la logique d'import en masse (server/src/utils/productImport.js)
// — parsing Excel/CSV, association ZIP -> référence, validation des lignes.
// Purement fonctionnel : aucune base de données ni serveur HTTP nécessaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import {
  parseSpreadsheetBuffer,
  buildImportPreview,
  buildImportTemplateWorkbook,
  readZipArchive,
} from '../src/utils/productImport.js';

const categories = [
  { id: 1, nom: 'Vêtements' },
  { id: 2, nom: 'Chaussures' },
];

test('parseSpreadsheetBuffer (CSV) mappe les alias de colonnes et ignore nom_ar/description_ar', async () => {
  const csv = 'reference;nom_fr;nom_ar;description_fr;description_ar;prix;stock;categorie\nP001;T-shirt homme;قميص رجالي;T-shirt coton;قميص قطني;39.9;50;Vêtements\n';
  const { rows, ignoredHeaders } = await parseSpreadsheetBuffer(Buffer.from(csv, 'utf8'), 'csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].values.nom, 'T-shirt homme');
  assert.equal(rows[0].values.reference, 'P001');
  assert.equal(rows[0].values.description, 'T-shirt coton');
  assert.ok(ignoredHeaders.includes('nom_ar'));
  assert.ok(ignoredHeaders.includes('description_ar'));
});

test('parseSpreadsheetBuffer (CSV) gère les champs entre guillemets contenant le délimiteur et des guillemets échappés', async () => {
  const csv = 'reference,nom,description\nP002,"Chaussures, edition limitee","Une paire ""unique"""\n';
  const { rows } = await parseSpreadsheetBuffer(Buffer.from(csv, 'utf8'), 'csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].values.nom, 'Chaussures, edition limitee');
  assert.equal(rows[0].values.description, 'Une paire "unique"');
});

test('buildImportPreview accepte une ligne complète et valide', () => {
  const parsed = { rows: [{ rowIndex: 2, values: { reference: 'P001', nom: 'T-shirt', description: 'Coton', prix: '39.9', stock: '50', categorie: 'Vêtements' } }], ignoredHeaders: [] };
  const { rows, summary } = buildImportPreview(parsed, {
    categories,
    existingReferences: new Set(),
    imagesByReference: new Map([['P001', ['/tmp/a.jpg', '/tmp/b.jpg']]]),
  });
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[0].prix, 39.9);
  assert.equal(rows[0].stock, 50);
  assert.equal(rows[0].categorieId, 1);
  assert.equal(rows[0].imageCount, 2);
  assert.equal(summary.ok, 1);
  assert.equal(summary.error, 0);
});

test('buildImportPreview rejette une ligne sans nom ou avec un prix invalide', () => {
  const parsed = {
    rows: [
      { rowIndex: 2, values: { nom: '', prix: '10', stock: '1' } },
      { rowIndex: 3, values: { nom: 'Produit', prix: 'abc', stock: '1' } },
      { rowIndex: 4, values: { nom: 'Produit', prix: '0', stock: '1' } },
    ],
    ignoredHeaders: [],
  };
  const { rows, summary } = buildImportPreview(parsed, { categories, existingReferences: new Set(), imagesByReference: new Map() });
  assert.equal(summary.error, 3);
  assert.ok(rows[0].errors.some((e) => e.includes('Nom')));
  assert.ok(rows[1].errors.some((e) => e.includes('Prix')));
  assert.ok(rows[2].errors.some((e) => e.includes('Prix')));
});

test('buildImportPreview détecte les références en double dans le fichier et déjà en base', () => {
  const parsed = {
    rows: [
      { rowIndex: 2, values: { reference: 'P001', nom: 'A', description: 'Desc A', prix: '10' } },
      { rowIndex: 3, values: { reference: 'P001', nom: 'B', description: 'Desc B', prix: '20' } },
      { rowIndex: 4, values: { reference: 'P002', nom: 'C', prix: '15' } },
    ],
    ignoredHeaders: [],
  };
  const { rows } = buildImportPreview(parsed, {
    categories,
    existingReferences: new Set(['P002']),
    imagesByReference: new Map([['P001', ['/tmp/a.jpg']]]),
  });
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[1].status, 'error');
  assert.ok(rows[1].errors.some((e) => e.includes('double')));
  assert.equal(rows[2].status, 'error');
  assert.ok(rows[2].errors.some((e) => e.includes('déjà utilisée')));
});

test('buildImportPreview avertit (sans bloquer) sur référence manquante, catégorie inconnue et absence de photos', () => {
  const parsed = {
    rows: [{ rowIndex: 2, values: { nom: 'Produit sans réf', prix: '10', categorie: 'Catégorie Fantôme' } }],
    ignoredHeaders: [],
  };
  const { rows } = buildImportPreview(parsed, { categories, existingReferences: new Set(), imagesByReference: new Map() });
  assert.equal(rows[0].status, 'warning');
  assert.equal(rows[0].categorieId, null);
  assert.equal(rows[0].reference, null);
  assert.ok(rows[0].warnings.some((w) => w.includes('référence')));
  assert.ok(rows[0].warnings.some((w) => w.includes('non reconnue')));
});

test('buildImportPreview matche la catégorie sans tenir compte de la casse/accents', () => {
  const parsed = { rows: [{ rowIndex: 2, values: { nom: 'Produit', prix: '10', categorie: 'VETEMENTS' } }], ignoredHeaders: [] };
  const { rows } = buildImportPreview(parsed, { categories, existingReferences: new Set(), imagesByReference: new Map() });
  assert.equal(rows[0].categorieId, 1);
  assert.equal(rows[0].categorieNom, 'Vêtements');
});

test('buildImportTemplateWorkbook génère un classeur avec les bonnes colonnes et 2 lignes d\'exemple', async () => {
  const workbook = buildImportTemplateWorkbook();
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.name, 'Produits');
  const headerRow = sheet.getRow(1).values.filter(Boolean);
  assert.deepEqual(headerRow, ['reference', 'nom', 'description', 'prix', 'prix_avant', 'stock', 'categorie', 'marque']);
  assert.equal(sheet.rowCount, 3);
});

test('readZipArchive associe les images à leur référence via images/<reference>/', () => {
  const zip = new AdmZip();
  zip.addFile('produits.csv', Buffer.from('reference,nom,prix\nP001,T-shirt,39.9\n', 'utf8'));
  zip.addFile('images/P001/2.jpg', Buffer.from('fake-jpg-2'));
  zip.addFile('images/P001/1.jpg', Buffer.from('fake-jpg-1'));
  const buffer = zip.toBuffer();

  const { spreadsheet, imagesByReference } = readZipArchive(buffer);
  assert.equal(spreadsheet.ext, 'csv');
  const p001Images = imagesByReference.get('P001');
  assert.equal(p001Images.length, 2);
  // Trié naturellement : 1.jpg avant 2.jpg malgré l'ordre d'ajout inverse.
  assert.equal(p001Images[0].filename, '1');
  assert.equal(p001Images[1].filename, '2');
});

test('readZipArchive ignore silencieusement une entrée dont la taille déclarée dépasse la limite (anti zip-bombe)', () => {
  const zip = new AdmZip();
  zip.addFile('produits.csv', Buffer.from('reference,nom,prix\nP001,T-shirt,39.9\n', 'utf8'));
  zip.addFile('images/P001/1.jpg', Buffer.from('normal-image'));
  zip.addFile('images/P001/2.jpg', Buffer.alloc(9 * 1024 * 1024)); // > MAX_IMAGE_BYTES (8 Mo)
  const buffer = zip.toBuffer();

  const { imagesByReference } = readZipArchive(buffer);
  const p001Images = imagesByReference.get('P001');
  assert.equal(p001Images.length, 1);
  assert.equal(p001Images[0].filename, '1');
});
