export async function sendSMS({ to, message }) {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'twilio' && process.env.TWILIO_ACCOUNT_SID) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    const data = await response.json();
    return { success: response.ok, data };
  }

  if (provider === 'winsms' && process.env.WINSMS_API_KEY) {
    const response = await fetch('https://www.winsmspro.com/sms/sms/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.WINSMS_API_KEY,
        to,
        message,
        sender: process.env.WINSMS_SENDER || 'here.tn',
      }),
    });
    const data = await response.json();
    return { success: response.ok, data };
  }

  console.log(`[SMS MOCK] → ${to}: ${message}`);
  return { success: true, mock: true, to, message };
}

export function smsConfirmationCommande(telephone, numeroCommande, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
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
