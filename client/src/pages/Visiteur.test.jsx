// Pages réservées vues par un visiteur : avant, « Mes commandes » restait sur
// « Chargement de vos commandes… » sans fin. Elles montrent maintenant un titre
// et un bouton qui ouvre la connexion, sans appeler l'API.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientOrdersPage from './ClientOrdersPage.jsx';
import AccountPage from './AccountPage.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('pages réservées, visiteur', () => {
  it.each([
    ['Mes commandes', (props) => <ClientOrdersPage {...props} />],
    ['Mon compte', (props) => <AccountPage navigate={vi.fn()} {...props} />],
  ])('%s : titre, bouton de connexion, aucun appel réseau', (titre, Page) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const onRequireLogin = vi.fn();
    render(<MemoryRouter>{Page({ onRequireLogin })}</MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: titre })).toBeTruthy();
    expect(screen.queryByText('Chargement de vos commandes...')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(onRequireLogin).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});
