import { CashOnDeliveryProvider } from './CashOnDeliveryProvider.js';
import { FlouciProvider } from './FlouciProvider.js';
import { KonnectProvider } from './KonnectProvider.js';
import { SandboxMockProvider, paymentModeWarning } from './SandboxMockProvider.js';

const providers = {
  cod: new CashOnDeliveryProvider(),
  flouci: new FlouciProvider(),
  konnect: new KonnectProvider(),
  sandbox: new SandboxMockProvider(),
};

export function getProvider(name) {
  const provider = providers[name];
  if (!provider) throw new Error(`Prestataire de paiement inconnu: ${name}`);
  return provider;
}

// Avertissements de configuration à journaliser au démarrage (production).
export function paymentConfigWarnings() {
  const warnings = [];
  const modeWarning = paymentModeWarning();
  if (modeWarning) warnings.push(modeWarning);
  if (process.env.NODE_ENV === 'production') {
    for (const envName of ['KONNECT_WEBHOOK_SECRET', 'FLOUCI_WEBHOOK_SECRET']) {
      if (!process.env[envName]) warnings.push(`${envName} absent : tous les webhooks ${envName.split('_')[0].toLowerCase()} seront refusés (401).`);
    }
  }
  return warnings;
}

export { PaymentProvider } from './PaymentProvider.js';
