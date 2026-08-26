import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../../client/public/logo-icon.png');

const BRAND = '#6366F1';
const BRAND_DARK = '#4338CA';
const TEXT = '#1E293B';
const MUTED = '#64748B';
const LIGHT_ROW = '#F8FAFC';
const BORDER = '#E2E8F0';

function money(value) {
  return `${Number(value || 0).toFixed(3)} TND`;
}

export function generateInvoicePDF(commande, client, boutique, lignes, lang = 'fr') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const isAr = lang === 'ar';
    const t = (fr, ar) => (isAr ? ar : fr);
    const pageWidth = doc.page.width;
    const marginX = 50;
    const contentWidth = pageWidth - marginX * 2;

    // --- Header band ---
    doc.rect(0, 0, pageWidth, 110).fill(BRAND);
    try {
      doc.image(LOGO_PATH, marginX, 30, { width: 50 });
    } catch (e) {
      // Logo optional — skip silently if the asset isn't reachable from this process.
    }
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF').text('here.tn', marginX + 62, 34);
    doc.font('Helvetica').fontSize(9).fillColor('#E0E7FF').text(
      t('Votre marketplace, ici et maintenant', 'سوقك، هنا والآن'),
      marginX + 62,
      60,
    );

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#FFFFFF').text(t('FACTURE', 'فاتورة'), 0, 32, {
      align: 'right',
      width: pageWidth - marginX,
    });
    doc.font('Helvetica').fontSize(9).fillColor('#E0E7FF').text(`N° ${commande.numeroCommande}`, 0, 56, {
      align: 'right',
      width: pageWidth - marginX,
    });
    doc.text(new Date(commande.createdAt).toLocaleDateString(isAr ? 'ar-TN' : 'fr-TN'), 0, 70, {
      align: 'right',
      width: pageWidth - marginX,
    });

    // --- Facturé à / Vendu par ---
    let y = 140;
    const colWidth = (contentWidth - 24) / 2;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(t('FACTURÉ À', 'فوترة إلى'), marginX, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT).text(`${client.prenom} ${client.nom}`, marginX, y + 16);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(client.email, marginX, y + 32);
    if (client.telephone) doc.text(client.telephone, marginX, y + 46);

    if (boutique) {
      const col2X = marginX + colWidth + 24;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(t('VENDU PAR', 'البائع'), col2X, y);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT).text(boutique.nom, col2X, y + 16);
      if (boutique.adresse) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(boutique.adresse, col2X, y + 32, { width: colWidth });
      }
    }

    // --- Items table ---
    y += 80;
    const tableX = marginX;
    const tableWidth = contentWidth;

    doc.rect(tableX, y, tableWidth, 24).fill(BRAND_DARK);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
    doc.text(t('PRODUIT', 'المنتج'), tableX + 12, y + 8, { width: 220 });
    doc.text(t('QTÉ', 'الكمية'), tableX + 250, y + 8, { width: 50, align: 'center' });
    doc.text(t('P.U.', 'س.و'), tableX + 300, y + 8, { width: 90, align: 'right' });
    doc.text(t('TOTAL', 'المجموع'), tableX + tableWidth - 92, y + 8, { width: 82, align: 'right' });
    y += 24;

    lignes.forEach((ligne, index) => {
      const rowHeight = 22;
      if (index % 2 === 1) {
        doc.rect(tableX, y, tableWidth, rowHeight).fill(LIGHT_ROW);
      }
      const produit = ligne.produit || ligne;
      const nom = produit.nom || `Produit #${ligne.produitId}`;
      const total = ligne.prixUnitaire * ligne.quantite;

      doc.font('Helvetica').fontSize(9).fillColor(TEXT);
      doc.text(nom, tableX + 12, y + 6, { width: 220 });
      doc.text(String(ligne.quantite), tableX + 250, y + 6, { width: 50, align: 'center' });
      doc.text(money(ligne.prixUnitaire), tableX + 300, y + 6, { width: 90, align: 'right' });
      doc.font('Helvetica-Bold').text(money(total), tableX + tableWidth - 92, y + 6, { width: 82, align: 'right' });
      y += rowHeight;
    });

    doc.strokeColor(BORDER).lineWidth(1).moveTo(tableX, y).lineTo(tableX + tableWidth, y).stroke();
    y += 18;

    // --- Totals box ---
    const summary = [
      [t('Sous-total', 'المجموع الفرعي'), money(commande.sousTotal || commande.total)],
      [t('Frais livraison', 'رسوم التوصيل'), money(commande.fraisLivraison || 0)],
    ];
    if (commande.remiseCoupon > 0) {
      summary.push([t('Remise coupon', 'خصم القسيمة'), `-${money(commande.remiseCoupon)}`]);
    }
    if (commande.walletUtilise > 0) {
      summary.push([t('Solde utilisé', 'الرصيد المستخدم'), `-${money(commande.walletUtilise)}`]);
    }

    const boxWidth = 230;
    const boxX = tableX + tableWidth - boxWidth;

    for (const [label, value] of summary) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, boxX, y, { width: 130 });
      doc.fillColor(TEXT).text(value, boxX, y, { width: boxWidth, align: 'right' });
      y += 16;
    }

    y += 4;
    doc.rect(boxX, y, boxWidth, 30).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF');
    doc.text(t('TOTAL', 'المجموع'), boxX + 14, y + 9);
    doc.text(money(commande.total), boxX, y + 9, { width: boxWidth - 14, align: 'right' });

    // --- Footer ---
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
      t('Merci pour votre confiance — here.tn', 'شكراً لثقتكم — here.tn'),
      marginX,
      780,
      { align: 'center', width: tableWidth },
    );
    doc.fillColor('#94A3B8').text(
      t(
        'here.tn Marketplace • support@here.tn • Cette facture ne constitue pas un document fiscal officiel.',
        'here.tn Marketplace • support@here.tn • هذه الفاتورة ليست وثيقة ضريبية رسمية.',
      ),
      marginX,
      794,
      { align: 'center', width: tableWidth },
    );

    doc.end();
  });
}

export function generateAwbPDF(livraison, commande, adresse) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A5' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#6366F1').text('BORDEREAU D\'EXPÉDITION', { align: 'center' });
    doc.fontSize(12).fillColor('#1E293B').text('here.tn', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`AWB: ${livraison.awbNumber}`);
    doc.text(`Tracking: ${livraison.trackingId}`);
    doc.text(`Commande: ${commande.numeroCommande}`);
    doc.text(`Transporteur: ${livraison.transporteur}`);
    doc.moveDown();

    doc.fontSize(11).fillColor('#0F766E').text('Adresse de livraison:');
    doc.fontSize(10).fillColor('#1E293B').text(adresse);
    doc.moveDown();

    doc.fontSize(9).fillColor('#64748B').text(`Statut: ${livraison.statut}`, { align: 'center' });
    doc.text(`Généré le ${new Date().toLocaleString('fr-TN')}`, { align: 'center' });

    doc.end();
  });
}
