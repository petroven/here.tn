const KONNECT_SANDBOX_URL = process.env.KONNECT_SANDBOX_URL || 'https://api.sandbox.konnect.network/api/v2/payments/init-payment';
const FLOUCI_SANDBOX_URL = process.env.FLOUCI_SANDBOX_URL || 'https://developers.flouci.com/api/generate_payment';
const paymentMode = process.env.PAYMENT_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const isSandbox = paymentMode === 'sandbox' && process.env.NODE_ENV !== 'production';

function paymentFailure(provider, message) {
  const error = new Error(`${provider}: ${message}`);
  error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  throw error;
}

export async function initKonnectPayment({ amount, orderId, email, phone }) {
  const apiKey = process.env.KONNECT_API_KEY || 'sandbox_konnect_key';

  try {
    const response = await fetch(KONNECT_SANDBOX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        receiverWalletId: process.env.KONNECT_WALLET_ID || 'sandbox_wallet',
        token: 'TND',
        amount: Math.round(amount * 1000),
        type: 'immediate',
        description: `Commande ${orderId}`,
        acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
        lifespan: 30,
        checkoutForm: true,
        addPaymentFeesToAmount: false,
        firstName: email.split('@')[0],
        phoneNumber: phone || '+21600000000',
        email,
        orderId: String(orderId),
        // NOTE: confirmer ces noms de champs (successUrl/failUrl/webhook)
        // contre la documentation Konnect réelle avant mise en production —
        // je n'ai pas d'accès live à leur API pour les vérifier.
        successUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/return?order=${orderId}&status=success`,
        failUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/return?order=${orderId}&status=fail`,
        webhook: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/payments/webhook/konnect`,
      }),
    });

    if (!response.ok) {
      if (!isSandbox) paymentFailure('Konnect', 'la passerelle a refusé la demande.');
      return mockPaymentResponse('konnect', amount, orderId);
    }
    const data = await response.json();
    return {
      success: true,
      provider: 'konnect',
      paymentUrl: data.payUrl || data.paymentUrl,
      paymentRef: data.paymentRef || `KNK-${orderId}`,
      sandbox: isSandbox,
    };
  } catch (error) {
    if (!isSandbox) throw error;
    return mockPaymentResponse('konnect', amount, orderId);
  }
}

export async function initFlouciPayment({ amount, orderId, email }) {
  const appToken = process.env.FLOUCI_APP_TOKEN || 'sandbox_flouci_token';
  const appSecret = process.env.FLOUCI_APP_SECRET || 'sandbox_flouci_secret';

  try {
    const response = await fetch(FLOUCI_SANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_token: appToken,
        app_secret: appSecret,
        amount: Math.round(amount * 1000),
        accept_card: true,
        session_timeout_secs: 1800,
        success_link: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/return?order=${orderId}&status=success`,
        fail_link: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/return?order=${orderId}&status=fail`,
        developer_tracking_id: String(orderId),
      }),
    });

    if (!response.ok) {
      if (!isSandbox) paymentFailure('Flouci', 'la passerelle a refusé la demande.');
      return mockPaymentResponse('flouci', amount, orderId);
    }
    const data = await response.json();
    return {
      success: true,
      provider: 'flouci',
      paymentUrl: data.result?.link || data.link,
      paymentRef: data.result?.payment_id || `FLC-${orderId}`,
      sandbox: isSandbox,
    };
  } catch (error) {
    if (!isSandbox) throw error;
    return mockPaymentResponse('flouci', amount, orderId);
  }
}

function mockPaymentResponse(provider, amount, orderId) {
  const ref = `${provider.toUpperCase()}-SANDBOX-${orderId}-${Date.now()}`;
  return {
    success: true,
    provider,
    paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/sandbox?ref=${ref}&amount=${amount}`,
    paymentRef: ref,
    sandbox: true,
    mock: true,
  };
}

export async function confirmSandboxPayment(paymentRef) {
  if (!isSandbox) paymentFailure('Paiement', 'la confirmation sandbox est désactivée en production.');
  return {
    success: true,
    statut: 'valide',
    reference: paymentRef,
    message: 'Paiement sandbox confirmé (CIB / E-Dinar simulé).',
  };
}
