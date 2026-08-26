import React, { useState, useEffect } from 'react';
import { ShoppingBag, FileDown, MessageSquare, RefreshCw, Star, AlertCircle, CheckCircle, Wallet, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { API_URL } from '../config/api.js';

const STATUT_LABELS = {
  en_attente: { fr: 'En attente', ar: 'قيد الانتظار' },
  payee: { fr: 'Payée', ar: 'مدفوعة' },
  expediee: { fr: 'Expédiée', ar: 'تم الشحن' },
  livree: { fr: 'Livrée', ar: 'تم التسليم' },
  annulee: { fr: 'Annulée', ar: 'ملغاة' },
  retournee: { fr: 'Retournée', ar: 'مرتجعة' },
};

export default function ClientOrdersPage({ onStartChat, language = 'fr' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const locale = isAr ? 'ar-TN' : 'fr-TN';

  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ solde: 0, transactions: [] });
  const [showWalletHistory, setShowWalletHistory] = useState(false);

  // RMA Modal State
  const [showRmaModal, setShowRmaModal] = useState(false);
  const [rmaForm, setRmaForm] = useState({ commandeId: '', motif: '', motifCategorie: 'non_conforme' });
  const [rmaPhotos, setRmaPhotos] = useState([]);
  const [rmaStatus, setRmaStatus] = useState({ type: '', message: '' });

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ produitId: '', commandeId: '', note: 5, commentaire: '' });
  const [reviewStatus, setReviewStatus] = useState({ type: '', message: '' });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      fetchMyOrders();
      fetchWallet();
    }
  }, [token]);

  const fetchWallet = async () => {
    try {
      const response = await fetch(`${API_URL}/wallet/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setWallet(data.data);
    } catch (err) {
      console.error('Error fetching wallet:', err);
    }
  };

  const fetchMyOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/commandes/mes-commandes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCommandes(data.data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (commandeId, numeroCommande) => {
    try {
      const response = await fetch(`${API_URL}/commandes/${commandeId}/facture?lang=${language}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(tr('Erreur de téléchargement.', 'خطأ في التحميل.'));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${numeroCommande}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(tr('Impossible de télécharger la facture.', 'تعذر تحميل الفاتورة.'));
    }
  };

  const handleCancelOrder = async (commandeId, numeroCommande) => {
    if (!window.confirm(tr(
      `Annuler la commande ${numeroCommande} ? Tout montant déjà payé sera recrédité sur votre solde here.tn.`,
      `إلغاء الطلب ${numeroCommande}؟ سيُضاف أي مبلغ مدفوع إلى رصيدكم على here.tn.`,
    ))) return;

    try {
      const response = await fetch(`${API_URL}/commandes/${commandeId}/annuler`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('Erreur lors de l\'annulation.', 'خطأ أثناء الإلغاء.'));
      fetchMyOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenRma = (commandeId) => {
    setRmaForm({ commandeId, motif: '', motifCategorie: 'non_conforme' });
    setRmaPhotos([]);
    setRmaStatus({ type: '', message: '' });
    setShowRmaModal(true);
  };

  const handleSubmitRma = async (e) => {
    e.preventDefault();
    if (rmaForm.motif.length < 10) {
      setRmaStatus({ type: 'error', message: tr('Le motif doit faire au moins 10 caractères.', 'يجب أن يتكون السبب من 10 أحرف على الأقل.') });
      return;
    }
    if (rmaPhotos.length === 0) {
      setRmaStatus({ type: 'error', message: tr('Au moins une photo est requise.', 'صورة واحدة على الأقل مطلوبة.') });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('commandeId', rmaForm.commandeId);
      formData.append('motif', rmaForm.motif);
      formData.append('motifCategorie', rmaForm.motifCategorie);
      rmaPhotos.forEach((file) => formData.append('photos', file));

      const response = await fetch(`${API_URL}/retours`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || tr('Erreur lors de la soumission du retour.', 'خطأ أثناء إرسال طلب الإرجاع.'));
      }

      setRmaStatus({ type: 'success', message: tr('Votre demande de retour a été enregistrée avec succès.', 'تم تسجيل طلب الإرجاع بنجاح.') });
      setTimeout(() => {
        setShowRmaModal(false);
        fetchMyOrders();
      }, 2000);
    } catch (err) {
      setRmaStatus({ type: 'error', message: err.message });
    }
  };

  const handleOpenReview = (produitId, commandeId) => {
    setReviewForm({ produitId, commandeId, note: 5, commentaire: '' });
    setReviewStatus({ type: '', message: '' });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/avis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewForm),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || tr('Erreur lors du dépôt de l\'avis.', 'خطأ أثناء إرسال التقييم.'));
      }

      setReviewStatus({ type: 'success', message: tr('Avis enregistré! Merci pour votre contribution.', 'تم تسجيل تقييمك! شكرًا لمساهمتك.') });
      setTimeout(() => {
        setShowReviewModal(false);
      }, 2000);
    } catch (err) {
      setReviewStatus({ type: 'error', message: err.message });
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">{tr('Chargement de vos commandes...', 'جارٍ تحميل طلباتك...')}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#6366F1]">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tr('Mes Commandes', 'طلباتي')}</h1>
          <p className="text-sm text-slate-500">{tr("Consultez l'état et l'historique de vos achats", 'تابع حالة وسجل مشترياتك')}</p>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <button
          onClick={() => setShowWalletHistory((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Wallet size={20} />
            </div>
            <div className="text-left rtl:text-right">
              <p className="text-xs font-semibold text-slate-500">{tr('Mon portefeuille', 'محفظتي')}</p>
              <p className="text-lg font-black text-slate-900">{wallet.solde.toFixed(3)} TND</p>
            </div>
          </div>
          {showWalletHistory ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {showWalletHistory && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {wallet.transactions.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">{tr('Aucune transaction pour le moment.', 'لا توجد معاملات بعد.')}</p>
            ) : (
              wallet.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-700">
                      {t.motif === 'cashback' ? tr('Cashback', 'استرداد نقدي') : t.motif === 'utilise_commande' ? tr('Utilisé au paiement', 'مستخدم في الدفع') : t.motif}
                    </p>
                    <p className="text-slate-400">
                      {t.Commande?.numeroCommande} · {new Date(t.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <span className={`font-bold ${t.type === 'credit' ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}{Number(t.montant).toFixed(3)} TND
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {commandes.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft">
          <p className="mb-4 text-slate-500">{tr("Vous n'avez pas encore passé de commande.", 'لم تقم بأي طلب بعد.')}</p>
          <a href="/" className="inline-block rounded-2xl bg-[#6366F1] px-6 py-3 text-sm font-bold text-white">
            {tr('Découvrir le catalogue', 'اكتشف الكتالوج')}
          </a>
        </div>
      ) : (
        <div className="space-y-5">
          {commandes.map((order) => {
            const isDelivered = order.statut === 'livree';
            const statutLabel = STATUT_LABELS[order.statut];
            const canCancel = ['en_attente', 'payee'].includes(order.statut)
              && (!order.livraison || order.livraison.statut === 'en_preparation');

            return (
              <div key={order.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
                {/* Order Top Bar */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{tr('Commande', 'الطلب')} #{order.numeroCommande}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {tr('Passée le', 'بتاريخ')} {new Date(order.createdAt).toLocaleDateString(locale)}
                      {order.boutique?.nom && <> · <span className="font-semibold text-slate-500">{order.boutique.nom}</span></>}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                      {statutLabel ? tr(statutLabel.fr, statutLabel.ar) : order.statut}
                    </span>
                    {order.confirmationStatut === 'en_attente' && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-amber-700">
                        {tr('Confirmation requise (SMS envoyé)', 'مطلوب تأكيد (تم إرسال رسالة نصية)')}
                      </span>
                    )}
                    {order.livraison && (
                      <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                        {tr('Code Suivi', 'رمز التتبع')}: {order.livraison.trackingId}
                      </span>
                    )}
                    <button
                      onClick={() => handleDownloadInvoice(order.id, order.numeroCommande)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                    >
                      <FileDown size={14} />
                      {tr('Facture PDF', 'فاتورة PDF')}
                    </button>
                    {canCancel && (
                      <button
                        onClick={() => handleCancelOrder(order.id, order.numeroCommande)}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      >
                        <XCircle size={14} />
                        {tr('Annuler ma commande', 'إلغاء طلبي')}
                      </button>
                    )}
                    {order.boutique?.vendeurId && onStartChat && (
                      <button
                        onClick={() => onStartChat(order.boutique.vendeurId, `${tr('Commande', 'الطلب')} ${order.numeroCommande}`)}
                        className="flex items-center gap-1.5 rounded-xl border border-teal-200 px-3 py-1.5 text-xs font-bold text-teal-700 transition hover:bg-teal-50 hover:text-teal-800"
                      >
                        <MessageSquare size={14} />
                        {tr('Vendeur', 'البائع')}
                      </button>
                    )}
                    {order.livraison?.livreur?.utilisateurId && onStartChat && (
                      <button
                        onClick={() => onStartChat(order.livraison.livreur.utilisateurId, `${tr('Livraison', 'التوصيل')} ${order.livraison.trackingId}`)}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50 hover:text-amber-800"
                      >
                        <MessageSquare size={14} />
                        {tr('Livreur', 'عامل التوصيل')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="mb-4 divide-y divide-slate-100">
                  {order.lignes?.map((ligne) => {
                    const product = ligne.produit || {};
                    return (
                      <div key={ligne.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                            {product.image ? (
                              <img src={product.image} alt={product.nom} className="h-full w-full object-cover" />
                            ) : (
                              <ShoppingBag size={18} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-slate-800">{product.nom || `${tr('Produit', 'منتج')} #${ligne.produitId}`}</h4>
                            <p className="mt-0.5 text-[10px] text-slate-400">{tr('Quantité', 'الكمية')}: {ligne.quantite}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{(ligne.prixUnitaire * ligne.quantite).toFixed(3)} TND</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{ligne.prixUnitaire.toFixed(3)} TND / {tr('u', 'وحدة')}</p>
                          </div>
                          {isDelivered && (
                            <button
                              onClick={() => handleOpenReview(ligne.produitId, order.id)}
                              className="flex items-center gap-1 rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1.5 text-[10px] font-bold text-teal-700 transition hover:bg-teal-100"
                            >
                              <Star size={10} className="fill-current text-teal-600" />
                              {tr('Laisser un avis', 'أضف تقييمًا')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals Summary & RMA Request Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>{tr('Mode paiement', 'طريقة الدفع')} : <span className="font-semibold uppercase text-slate-700">{order.paiement?.methode}</span></p>
                    <p>{tr('Frais livraison', 'مصاريف التوصيل')} : <span className="font-semibold text-slate-700">{(order.fraisLivraison || 0).toFixed(3)} TND</span></p>
                    {order.remiseCoupon > 0 && (
                      <p className="text-[#6366F1]">{tr('Réduction coupon', 'خصم الكوبون')} : -{order.remiseCoupon.toFixed(3)} TND</p>
                    )}
                    {order.walletUtilise > 0 && (
                      <p className="text-amber-700">{tr('Solde utilisé', 'الرصيد المستخدم')} : -{order.walletUtilise.toFixed(3)} TND</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] text-slate-400">{tr('Total payé', 'المجموع المدفوع')}</p>
                      <p className="text-base font-black text-[#6366F1]">{order.total.toFixed(3)} TND</p>
                    </div>

                    {isDelivered && (
                      <button
                        onClick={() => handleOpenRma(order.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      >
                        <RefreshCw size={14} />
                        {tr('Retourner/Signaler', 'إرجاع / إبلاغ')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RMA / Return Request Modal */}
      {showRmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-xl font-black text-slate-900">{tr('Demander un retour (RMA)', 'طلب إرجاع')}</h2>
            <p className="mb-6 text-xs text-slate-500">
              {tr('Votre réclamation sera transmise au vendeur pour validation, dans la fenêtre de retour propre à ce produit. Remboursement crédité rapidement sur votre solde here.tn.', 'سيتم إرسال طلبك إلى البائع للمراجعة، ضمن مهلة الإرجاع الخاصة بهذا المنتج. سيُضاف المبلغ المسترد بسرعة إلى رصيدكم على here.tn.')}
            </p>

            {rmaStatus.message && (
              <div
                className={`mb-4 flex gap-3 rounded-2xl border p-4 text-left text-sm ${
                  rmaStatus.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {rmaStatus.type === 'success' ? <CheckCircle className="flex-shrink-0 text-emerald-600" /> : <AlertCircle className="flex-shrink-0 text-rose-600" />}
                <span>{rmaStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRma} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">{tr('Type de motif', 'نوع السبب')}</label>
                <select
                  value={rmaForm.motifCategorie}
                  onChange={(e) => setRmaForm({ ...rmaForm, motifCategorie: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="defaut">{tr('Produit défectueux', 'منتج معيب')}</option>
                  <option value="non_conforme">{tr('Non conforme à la description', 'غير مطابق للوصف')}</option>
                  <option value="changement_avis">{tr("Changement d'avis", 'تغيير الرأي')}</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  {rmaForm.motifCategorie === 'changement_avis'
                    ? tr('Frais de retour à votre charge.', 'مصاريف الإرجاع على عاتقكم.')
                    : tr('Frais de retour à la charge de la boutique.', 'مصاريف الإرجاع على عاتق المتجر.')}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">{tr('Motif détaillé du retour', 'سبب الإرجاع بالتفصيل')}</label>
                <textarea
                  placeholder={tr('Décrivez précisément la raison du retour (ex: mauvaise taille, article endommagé, non conforme...)', 'صف سبب الإرجاع بدقة (مثال: مقاس خاطئ، منتج تالف...)')}
                  value={rmaForm.motif}
                  onChange={(e) => setRmaForm({ ...rmaForm, motif: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                  rows="4"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">{tr('Photos (obligatoire)', 'صور (إلزامي)')}</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setRmaPhotos(Array.from(e.target.files || []).slice(0, 5))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF2FF] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#6366F1]"
                  required
                />
                {rmaPhotos.length > 0 && (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">{rmaPhotos.length} {tr('photo(s) sélectionnée(s)', 'صورة/صور محددة')}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#6366F1] py-3 text-xs font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-[#4F46E5]"
                >
                  {tr('Envoyer la demande', 'إرسال الطلب')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRmaModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  {tr('Annuler', 'إلغاء')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-xl font-black text-slate-900">{tr('Donner votre avis', 'أضف تقييمك')}</h2>
            <p className="mb-6 text-xs text-slate-500">
              {tr('Votre avis aide les autres membres de la communauté tunisienne à acheter en toute confiance.', 'تقييمك يساعد بقية الأعضاء على الشراء بثقة أكبر.')}
            </p>

            {reviewStatus.message && (
              <div
                className={`mb-4 flex gap-3 rounded-2xl border p-4 text-left text-sm ${
                  reviewStatus.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {reviewStatus.type === 'success' ? <CheckCircle className="flex-shrink-0 text-emerald-600" /> : <AlertCircle className="flex-shrink-0 text-rose-600" />}
                <span>{reviewStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500">{tr('Note', 'التقييم')}</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewForm({ ...reviewForm, note: star })}
                      className="text-amber-400 transition hover:scale-110"
                    >
                      <Star size={28} className={star <= reviewForm.note ? 'fill-current' : ''} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">{tr('Commentaire', 'التعليق')}</label>
                <textarea
                  placeholder={tr('Décrivez votre expérience avec ce produit...', 'صف تجربتك مع هذا المنتج...')}
                  value={reviewForm.commentaire}
                  onChange={(e) => setReviewForm({ ...reviewForm, commentaire: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-teal-700 py-3 text-xs font-bold text-white shadow-lg shadow-teal-100 transition hover:bg-teal-800"
                >
                  {tr("Publier l'avis", 'نشر التقييم')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  {tr('Annuler', 'إلغاء')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
