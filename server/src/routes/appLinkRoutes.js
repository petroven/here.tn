import express from 'express';

const router = express.Router();

// Vérification des liens d'application : un lien https://<domaine>/produits/12
// partagé sur WhatsApp s'ouvre directement dans l'app BuyHere si elle est
// installée (sinon dans le navigateur, sur la même page du site).
//
// Android App Links — l'empreinte SHA-256 du certificat de signature
// (Play Console → Intégrité de l'application, ou `eas credentials`) doit
// être fournie dans ANDROID_SHA256_CERT_FINGERPRINTS (plusieurs séparées par
// des virgules). iOS Universal Links — APPLE_APP_ID = <TeamID>.tn.buyhere.app.
// Sans ces variables les fichiers renvoient 404 : le navigateur garde la main.
const ANDROID_PACKAGE = process.env.ANDROID_APP_PACKAGE || 'tn.buyhere.app';

// Chemins du site que l'app sait ouvrir (voir mobile/src/navigation/linking.ts).
const CHEMINS_APP = ['/produits/*', '/boutiques/*', '/commandes', '/commande/*', '/coupons', '/promotion/*'];

router.get('/.well-known/assetlinks.json', (_req, res) => {
  const empreintes = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!empreintes.length) return res.status(404).json([]);
  return res.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: empreintes },
  }]);
});

router.get(['/.well-known/apple-app-site-association', '/apple-app-site-association'], (_req, res) => {
  const appId = process.env.APPLE_APP_ID;
  if (!appId) return res.status(404).json({});
  res.type('application/json');
  return res.send(JSON.stringify({
    applinks: { apps: [], details: [{ appIDs: [appId], components: CHEMINS_APP.map((chemin) => ({ '/': chemin })) }] },
  }));
});

export default router;
