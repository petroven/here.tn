// Identifiants requis par fournisseur réel.
const SMS_CREDENTIALS = {
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
  winsms: ['WINSMS_API_KEY'],
};

function smsRequest(provider, { to, message }) {
  if (provider === 'twilio') {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    return fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_NUMBER, Body: message }),
    });
  }
  return fetch('https://www.winsmspro.com/sms/sms/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.WINSMS_API_KEY, to, message, sender: process.env.WINSMS_SENDER || 'here.tn' }),
  });
}

// Mauvaise configuration SMS à signaler au démarrage (production), sinon null.
export function smsConfigWarning() {
  const provider = process.env.SMS_PROVIDER || 'mock';
  if (SMS_CREDENTIALS[provider]) {
    const manquants = SMS_CREDENTIALS[provider].filter((name) => !process.env[name]);
    return manquants.length ? `SMS_PROVIDER=${provider} sans ${manquants.join(', ')} : aucun SMS ne sera envoyé.` : null;
  }
  if (provider !== 'mock') return `SMS_PROVIDER=${provider} inconnu (twilio, winsms ou mock) : aucun SMS ne sera envoyé.`;
  return process.env.NODE_ENV === 'production' ? 'SMS_PROVIDER=mock : aucun SMS réel n\'est envoyé (journalisés seulement).' : null;
}

// Ne lève jamais (l'action métier qui déclenche le SMS est déjà enregistrée)
// et n'annonce jamais un faux succès : tout échec est journalisé et renvoie
// success: false. En production, le mode mock n'est pas un envoi réussi.
export async function sendSMS({ to, message }) {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[SMS] Non envoyé (SMS_PROVIDER=mock) → ${to}`);
      return { success: false, mock: true, error: 'Aucun fournisseur SMS configuré.' };
    }
    console.log(`[SMS MOCK] → ${to}: ${message}`);
    return { success: true, mock: true, to, message };
  }

  const requis = SMS_CREDENTIALS[provider];
  const manquants = requis ? requis.filter((name) => !process.env[name]) : null;
  if (!requis || manquants.length) {
    const error = requis ? `${provider} non configuré (${manquants.join(', ')} manquant)` : `fournisseur SMS inconnu : ${provider}`;
    console.error(`[SMS] Échec → ${to} : ${error}`);
    return { success: false, error };
  }

  try {
    const response = await smsRequest(provider, { to, message });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`[SMS] Échec ${provider} → ${to} : HTTP ${response.status}`, data);
      return { success: false, error: `HTTP ${response.status}`, data };
    }
    return { success: true, data };
  } catch (error) {
    console.error(`[SMS] Échec ${provider} → ${to} :`, error.message);
    return { success: false, error: error.message };
  }
}

export function smsConfirmationCommande(telephone, numeroCommande, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
  return sendSMS({
    to: telephone,
    message: `here.tn: Confirmez votre commande ${numeroCommande} sous 48h pour eviter l'annulation: ${frontendUrl}/confirmer-commande/${token}`,
  });
}

export function smsStatutLivraison(telephone, trackingId, statut) {
  const labels = {
    en_preparation: 'En préparation',
    expedie: 'Expédié',
    en_cours_livraison: 'En cours de livraison',
    livre: 'Livré',
    retourne: 'Retourné',
  };
  return sendSMS({
    to: telephone,
    message: `here.tn: Votre colis ${trackingId} est ${labels[statut] || statut}.`,
  });
}
