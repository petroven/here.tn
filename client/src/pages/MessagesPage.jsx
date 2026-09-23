import React from 'react';
import { MessageSquare } from 'lucide-react';
import ChatWidget from '../components/ChatWidget';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Messagerie client — page dédiée réutilisant ChatWidget en inlineMode (déjà
// utilisé ainsi par LivreurCourseDetail.jsx), plutôt qu'une deuxième
// implémentation de liste de conversations + fil de discussion.
export default function MessagesPage({ language = 'fr' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  useDocumentTitle(tr('Messagerie — BuyHere', 'المراسلة — BuyHere'));

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8E4DE] text-[#C4532C]">
          <MessageSquare size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tr('Messagerie', 'المراسلة')}</h1>
          <p className="text-sm text-slate-500">{tr('Vos conversations avec les boutiques et les livreurs', 'محادثاتكم مع المتاجر وعمال التوصيل')}</p>
        </div>
      </div>

      <ChatWidget inlineMode language={language} />
    </div>
  );
}
