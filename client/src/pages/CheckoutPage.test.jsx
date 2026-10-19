// Panier et checkout : totaux affichés (livraison et timbre par boutique),
// commande envoyée sans aucun prix (le serveur recalcule tout), choix du mode
// de paiement, redirection prestataire et paiement sandbox sans données de carte
// transmises au serveur.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CheckoutPage from './CheckoutPage.jsx';

const PANIER = [
  { id: 1, nom: 'Chéchia', prix: 50, quantity: 2, stock: 10, boutiqueId: 1, boutiqueNom: 'Souk A' },
  { id: 2, nom: 'Harissa', prix: 20, quantity: 1, stock: 10, boutiqueId: 2, boutiqueNom: 'Souk B', varianteId: 7 },
];

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

// Routeur de fetch simulé ; `commande` décrit la réponse de POST /commandes.
function installerFetch({ paiementTest = false, commande = { commande: { id: 99, numeroCommande: 'CMD-99' } }, confirm } = {}) {
  const appels = [];
  const fetchMock = vi.fn(async (url, options = {}) => {
    appels.push({ url, options });
    if (url.endsWith('/config/payment-methods')) return ok({ virementDisponible: false, platformBank: null, paiementTest, tvaTaux: 0.19, timbreFiscal: 1 });
    if (url.endsWith('/wallet/me')) return ok({ solde: 0 });
    if (url.endsWith('/gouvernorats')) return ok([{ id: 1, nom: 'Tunis', nomAr: 'تونس', fraisLivraison: 7 }]);
    if (url.endsWith('/gouvernorats/1/delegations')) return ok([{ id: 10, nom: 'Bab Bhar' }]);
    if (url.endsWith('/commandes')) return ok(commande);
    if (url.endsWith('/paiements/confirm')) return confirm ? confirm() : ok({ statut: 'valide' });
    if (url.endsWith('/coupons/valider')) return ok({ code: 'BIENVENUE10', remise: 12 });
    throw new Error(`fetch inattendu : ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return appels;
}

const corps = (appels, suffixe) => {
  const appel = appels.find((a) => a.url.endsWith(suffixe) && a.options.method === 'POST');
  return appel ? JSON.parse(appel.options.body) : null;
};

async function remplirLivraison() {
  fireEvent.click(screen.getAllByText('Continuer vers la livraison')[0]);
  fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'Amel' } });
  fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Ben Salah' } });
  await screen.findByRole('option', { name: 'Tunis' });
  fireEvent.change(screen.getByLabelText('Gouvernorat'), { target: { value: '1' } });
  await screen.findByRole('option', { name: 'Bab Bhar' });
  fireEvent.change(screen.getByLabelText('Délégation'), { target: { value: '10' } });
  fireEvent.change(screen.getByPlaceholderText('Rue, Cité, Numéro de maison'), { target: { value: '5 rue de Marseille' } });
  fireEvent.change(screen.getByPlaceholderText('Téléphone tunisien (Ex: 98123456)'), { target: { value: '98123456' } });
}

const soumettre = () => fireEvent.submit(screen.getByText('Passer commande').closest('form'));

beforeEach(() => {
  localStorage.setItem('token', 'jeton-client');
  localStorage.setItem('userId', '3');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('CheckoutPage — totaux', () => {
  it('sous-total, livraison et timbre par boutique, total TTC', async () => {
    installerFetch();
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();

    // 2 × 50 + 20 = 120 ; livraison 7 × 2 boutiques = 14 ; timbre 1 × 2 = 2 → 136
    expect(screen.getByText('120.000 TND')).toBeTruthy();
    expect(screen.getByText('14.000 TND')).toBeTruthy();
    expect(screen.getByText('136.000 TND')).toBeTruthy();
  });
});

describe('CheckoutPage — validation et envoi', () => {
  it('adresse incomplète → message d’erreur, aucune commande envoyée', async () => {
    const appels = installerFetch();
    render(<CheckoutPage cartItems={PANIER} />);
    fireEvent.click(screen.getAllByText('Continuer vers la livraison')[0]);
    soumettre();
    expect(await screen.findByText('Veuillez renseigner toutes les informations de livraison.')).toBeTruthy();
    expect(corps(appels, '/commandes')).toBeNull();
  });

  it('commande COD : lignes sans prix ni total (recalculés par le serveur), puis confirmation', async () => {
    const appels = installerFetch();
    const onOrderPlaced = vi.fn();
    render(<CheckoutPage cartItems={PANIER} onOrderPlaced={onOrderPlaced} />);
    await remplirLivraison();
    soumettre();

    expect(await screen.findByText('Commande créée avec succès!')).toBeTruthy();
    const body = corps(appels, '/commandes');
    expect(body.methodePaiement).toBe('cod');
    expect(body.lignes).toEqual([
      { produitId: 1, varianteId: null, quantite: 2 },
      { produitId: 2, varianteId: 7, quantite: 1 },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/"(prix|total|montant|sousTotal)"/);
    expect(body.gouvernoratId).toBe(1);
    expect(body.delegationId).toBe(10);
    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('erreur serveur → message affiché, pas de confirmation', async () => {
    installerFetch();
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();
    vi.mocked(fetch).mockImplementation(async (url) => (url.endsWith('/commandes')
      ? { ok: false, status: 409, json: async () => ({ success: false, message: 'Stock insuffisant pour Harissa.' }) }
      : ok({})));
    soumettre();
    expect(await screen.findByText('Stock insuffisant pour Harissa.')).toBeTruthy();
    expect(screen.queryByText('Commande créée avec succès!')).toBeNull();
  });
});

describe('CheckoutPage — coupon', () => {
  it('« Appliquer » valide le coupon sans passer la commande', async () => {
    const appels = installerFetch();
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();
    fireEvent.change(screen.getByPlaceholderText('Code coupon'), { target: { value: 'BIENVENUE10' } });
    fireEvent.click(screen.getByText('Appliquer'));

    expect(await screen.findByText('BIENVENUE10')).toBeTruthy();
    expect(corps(appels, '/coupons/valider')).toEqual({ code: 'BIENVENUE10', sousTotal: 120 });
    expect(corps(appels, '/commandes')).toBeNull();
    // 136 − 12 de remise
    expect(screen.getByText('124.000 TND')).toBeTruthy();
  });

  it('Entrée dans le champ coupon valide le coupon sans passer la commande', async () => {
    const appels = installerFetch();
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();
    const champ = screen.getByPlaceholderText('Code coupon');
    fireEvent.change(champ, { target: { value: 'BIENVENUE10' } });
    fireEvent.keyDown(champ, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('BIENVENUE10')).toBeTruthy();
    expect(corps(appels, '/commandes')).toBeNull();
  });
});

describe('CheckoutPage — modes de paiement', () => {
  it('production (paiementTest=false) : Konnect et Flouci proposés sans badge « Test »', async () => {
    installerFetch({ paiementTest: false });
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();
    expect(screen.getByText('Konnect')).toBeTruthy();
    expect(screen.getByText('Flouci')).toBeTruthy();
    expect(screen.queryByText('Test')).toBeNull();
  });

  it('sandbox (paiementTest=true) : badge « Test » affiché', async () => {
    installerFetch({ paiementTest: true });
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();
    await waitFor(() => expect(screen.getAllByText('Test')).toHaveLength(2));
  });

  it('invité : paiement en ligne non proposé', async () => {
    localStorage.clear();
    installerFetch();
    render(<CheckoutPage cartItems={PANIER} />);
    fireEvent.click(screen.getAllByText('Continuer vers la livraison')[0]);
    expect(screen.queryByText('Konnect')).toBeNull();
    expect(screen.getByText('Le paiement en ligne est réservé aux comptes connectés.')).toBeTruthy();
  });

  it('paiement réel : message de redirection vers le prestataire', async () => {
    const appels = installerFetch({ commande: { commande: { id: 99 }, paymentRedirect: { paymentUrl: 'https://pay.konnect.example/session/abc' } } });
    render(<CheckoutPage cartItems={PANIER} />);
    await remplirLivraison();
    fireEvent.click(screen.getByText('Konnect'));
    soumettre();
    expect(await screen.findByText('Redirection vers le paiement sécurisé...')).toBeTruthy();
    expect(corps(appels, '/commandes').methodePaiement).toBe('konnect');
  });

  it('sandbox : seule la référence de paiement est envoyée, jamais les données de carte', async () => {
    const appels = installerFetch({ paiementTest: true, commande: { commande: { id: 99 }, paymentRedirect: { sandbox: true, paymentRef: 'KONNECT-SANDBOX-99' } } });
    const onOrderPlaced = vi.fn();
    render(<CheckoutPage cartItems={PANIER} onOrderPlaced={onOrderPlaced} />);
    await remplirLivraison();
    fireEvent.click(screen.getByText('Konnect'));
    soumettre();

    const nom = await screen.findByPlaceholderText('Nom du titulaire');
    fireEvent.change(nom, { target: { value: 'AMEL BEN SALAH' } });
    fireEvent.change(screen.getByPlaceholderText('4000 0000 0000 0000'), { target: { value: '4242424242424242' } });
    fireEvent.change(screen.getByPlaceholderText('MM/AA'), { target: { value: '1230' } });
    fireEvent.change(screen.getByPlaceholderText('CVV'), { target: { value: '123' } });
    fireEvent.submit(nom.closest('form'));

    await waitFor(() => expect(corps(appels, '/paiements/confirm')).not.toBeNull());
    expect(corps(appels, '/paiements/confirm')).toEqual({ paymentRef: 'KONNECT-SANDBOX-99' });
    const toutesLesRequetes = appels.map((a) => a.options.body || '').join('\n');
    expect(toutesLesRequetes).not.toMatch(/4242|"cvv"|"123"/);
  });
});
