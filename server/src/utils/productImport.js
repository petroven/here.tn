import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Même dossier temporaire que les autres uploads (voir utils/upload.js) —
// nettoyé par uploadImage() une fois chaque photo envoyée vers Cloudinary/
// stockage local, et par cleanupImagePaths() pour les lignes jamais validées.
const tempDir = path.resolve(__dirname, '../../uploads/temp');

// Un dossier ZIP "images/<reference>/n.jpg" associe ses photos au produit
// portant cette référence dans le fichier Excel/CSV — voir readZipArchive().
const SPREADSHEET_RE = /(?:^|\/)produits\.(xlsx|csv)$/i;
const IMAGE_RE = /(?:^|\/)images\/([^/]+)\/([^/]+)\.(jpe?g|png|webp|gif)$/i;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SPREADSHEET_BYTES = 20 * 1024 * 1024;
// Défense en profondeur contre les ZIP-bombes (allocation mémoire excessive
// via une taille décompressée déclarée mensongère) — au-delà du correctif
// amont d'adm-zip (>=0.6.1), on vérifie la taille déclarée de chaque entrée
// AVANT de la décompresser (entry.getData()), jamais après.
const MAX_ZIP_ENTRIES = 2000;
const MAX_TOTAL_DECLARED_BYTES = 300 * 1024 * 1024;

// Alias de colonnes acceptés dans le fichier Excel/CSV — insensibles à la
// casse et aux accents (voir normalizeHeader). nom_ar/description_ar ne sont
// volontairement pas mappés : le catalogue ne stocke qu'une seule langue par
// produit pour le moment (voir summary.ignoredHeaders, affiché au vendeur).
const HEADER_ALIASES = {
  reference: 'reference', ref: 'reference', sku: 'reference',
  nom: 'nom', nom_fr: 'nom', nom_produit: 'nom', name: 'nom', titre: 'nom',
  description: 'description', description_fr: 'description', desc: 'description',
  prix: 'prix', prix_de_base: 'prix', price: 'prix',
  prix_avant: 'prixAvant', prix_barre: 'prixAvant', ancien_prix: 'prixAvant',
  stock: 'stock', quantite: 'stock', qty: 'stock',
  categorie: 'categorie', category: 'categorie',
  marque: 'marque', brand: 'marque',
};

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function parseDecimal(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const num = Number(String(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(num) ? num : null;
}

// --- CSV : parseur minimal (virgule ou point-virgule, champs entre
// guillemets) plutôt que de dépendre de l'API CSV d'une lib tierce — le
// format attendu ici (export Excel/Google Sheets) reste simple. -----------
function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } else inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseCsvLine(line, delimiter));
}

// Lit un classeur Excel (.xlsx) ou CSV en mémoire et renvoie les lignes
// (hors en-tête) avec leurs valeurs mappées aux clés canoniques ci-dessus.
export async function parseSpreadsheetBuffer(buffer, ext) {
  if (ext === 'csv') {
    const lines = parseCsvBuffer(buffer);
    if (lines.length === 0) return { rows: [], ignoredHeaders: [] };
    const headers = lines[0].map(normalizeHeader);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i];
      const values = {};
      let hasContent = false;
      headers.forEach((header, colIdx) => {
        const value = cells[colIdx];
        const canonical = HEADER_ALIASES[header];
        if (canonical && value !== undefined) values[canonical] = value;
        if (value !== undefined && String(value).trim() !== '') hasContent = true;
      });
      if (hasContent) rows.push({ rowIndex: i + 1, values });
    }
    return { rows, ignoredHeaders: headers.filter((h) => h && !HEADER_ALIASES[h]) };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { rows: [], ignoredHeaders: [] };

  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value);
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = {};
    let hasContent = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      let raw = cell.value;
      if (raw && typeof raw === 'object' && 'result' in raw) raw = raw.result; // cellule formule
      if (raw && typeof raw === 'object' && 'richText' in raw) raw = raw.richText.map((r) => r.text).join('');
      const canonical = HEADER_ALIASES[header];
      if (canonical) values[canonical] = raw;
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') hasContent = true;
    });
    if (hasContent) rows.push({ rowIndex: rowNumber, values });
  });

  return { rows, ignoredHeaders: headers.filter((h) => h && !HEADER_ALIASES[h]) };
}

// Extrait un ZIP produits.xlsx/csv + images/<reference>/*.jpg entièrement en
// mémoire (buffers), sans jamais utiliser le chemin fourni par l'entrée ZIP
// pour écrire sur le disque — évite toute traversée de chemin ("zip slip").
export function readZipArchive(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`Le ZIP contient trop de fichiers (max ${MAX_ZIP_ENTRIES}).`);
  }
  const totalDeclaredBytes = entries.reduce((sum, entry) => sum + (entry.header?.size || 0), 0);
  if (totalDeclaredBytes > MAX_TOTAL_DECLARED_BYTES) {
    throw new Error('Le contenu décompressé du ZIP dépasse la taille maximale autorisée.');
  }

  let spreadsheet = null;
  const imagesByReference = new Map();

  for (const entry of entries) {
    const name = entry.entryName.replace(/\\/g, '/');
    const declaredSize = entry.header?.size || 0;

    const sheetMatch = name.match(SPREADSHEET_RE);
    if (sheetMatch && !spreadsheet) {
      if (declaredSize > MAX_SPREADSHEET_BYTES) continue;
      spreadsheet = { buffer: entry.getData(), ext: sheetMatch[1].toLowerCase() };
      continue;
    }

    const imageMatch = name.match(IMAGE_RE);
    if (imageMatch) {
      // Taille déclarée vérifiée AVANT décompression (getData()) — jamais
      // après — pour ne jamais allouer de mémoire pour une entrée mensongère.
      if (declaredSize === 0 || declaredSize > MAX_IMAGE_BYTES) continue;
      const data = entry.getData();
      if (data.length === 0 || data.length > MAX_IMAGE_BYTES) continue;
      const [, reference, filename, ext] = imageMatch;
      const list = imagesByReference.get(reference) || [];
      list.push({ buffer: data, filename, ext: ext.toLowerCase() });
      imagesByReference.set(reference, list);
    }
  }

  for (const list of imagesByReference.values()) {
    list.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  }

  return { spreadsheet, imagesByReference };
}

// Matérialise les images extraites du ZIP en fichiers temporaires — requis
// car uploadImage() (utils/upload.js) attend un chemin disque, pas un
// buffer, pour rester cohérent avec le reste de l'app (upload simple,
// justificatifs KYC). Les noms de fichiers sont générés ici (jamais dérivés
// du nom d'entrée ZIP), donc sans risque de traversée de chemin.
export function materializeImages(imagesByReference) {
  fs.mkdirSync(tempDir, { recursive: true });
  const materialized = new Map();
  for (const [reference, images] of imagesByReference.entries()) {
    const paths = images.map((img) => {
      const dest = path.join(tempDir, `import-${randomUUID()}.${img.ext}`);
      fs.writeFileSync(dest, img.buffer);
      return dest;
    });
    materialized.set(reference, paths);
  }
  return materialized;
}

export function cleanupImagePaths(imagesByReference) {
  if (!imagesByReference) return;
  for (const paths of imagesByReference.values()) {
    for (const filePath of paths) {
      fs.unlink(filePath, () => {});
    }
  }
}

function matchCategory(name, categories) {
  const target = normalizeText(name);
  if (!target) return null;
  return categories.find((c) => normalizeText(c.nom) === target) || null;
}

// Valide et normalise chaque ligne du fichier — c'est ce qui alimente
// l'écran de prévisualisation (✅ ok / ⚠️ avertissement / ❌ erreur) avant que
// le vendeur ne confirme l'import. Les lignes en erreur sont exclues de la
// création en masse ; les avertissements n'empêchent pas la création.
export function buildImportPreview(parsed, { categories, existingReferences, imagesByReference }) {
  const seenReferences = new Set();

  const rows = parsed.rows.map(({ rowIndex, values }) => {
    const errors = [];
    const warnings = [];

    const nom = String(values.nom ?? '').trim();
    if (!nom) errors.push('Nom du produit manquant.');

    let description = String(values.description ?? '').trim();
    if (!description) {
      warnings.push('Description manquante — le nom du produit sera utilisé par défaut.');
      description = nom;
    }

    const prix = parseDecimal(values.prix);
    if (prix === null || prix <= 0) errors.push('Prix invalide ou manquant.');

    let stock = 0;
    if (values.stock !== undefined && String(values.stock).trim() !== '') {
      const parsedStock = parseInt(String(values.stock).replace(',', '.'), 10);
      if (!Number.isFinite(parsedStock) || parsedStock < 0) {
        errors.push('Stock invalide (doit être un entier positif ou nul).');
      } else {
        stock = parsedStock;
      }
    }

    const referenceRaw = String(values.reference ?? '').trim();
    const reference = referenceRaw || null;
    if (reference) {
      if (seenReferences.has(reference)) errors.push(`Référence "${reference}" en double dans ce fichier.`);
      seenReferences.add(reference);
      if (existingReferences.has(reference)) errors.push(`Référence "${reference}" déjà utilisée par un produit existant.`);
    } else {
      warnings.push("Aucune référence fournie — impossible d'associer des photos automatiquement.");
    }

    const categorieRaw = String(values.categorie ?? '').trim();
    let categorieId = null;
    let categorieNom = null;
    if (categorieRaw) {
      const match = matchCategory(categorieRaw, categories);
      if (match) {
        categorieId = match.id;
        categorieNom = match.nom;
      } else {
        warnings.push(`Catégorie "${categorieRaw}" non reconnue — le produit sera créé sans catégorie.`);
      }
    }

    const marque = String(values.marque ?? '').trim() || null;

    const imagePaths = reference ? (imagesByReference.get(reference) || []) : [];
    if (reference && imagePaths.length === 0) {
      warnings.push('Aucune photo trouvée pour cette référence dans le ZIP.');
    }

    const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

    return {
      rowIndex, nom, description, prix, stock, reference, marque,
      categorieId, categorieNom, categorieRaw: categorieRaw || null,
      imageCount: imagePaths.length, imagePaths,
      status, errors, warnings,
    };
  });

  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    warning: rows.filter((r) => r.status === 'warning').length,
    error: rows.filter((r) => r.status === 'error').length,
    ignoredHeaders: parsed.ignoredHeaders || [],
  };

  return { rows, summary };
}

export function buildImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produits');
  sheet.columns = [
    { header: 'reference', key: 'reference', width: 14 },
    { header: 'nom', key: 'nom', width: 28 },
    { header: 'description', key: 'description', width: 42 },
    { header: 'prix', key: 'prix', width: 10 },
    { header: 'prix_avant', key: 'prixAvant', width: 12 },
    { header: 'stock', key: 'stock', width: 8 },
    { header: 'categorie', key: 'categorie', width: 20 },
    { header: 'marque', key: 'marque', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    reference: 'P001', nom: 'T-shirt homme', description: 'T-shirt 100% coton, coupe droite.',
    prix: 39.9, prixAvant: '', stock: 50, categorie: 'Vêtements', marque: 'Nike',
  });
  sheet.addRow({
    reference: 'P002', nom: 'Chaussures de sport', description: 'Chaussures de running légères et respirantes.',
    prix: 129, prixAvant: '', stock: 20, categorie: 'Chaussures', marque: 'Adidas',
  });
  return workbook;
}
