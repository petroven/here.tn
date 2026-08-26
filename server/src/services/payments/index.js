import { CashOnDeliveryProvider } from './CashOnDeliveryProvider.js';
import { FlouciProvider } from './FlouciProvider.js';
import { KonnectProvider } from './KonnectProvider.js';
import { SandboxMockProvider } from './SandboxMockProvider.js';

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

export { PaymentProvider } from './PaymentProvider.js';
