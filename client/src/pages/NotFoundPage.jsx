import React from 'react';
import { SearchX } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

/** Adresse inconnue : message clair plutôt qu'une redirection silencieuse vers l'accueil. */
export default function NotFoundPage({ language = 'fr', navigate }) {
  const tr = (fr, ar) => (language === 'ar' ? ar : fr);
  useDocumentTitle(tr('Page introuvable — buyhere.', 'الصفحة غير موجودة — buyhere.'));

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F8E4DE] text-[#C4532C]">
        <SearchX size={30} aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-slate-900">{tr('Page introuvable', 'الصفحة غير موجودة')}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {tr(
          "Le lien est peut-être erroné, ou la page n'existe plus.",
          'قد يكون الرابط خاطئًا أو أن الصفحة لم تعد موجودة.',
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={() => navigate('/')} className="btn-primary-premium px-5 py-2.5 text-sm">
          {tr("Retour à l'accueil", 'العودة إلى الرئيسية')}
        </button>
        <button
          onClick={() => navigate('/catalogue')}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          {tr('Voir le catalogue', 'تصفح الكتالوج')}
        </button>
      </div>
    </section>
  );
}
