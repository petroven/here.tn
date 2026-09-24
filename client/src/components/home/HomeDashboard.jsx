import { useEffect, useState } from 'react';
import {
  Search, ShoppingBag, Heart, ShoppingCart, MessageSquare, Truck, Ticket, User,
  Wallet, PackageCheck, ChevronRight, CheckCircle2,
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import { API_URL } from '../../config/api.js';

const STATUT_LABELS = {
  en_attente: { fr: 'En attente', ar: 'قيد الانتظار' },
  payee: { fr: 'Payée', ar: 'مدفوعة' },
  expediee: { fr: 'Expédiée', ar: 'تم الشحن' },
  livree: { fr: 'Livrée', ar: 'تم التسليم' },
  annulee: { fr: 'Annulée', ar: 'ملغاة' },
  retournee: { fr: 'Retournée', ar: 'مرتجعة' },
};

// Étape atteinte dans la barre de progression d'une commande en cours.
const STEP_INDEX = { en_attente: 0, payee: 0, expediee: 1, livree: 2 };

function formatTnd(value) {
  return `${Number(value || 0).toFixed(3)} TND`;
}

/**
 * En-tête de la page d'accueil pour un client connecté : salutation, solde,
 * raccourcis, commande en cours et favoris — à la place du bandeau marketing
 * destiné aux visiteurs.
 */
export default function HomeDashboard({ language = 'fr', navigate, cartCount = 0, onOpenProduct }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [me, setMe] = useState(null);
  const [commandes, setCommandes] = useState([]);
  const [favoris, setFavoris] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const load = (path, setter, map = (d) => d) =>
      fetch(`${API_URL}${path}`, { headers })
        .then((res) => res.json())
        .then((data) => { if (data.success) setter(map(data.data)); })
        .catch(() => {});
    load('/users/me', setMe);
    load('/commandes/mes-commandes', setCommandes);
    load('/wishlist', setFavoris, (items) => items.map((i) => i.produit).filter(Boolean));
  }, []);

  const enCours = commandes.filter((c) => ['en_attente', 'payee', 'expediee'].includes(c.statut));
  const derniere = enCours[0] || commandes[0] || null;

  const actions = [
    { icon: ShoppingBag, label: tr('Mes commandes', 'طلباتي'), to: '/commandes', badge: enCours.length },
    { icon: Heart, label: tr('Favoris', 'المفضلة'), to: '/favoris', badge: favoris.length },
    { icon: ShoppingCart, label: tr('Panier', 'السلة'), to: '/checkout', badge: cartCount },
    { icon: MessageSquare, label: tr('Messagerie', 'المراسلة'), to: '/messages' },
    { icon: Truck, label: tr('Suivi colis', 'تتبع الطرد'), to: '/suivi' },
    { icon: Ticket, label: tr('Coupons', 'القسائم'), to: '/coupons' },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
      {/* Salutation + solde */}
      <div className="relative overflow-hidden rounded-lg bg-[#1E1B18] text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#C4532C]/30 blur-3xl" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar nom={me?.nom} prenom={me?.prenom} photo={me?.photo} className="h-14 w-14 ring-2 ring-white/20" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E39B82]">{tr('Votre espace', 'فضاؤكم')}</p>
                <h2 className="text-2xl font-extrabold sm:text-3xl">
                  {tr('Bonjour', 'مرحبًا')}{me?.prenom ? `, ${me.prenom}` : ''} 👋
                </h2>
              </div>
            </div>
            <button
              onClick={() => navigate('/catalogue')}
              className="flex w-full max-w-lg items-center gap-2.5 rounded-xl bg-white/95 px-4 py-3 text-left text-sm text-slate-500 shadow-lg transition hover:bg-white rtl:text-right"
            >
              <Search size={16} />
              {tr('Que recherchez-vous aujourd’hui ?', 'ماذا تبحثون اليوم؟')}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:w-[380px]">
            <div className="col-span-3 flex items-center gap-3 rounded-xl bg-white/10 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C4532C]"><Wallet size={18} /></span>
              <div>
                <p className="text-[11px] font-semibold text-white/60">{tr('Solde BuyHere (cashback)', 'رصيد BuyHere')}</p>
                <p className="text-lg font-black">{formatTnd(me?.soldeWallet)}</p>
              </div>
            </div>
            {[
              { value: commandes.length, label: tr('Commandes', 'طلبات') },
              { value: enCours.length, label: tr('En cours', 'قيد التنفيذ') },
              { value: favoris.length, label: tr('Favoris', 'المفضلة') },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-xl font-black">{stat.value}</p>
                <p className="text-[11px] font-semibold text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Raccourcis */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {actions.map(({ icon: Icon, label, to, badge }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="relative flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-soft transition hover:-translate-y-0.5 hover:border-terre-200"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8E4DE] text-[#C4532C]"><Icon size={20} /></span>
            <span className="text-xs font-bold text-slate-700">{label}</span>
            {badge > 0 && (
              <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C4532C] px-1.5 text-[10px] font-black text-white rtl:left-3 rtl:right-auto">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dernière commande */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <PackageCheck size={18} className="text-[#C4532C]" />
              {enCours.length ? tr('Commande en cours', 'طلب قيد التنفيذ') : tr('Dernière commande', 'آخر طلب')}
            </h3>
            <button onClick={() => navigate('/commandes')} className="flex items-center gap-0.5 text-xs font-bold text-[#C4532C] hover:text-[#994122]">
              {tr('Tout voir', 'عرض الكل')} <ChevronRight size={14} className="rtl:rotate-180" />
            </button>
          </div>

          {derniere ? (
            <OrderProgress commande={derniere} tr={tr} />
          ) : (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">{tr('Vous n’avez pas encore passé de commande.', 'لم تقوموا بأي طلب بعد.')}</p>
              <button onClick={() => navigate('/catalogue')} className="btn-primary-premium mt-3 px-4 py-2 text-xs">
                {tr('Découvrir le catalogue', 'اكتشفوا الكتالوج')}
              </button>
            </div>
          )}
        </div>

        {/* Favoris */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Heart size={18} className="text-[#C4532C]" />
              {tr('Vos favoris', 'مفضلاتكم')}
            </h3>
            <button onClick={() => navigate('/favoris')} className="flex items-center gap-0.5 text-xs font-bold text-[#C4532C] hover:text-[#994122]">
              {tr('Tout voir', 'عرض الكل')} <ChevronRight size={14} className="rtl:rotate-180" />
            </button>
          </div>

          {favoris.length ? (
            <div className="grid grid-cols-3 gap-3">
              {favoris.slice(0, 3).map((p) => (
                <button key={p.id} onClick={() => onOpenProduct(p.id)} className="group text-left rtl:text-right">
                  <div className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                    {p.image
                      ? <img src={p.image} alt={p.nom} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      : <div className="flex h-full items-center justify-center text-slate-300"><ShoppingBag size={20} /></div>}
                  </div>
                  <p className="mt-1.5 truncate text-xs font-bold text-slate-800">{p.nom}</p>
                  <p className="text-xs font-black text-[#C4532C]">{formatTnd(p.prix)}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">{tr('Touchez le ♥ d’un produit pour le retrouver ici.', 'اضغطوا على ♥ في أي منتج لتجدوه هنا.')}</p>
              <button onClick={() => navigate('/compte')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#C4532C]">
                <User size={14} /> {tr('Gérer mon compte', 'إدارة حسابي')}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OrderProgress({ commande, tr }) {
  const statut = STATUT_LABELS[commande.statut];
  const step = STEP_INDEX[commande.statut];
  const steps = [tr('Confirmée', 'مؤكدة'), tr('Expédiée', 'تم الشحن'), tr('Livrée', 'تم التسليم')];
  const lignes = commande.lignes || [];

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3 rtl:space-x-reverse">
          {lignes.slice(0, 3).map((l) => (
            <div key={l.id} className="h-12 w-12 overflow-hidden rounded-xl border-2 border-white bg-slate-100">
              {l.produit?.image && <img src={l.produit.image} alt="" className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {commande.numeroCommande || `#${commande.id}`}
            {commande.boutique?.nom ? <span className="font-medium text-slate-500"> · {commande.boutique.nom}</span> : null}
          </p>
          <p className="text-xs text-slate-500">
            {lignes.length} {tr('article(s)', 'منتج')} · <span className="font-bold text-slate-800">{formatTnd(commande.total)}</span>
          </p>
        </div>
        <span className="rounded-full bg-[#F8E4DE] px-2.5 py-1 text-[11px] font-bold text-[#C4532C]">
          {statut ? tr(statut.fr, statut.ar) : commande.statut}
        </span>
      </div>

      {step !== undefined && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {steps.map((label, i) => (
            <div key={label}>
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-[#C4532C]' : 'bg-slate-200'}`} />
              <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>
                {i <= step && <CheckCircle2 size={12} className="text-[#C4532C]" />} {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {commande.livraison?.trackingId && (
        <p className="mt-4 text-xs text-slate-500">
          {tr('Suivi', 'التتبع')} : <span className="font-mono font-bold text-slate-700">{commande.livraison.trackingId}</span>
        </p>
      )}
    </div>
  );
}
