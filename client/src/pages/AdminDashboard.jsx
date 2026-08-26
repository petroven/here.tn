import React, { useState, useEffect } from 'react';
import {
  Users,
  Store,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  CheckCircle2,
  X,
  DollarSign,
  Package,
  ShieldCheck,
  Languages,
  LogOut,
  Landmark,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { API_URL } from '../config/api.js';

const STATUT_BADGE = {
  validee: 'bg-emerald-50 text-emerald-700',
  verse: 'bg-emerald-50 text-emerald-700',
  approuve: 'bg-blue-50 text-blue-700',
  en_attente: 'bg-amber-50 text-amber-700',
  demande: 'bg-amber-50 text-amber-700',
  suspendue: 'bg-rose-50 text-rose-700',
  rejete: 'bg-rose-50 text-rose-700',
  rembourse: 'bg-emerald-50 text-emerald-700',
  refuse: 'bg-rose-50 text-rose-700',
  litige: 'bg-rose-100 text-rose-800',
};

function StatusBadge({ statut }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUT_BADGE[statut] || 'bg-slate-100 text-slate-600'}`}>{statut}</span>;
}

export function AdminDashboard({ onLogout }) {
  const [language, setLanguage] = useState('fr');
  const { t } = useTranslation(language);
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [settlementReport, setSettlementReport] = useState([]);
  const [products, setProducts] = useState([]);
  const [virements, setVirements] = useState([]);
  const [retours, setRetours] = useState([]);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchStats(),
        fetchVendors(),
        fetchWithdrawals(),
        fetchUsers(),
        fetchOrders(),
        fetchSettlementReport(),
        fetchProducts(),
        fetchVirements(),
        fetchRetours(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setProducts(data.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setStats(data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setVendors(data.data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setWithdrawals(data.data);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setUsers(data.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setOrders(data.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchVirements = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/virements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setVirements(data.data);
    } catch (error) {
      console.error('Error fetching virements:', error);
    }
  };

  const fetchRetours = async () => {
    try {
      const response = await fetch(`${API_URL}/retours`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setRetours(data.data);
    } catch (error) {
      console.error('Error fetching retours:', error);
    }
  };

  const handleTrancherRetour = async (retourId, statut) => {
    try {
      const response = await fetch(`${API_URL}/retours/${retourId}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut }),
      });
      const data = await response.json();
      if (data.success) fetchRetours();
    } catch (error) {
      console.error('Error updating retour:', error);
    }
  };

  const handleVirementAction = async (paiementId, action) => {
    try {
      const response = await fetch(`${API_URL}/admin/virements/${paiementId}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) fetchVirements();
    } catch (error) {
      console.error('Error updating virement:', error);
    }
  };

  const fetchSettlementReport = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/settlement-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setSettlementReport(data.data);
    } catch (error) {
      console.error('Error fetching settlement report:', error);
    }
  };

  const handleVendorStatus = async (boutiqueId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/admin/vendors/${boutiqueId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut: newStatus }),
      });
      const data = await response.json();
      if (data.success) fetchVendors();
    } catch (error) {
      console.error('Error updating vendor status:', error);
    }
  };

  const handleWithdrawalApproval = async (retraitId, status, reason = '') => {
    try {
      const response = await fetch(`${API_URL}/admin/withdrawals/${retraitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut: status, motifRejection: reason }),
      });
      const data = await response.json();
      if (data.success) fetchWithdrawals();
    } catch (error) {
      console.error('Error updating withdrawal:', error);
    }
  };

  const handleProductStatus = async (productId, status) => {
    try {
      const response = await fetch(`${API_URL}/admin/products/${productId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) setProducts((current) => current.map((product) => (product.id === productId ? data.data : product)));
    } catch (error) {
      console.error('Error updating product status:', error);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-600">{t('loading')}</div>;
  }

  const pendingVendors = vendors.filter((v) => v.statut === 'en_attente');
  const pendingWithdrawals = withdrawals.filter((w) => w.statut === 'demande');
  const pendingVirements = virements.filter((v) => v.statut === 'en_attente_validation');
  const recentOrders = [...orders].slice(0, 6);

  const tabs = ['overview', 'vendors', 'products', 'withdrawals', 'virements', 'retours', 'users', 'orders', 'settlement'];
  const litigesEnCours = retours.filter((r) => r.statut === 'litige').length;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="gradient-brand p-6 text-white shadow-md">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl glass p-1.5">
                <img src="/logo-icon.png" alt="here.tn" className="h-full w-full object-contain" />
              </span>
              <h1 className="text-2xl font-black sm:text-3xl">{t('admin')}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25"
              >
                <Languages size={14} /> {language === 'fr' ? 'عربي' : 'Français'}
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-500/90 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600"
                >
                  <LogOut size={14} /> Déconnexion
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t('totalSales'), value: `${(stats?.revenue?.commission || 0).toFixed(2)} TND`, icon: DollarSign, tone: 'text-[#7C3AED] bg-[#F5F3FF]' },
            { label: 'Produits catalogue', value: stats?.products?.total || 0, icon: Package, tone: 'text-teal-600 bg-teal-50' },
            { label: t('allVendors'), value: stats?.vendors?.total || 0, icon: Store, tone: 'text-blue-600 bg-blue-50' },
            { label: t('verified'), value: stats?.vendors?.verified || 0, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
            { label: t('orders'), value: stats?.orders?.total || 0, icon: BarChart3, tone: 'text-amber-600 bg-amber-50' },
            { label: t('pendingCommissions'), value: `${(stats?.revenue?.pending || 0).toFixed(2)} TND`, icon: AlertCircle, tone: 'text-rose-600 bg-rose-50' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="card-premium p-4 sm:p-5">
                <div className={`mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl ${card.tone}`}>
                  <Icon size={18} />
                </div>
                <p className="text-lg font-black text-slate-900 sm:text-xl">{card.value}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                activeTab === tab ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'retours' ? 'Retours' : t(tab === 'overview' ? 'home' : tab === 'settlement' ? 'commissionBreakdown' : tab)}
              {tab === 'retours' && litigesEnCours > 0 && (
                <span className="ms-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">{litigesEnCours}</span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="card-premium p-5 lg:col-span-2">
              <h2 className="mb-3 text-sm font-extrabold text-slate-900">Commandes récentes</h2>
              {recentOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Aucune commande pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{order.numeroCommande}</p>
                        <p className="text-[11px] text-slate-400">{new Date(order.createdAt).toLocaleDateString('fr-TN')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-700">{Number(order.total).toFixed(3)} TND</span>
                        <StatusBadge statut={order.statut} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="card-premium p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900">Vendeurs en attente</h2>
                  {pendingVendors.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700">{pendingVendors.length}</span>}
                </div>
                {pendingVendors.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">Aucune boutique en attente.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {pendingVendors.slice(0, 4).map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="truncate font-semibold text-slate-700">{v.nom}</span>
                        <button onClick={() => { setActiveTab('vendors'); }} className="font-bold text-[#7C3AED] hover:underline">Voir →</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-premium p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900">Retraits à traiter</h2>
                  {pendingWithdrawals.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700">{pendingWithdrawals.length}</span>}
                </div>
                {pendingWithdrawals.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">Aucune demande en attente.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {pendingWithdrawals.slice(0, 4).map((w) => (
                      <div key={w.id} className="flex items-center justify-between text-xs">
                        <span className="truncate font-semibold text-slate-700">{w.boutique?.nom}</span>
                        <span className="font-bold text-slate-900">{Number(w.montant).toFixed(3)} TND</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('storeName')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('vendorName')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('totalSales')} (net)</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Commission</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('numberOfOrders')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('storeStatus')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Conditions retour</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('edit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">{vendor.nom}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{vendor.vendeur?.email}</td>
                      <td className="px-5 py-4 text-sm font-bold text-emerald-600">{vendor.stats?.totalVentes?.toFixed(2)} TND</td>
                      <td className="px-5 py-4 text-sm font-bold text-rose-600">{vendor.stats?.totalCommissions?.toFixed(2)} TND</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{vendor.stats?.nombreCommandes}</td>
                      <td className="px-5 py-4"><StatusBadge statut={vendor.statut} /></td>
                      <td className="px-5 py-4">
                        {vendor.accepteConditionsRetour ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Acceptées</span>
                        ) : (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">Non acceptées</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          onChange={(e) => handleVendorStatus(vendor.id, e.target.value)}
                          defaultValue=""
                          className="input-premium px-2.5 py-1.5 text-xs font-bold"
                        >
                          <option value="">Changer</option>
                          <option value="validee">{t('approve')}</option>
                          <option value="suspendue">{t('suspend')}</option>
                          <option value="en_attente">{t('pending')}</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vendors.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun vendeur pour le moment.</p>}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Modération du catalogue</h2>
                <p className="mt-1 text-xs text-slate-500">Activez, mettez en attente ou désactivez les produits publiés.</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F5F3FF] text-[#7C3AED]"><ShieldCheck size={18} /></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Produit</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Boutique</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Stock</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Statut</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">
                        {product.nom}
                        <span className="block text-xs font-normal text-slate-500">{Number(product.prix).toFixed(3)} TND</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{product.boutique?.nom || 'N/A'}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700">{product.stock}</td>
                      <td className="px-5 py-4"><StatusBadge statut={product.status} /></td>
                      <td className="px-5 py-4">
                        <select
                          value={product.status}
                          onChange={(event) => handleProductStatus(product.id, event.target.value)}
                          className="input-premium px-2.5 py-1.5 text-xs font-bold"
                        >
                          <option value="actif">Actif</option>
                          <option value="en_attente">En attente</option>
                          <option value="inactif">Désactivé</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {products.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun produit à modérer.</p>}
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            {withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="card-premium p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-slate-900">{withdrawal.montant} TND</p>
                    <p className="text-sm text-slate-500">Boutique: {withdrawal.boutique?.nom}</p>
                    <p className="text-sm text-slate-500">Vendeur: {withdrawal.boutique?.vendeur?.email}</p>
                    <p className="text-sm text-slate-500">IBAN: {withdrawal.iban}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {withdrawal.statut === 'demande' && (
                      <>
                        <button
                          onClick={() => handleWithdrawalApproval(withdrawal.id, 'approuve')}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={16} /> {t('approve')}
                        </button>
                        <button
                          onClick={() => handleWithdrawalApproval(withdrawal.id, 'rejete', 'Non conforme')}
                          className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                        >
                          <X size={16} /> {t('reject')}
                        </button>
                      </>
                    )}
                    {withdrawal.statut === 'approuve' && (
                      <button
                        onClick={() => handleWithdrawalApproval(withdrawal.id, 'verse')}
                        className="btn-primary-premium flex items-center gap-1.5 px-4 py-2 text-xs"
                      >
                        <DollarSign size={16} /> Marquer comme versé
                      </button>
                    )}
                    <StatusBadge statut={withdrawal.statut} />
                  </div>
                </div>
              </div>
            ))}
            {withdrawals.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-soft">Aucune demande de retrait.</p>}
          </div>
        )}

        {activeTab === 'virements' && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-soft">
              <Landmark size={16} className="text-[#6366F1]" />
              Un virement bancaire ne peut pas être vérifié automatiquement (pas de webhook bancaire) : chaque paiement reste "en attente" jusqu'à ce que vous confirmiez sa réception sur le relevé de compte, en le rapprochant via la référence indiquée.
            </p>
            {virements.map((paiement) => (
              <div key={paiement.id} className="card-premium p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-slate-900">{paiement.montant?.toFixed?.(3) ?? paiement.montant} TND</p>
                    <p className="text-sm text-slate-500">Commande: {paiement.Commande?.numeroCommande}</p>
                    <p className="text-sm text-slate-500">Client: {paiement.Commande?.client?.prenom} {paiement.Commande?.client?.nom} — {paiement.Commande?.client?.email}</p>
                    <p className="text-sm text-slate-500">Boutique: {paiement.Commande?.boutique?.nom}</p>
                    {paiement.referenceVirement && <p className="text-sm font-semibold text-slate-700">Référence fournie: {paiement.referenceVirement}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {paiement.statut === 'en_attente_validation' && (
                      <>
                        <button
                          onClick={() => handleVirementAction(paiement.id, 'valider')}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={16} /> {t('approve')}
                        </button>
                        <button
                          onClick={() => handleVirementAction(paiement.id, 'rejeter')}
                          className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                        >
                          <X size={16} /> {t('reject')}
                        </button>
                      </>
                    )}
                    <StatusBadge statut={paiement.statut} />
                  </div>
                </div>
              </div>
            ))}
            {virements.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-soft">Aucun virement bancaire déclaré.</p>}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('firstName')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('email')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{t('profile')}</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">{user.prenom} {user.nom}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{user.email}</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-[#F5F3FF] px-3 py-1 text-xs font-bold capitalize text-[#7C3AED]">{user.role}</span></td>
                      <td className="px-5 py-4 text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString('fr-TN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun utilisateur.</p>}
          </div>
        )}

        {/* Retours Tab */}
        {activeTab === 'retours' && (
          <div className="space-y-3">
            {retours.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Aucune demande de retour.</p>}
            {retours.map((retour) => (
              <div key={retour.id} className={`rounded-2xl border bg-white p-5 shadow-soft ${retour.statut === 'litige' ? 'border-rose-300' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{retour.Commande?.numeroCommande}</p>
                      <StatusBadge statut={retour.statut} />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{retour.motifCategorie}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{retour.boutique?.nom} · {retour.client?.prenom} {retour.client?.nom} ({retour.client?.email})</p>
                    <p className="mt-2 text-xs text-slate-600">{retour.motif}</p>
                    {retour.photos?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {retour.photos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{Number(retour.montantRemboursement || 0).toFixed(3)} TND</p>
                    {retour.fraisRetourALaCharge && <p className="text-[10px] text-slate-400">Frais : {retour.fraisRetourALaCharge}</p>}
                  </div>
                </div>

                {['demande', 'litige'].includes(retour.statut) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => handleTrancherRetour(retour.id, 'rembourse')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                      Approuver et rembourser
                    </button>
                    <button onClick={() => handleTrancherRetour(retour.id, 'refuse')} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                      Refuser
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Settlement Tab */}
        {activeTab === 'settlement' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Boutique</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Vendeur</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Ventes Brutes</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Commission</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Gains Nets</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Versé</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlementReport.map((settlement, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">{settlement.boutique}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{settlement.vendeur}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{settlement.totalVentesBrutes.toFixed(2)} TND</td>
                      <td className="px-5 py-4 text-sm font-bold text-rose-600">{settlement.totalCommissions.toFixed(2)} TND</td>
                      <td className="px-5 py-4 text-sm font-bold text-emerald-600">{settlement.totalVentes.toFixed(2)} TND</td>
                      <td className="px-5 py-4 text-sm font-bold text-blue-600">{settlement.totalPaid.toFixed(2)} TND</td>
                      <td className="px-5 py-4 text-sm font-bold text-amber-600">{settlement.balance.toFixed(2)} TND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {settlementReport.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucune donnée de règlement.</p>}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Commande</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Client</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Total</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Statut</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900">{order.numeroCommande}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{order.client?.prenom} {order.client?.nom}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700">{Number(order.total).toFixed(3)} TND</td>
                      <td className="px-5 py-4"><StatusBadge statut={order.statut} /></td>
                      <td className="px-5 py-4 text-sm text-slate-500">{new Date(order.createdAt).toLocaleDateString('fr-TN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {orders.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucune commande.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
