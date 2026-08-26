import { useEffect, useState } from 'react';

const defaultAvis = [
  { id: 1, produit: 'Sac en cuir vintage', note: 5, commentaire: 'Très bonne qualité, livraison rapide.' },
  { id: 2, produit: 'Lampe design', note: 3, commentaire: 'Bonne lampe mais délai plus long.' },
];

export default function AdminPage() {
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBoutiques = async () => {
      try {
        const response = await fetch('/api/boutiques');
        if (!response.ok) {
          throw new Error('API unavailable');
        }

        const payload = await response.json();
        if (Array.isArray(payload?.data)) {
          setBoutiques(payload.data);
        }
      } catch (error) {
        console.error('Unable to load boutiques from API:', error);
        setBoutiques([
          { id: 1, nom: 'Luna Atelier', statut: 'validée' },
          { id: 2, nom: 'Nord Maison', statut: 'en attente' },
          { id: 3, nom: 'Maison Rose', statut: 'suspendue' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadBoutiques();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="rounded-3xl bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-bold">Back-office administrateur</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold">Boutiques</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Chargement des boutiques...</p>
          ) : (
            <div className="space-y-3">
              {boutiques.map((boutique) => (
                <div key={boutique.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                  <span>{boutique.nom}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{boutique.statut || 'validée'}</span>
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-sm">Gérer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold">Modération des avis</h2>
          <div className="space-y-3">
            {defaultAvis.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <strong>{item.produit}</strong>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">{item.note}/5</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.commentaire}</p>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg bg-emerald-600 px-2 py-1 text-sm text-white">Valider</button>
                  <button className="rounded-lg bg-rose-600 px-2 py-1 text-sm text-white">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
