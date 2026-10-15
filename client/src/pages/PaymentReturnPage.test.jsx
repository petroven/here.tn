// Retour du prestataire de paiement : la redirection (et son ?status=success)
// n'est jamais une preuve de paiement — seul le statut renvoyé par le serveur
// (alimenté par le webhook signé) peut afficher « Paiement confirmé ».
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import PaymentReturnPage from './PaymentReturnPage.jsx';

function statut(transactionStatut) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { commandeStatut: 'en_attente', transaction: transactionStatut ? { id: 1, statut: transactionStatut } : null },
    }),
  };
}

async function avancer(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

function ouvrir(query) {
  window.history.pushState({}, '', `/payment/return${query}`);
  render(<PaymentReturnPage onDone={() => {}} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('token', 'jeton-client');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('PaymentReturnPage', () => {
  it('?status=success sans confirmation serveur : jamais « Paiement confirmé », passe en attente', async () => {
    const fetchMock = vi.fn(async () => statut('en_attente'));
    vi.stubGlobal('fetch', fetchMock);
    ouvrir('?order=42&status=success');

    await avancer(0);
    expect(screen.queryByText('Paiement confirmé !')).toBeNull();
    for (let i = 0; i < 6; i += 1) await avancer(2000);

    expect(screen.getByText('Paiement en cours de traitement')).toBeTruthy();
    expect(screen.queryByText('Paiement confirmé !')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('interroge le statut de LA commande avec le jeton du client', async () => {
    const fetchMock = vi.fn(async () => statut('validee'));
    vi.stubGlobal('fetch', fetchMock);
    ouvrir('?order=42');
    await avancer(0);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/payments\/42\/status$/);
    expect(options.headers.Authorization).toBe('Bearer jeton-client');
  });

  it('transaction validée par le serveur (webhook) → « Paiement confirmé »', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => statut('validee')));
    ouvrir('?order=42&status=fail');
    await avancer(0);
    expect(screen.getByText('Paiement confirmé !')).toBeTruthy();
  });

  it('webhook arrivé avec retard : confirmé au 3e essai', async () => {
    const reponses = ['en_attente', 'en_attente', 'validee'];
    vi.stubGlobal('fetch', vi.fn(async () => statut(reponses.shift() ?? 'validee')));
    ouvrir('?order=42');
    await avancer(0);
    expect(screen.getByText('Vérification du paiement...')).toBeTruthy();
    await avancer(2000);
    await avancer(2000);
    expect(screen.getByText('Paiement confirmé !')).toBeTruthy();
  });

  it('transaction en échec côté serveur → « Paiement échoué », même avec ?status=success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => statut('echec')));
    ouvrir('?order=42&status=success');
    await avancer(0);
    expect(screen.getByText('Paiement échoué')).toBeTruthy();
  });

  it('sans numéro de commande → erreur, aucun appel réseau', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    ouvrir('?status=success');
    await avancer(0);
    expect(screen.getByText('Impossible de retrouver votre commande.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serveur injoignable → erreur affichée, pas de succès', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    ouvrir('?order=42&status=success');
    await avancer(0);
    expect(screen.getByText('Impossible de vérifier le statut du paiement.')).toBeTruthy();
    expect(screen.queryByText('Paiement confirmé !')).toBeNull();
  });
});
