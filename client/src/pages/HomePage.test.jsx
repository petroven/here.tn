// Page d'accueil : recherche réelle vers le catalogue, raccourcis de catégorie,
// confiance visible sous le hero, appels à l'action réels (pas de faux succès).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import HomePage from './HomePage.jsx';

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const PRODUITS = [1, 2, 3, 4].map((id) => ({ id, nom: `Produit ${id}`, prix: 10 * id, stock: 5, image: `https://img.example/p${id}.jpg`, boutiqueId: 1 }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.endsWith('/categories')) return ok([{ id: 7, nom: 'Artisanat' }, { id: 8, nom: 'Épicerie fine' }]);
    if (url.includes('/produits')) return ok(PRODUITS);
    if (url.endsWith('/boutiques')) return ok([{ id: 1, nom: 'Souk A', vendeur: { nom: 'Ben', prenom: 'Amel' } }]);
    return ok([]);
  }));
});

afterEach(() => {
  cleanup();
});

function afficher(props = {}) {
  const navigate = vi.fn();
  const setSelectedCategoryId = vi.fn();
  render(
    <HomePage navigate={navigate} setSelectedCategoryId={setSelectedCategoryId} onOpenProduct={vi.fn()} onOpenStore={vi.fn()} onAddToCart={vi.fn()} {...props} />,
  );
  return { navigate, setSelectedCategoryId };
}

describe('HomePage — visiteur', () => {
  it('la recherche du hero ouvre le catalogue filtré', async () => {
    const { navigate } = afficher();
    fireEvent.change(screen.getByLabelText('Rechercher un produit'), { target: { value: 'huile d’olive' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(navigate).toHaveBeenCalledWith(`/catalogue?q=${encodeURIComponent('huile d’olive')}`);
  });

  it('recherche vide : catalogue complet', () => {
    const { navigate } = afficher();
    fireEvent.submit(screen.getByRole('search'));
    expect(navigate).toHaveBeenCalledWith('/catalogue');
  });

  it('raccourci de catégorie : catalogue filtré sur la catégorie', async () => {
    const { navigate, setSelectedCategoryId } = afficher();
    fireEvent.click((await screen.findAllByText('Épicerie fine'))[0]);
    expect(setSelectedCategoryId).toHaveBeenCalledWith(8);
    expect(navigate).toHaveBeenCalledWith('/catalogue');
  });

  it('bandeau de confiance et produits affichés', async () => {
    afficher();
    expect(screen.getByText('Paiement sécurisé')).toBeTruthy();
    expect(screen.getByText('24 gouvernorats')).toBeTruthy();
    expect((await screen.findAllByText('Produit 1')).length).toBeGreaterThan(0);
  });

  it('appels à l’action réels : boutique, livreur, codes promo — plus de fausse newsletter', async () => {
    const { navigate } = afficher();
    fireEvent.click(screen.getByText('Ouvrir ma boutique'));
    expect(navigate).toHaveBeenCalledWith('/vendeur/inscription');
    fireEvent.click(screen.getByText('Devenir livreur'));
    expect(navigate).toHaveBeenCalledWith('/livreur/inscription');
    fireEvent.click(screen.getByText('Codes promo du moment'));
    expect(navigate).toHaveBeenCalledWith('/coupons');
    expect(screen.queryByText('Restez informé')).toBeNull();
    expect(screen.queryByText('Merci ! Vous êtes inscrit.')).toBeNull();
  });
});

describe('HomePage — client connecté', () => {
  it('pas de hero marketing ni d’appel aux vendeurs', () => {
    afficher({ user: { id: 3, role: 'client' } });
    expect(screen.queryByRole('search')).toBeNull();
    expect(screen.queryByText('Ouvrir ma boutique')).toBeNull();
    expect(screen.queryByText('Paiement sécurisé')).toBeNull();
  });
});
