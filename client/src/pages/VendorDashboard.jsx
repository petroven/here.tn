import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Package,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Upload,
  RefreshCw,
  X,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { API_URL } from '../config/api.js';

export function VendorDashboard() {
  const [language, setLanguage] = useState('fr');
  const { t } = useTranslation(language);
  const [vendorData, setVendorData] = useState(null);
  const [products, setProducts] = useState([]);
  const [retours, setRetours] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // product object when editing
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Product Form State
  const [productForm, setProductForm] = useState({
    nom: '',
    description: '',
    prix: '',
    prixAvant: '',
    stock: '',
    image: '',
    categorieId: '',
    delaiRetourJoursOverride: '',
  });
  const [productFormError, setProductFormError] = useState('');

  // Variants in form
  const [formVariants, setFormVariants] = useState([]); // [{ taille, couleur, pointure, stock, prixSupplement }]
  const [newVariant, setNewVariant] = useState({ taille: '', couleur: '', pointure: '', stock: '0', prixSupplement: '0' });

  // Upload state
  const [uploadingImage, setUploadingImage] = useState(false);

  const [withdrawalData, setWithdrawalData] = useState({
    montant: '',
    iban: '',
  });

  const token = localStorage.getItem('token');
  const vendorId = localStorage.getItem('userId');

  useEffect(() => {
    if (vendorId) {
      fetchVendorData(vendorId);
      fetchProducts(vendorId);
      fetchReturns();
      fetchCategories();
    }
  }, [vendorId]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/produits`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        // Collect unique categories from products
        const unique = [...new Set(data.data.map(p => p.categorie?.nom).filter(Boolean))];
        setCategories(unique.map((c, i) => ({ id: i + 1, nom: c })));
      } else {
        setCategories([{ id: 1, nom: 'Mode' }, { id: 2, nom: 'Décoration' }, { id: 3, nom: 'Technologie' }]);
      }
    } catch {
      setCategories([{ id: 1, nom: 'Mode' }, { id: 2, nom: 'Décoration' }, { id: 3, nom: 'Technologie' }]);
    }
  };

  const fetchVendorData = async (vId) => {
    try {
      const response = await fetch(`${API_URL}/vendor/dashboard/${vId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setVendorData(data.data);
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (vId) => {
    try {
      const response = await fetch(`${API_URL}/vendor/products/${vId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchReturns = async () => {
    try {
      const response = await fetch(`${API_URL}/retours`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setRetours(data.data);
      }
    } catch (error) {
      console.error('Error fetching returns:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setProductForm((prev) => ({ ...prev, image: data.url }));
      } else {
        alert('Erreur d\'upload: ' + data.message);
      }
    } catch (err) {
      alert('Erreur lors du téléversement de l\'image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const addVariantToForm = () => {
    if (!newVariant.stock) return;
    setFormVariants([...formVariants, {
      ...newVariant,
      stock: parseInt(newVariant.stock),
      prixSupplement: parseFloat(newVariant.prixSupplement || 0),
    }]);
    setNewVariant({ taille: '', couleur: '', pointure: '', stock: '0', prixSupplement: '0' });
  };

  const removeVariantFromForm = (index) => {
    setFormVariants(formVariants.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setProductFormError('');

    const payload = {
      ...productForm,
      prix: parseFloat(productForm.prix),
      prixAvant: productForm.prixAvant ? parseFloat(productForm.prixAvant) : null,
      stock: formVariants.length > 0 ? formVariants.reduce((sum, v) => sum + v.stock, 0) : parseInt(productForm.stock || 0),
      variantes: formVariants.length > 0 ? formVariants : [],
      // Le serveur resserre toujours au minimum(catégorie, valeur envoyée) —
      // impossible d'élargir la fenêtre de retour de sa catégorie ici.
      delaiRetourJoursOverride: productForm.delaiRetourJoursOverride === '' ? null : parseInt(productForm.delaiRetourJoursOverride, 10),
    };

    try {
      let response;
      if (editingProduct) {
        response = await fetch(`${API_URL}/vendor/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${API_URL}/vendor/products/${vendorId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }
      
      const data = await response.json();
      if (data.success) {
        if (editingProduct) {
          setProducts(products.map(p => p.id === editingProduct.id ? data.data : p));
        } else {
          setProducts([data.data, ...products]);
        }
        
        // Reset state
        setProductForm({ nom: '', description: '', prix: '', prixAvant: '', stock: '', image: '', categorieId: '', delaiRetourJoursOverride: '' });
        setFormVariants([]);
        setShowProductForm(false);
        setEditingProduct(null);
      } else {
        setProductFormError(data.message);
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleStartEdit = (product) => {
    setEditingProduct(product);
    setProductFormError('');
    setProductForm({
      nom: product.nom,
      description: product.description,
      prix: String(product.prix),
      prixAvant: product.prixAvant ? String(product.prixAvant) : '',
      stock: String(product.stock),
      image: product.image || '',
      categorieId: String(product.categorieId || ''),
      delaiRetourJoursOverride: Number.isFinite(product.delaiRetourJoursOverride) ? String(product.delaiRetourJoursOverride) : '',
    });
    setFormVariants(product.variantes || []);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(t('confirmDelete'))) return;

    try {
      const response = await fetch(`${API_URL}/vendor/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setProducts(products.filter(p => p.id !== productId));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleStockAdjustment = async (product, amount = null) => {
    const requestedStock = amount === null
      ? window.prompt(`Nouveau stock pour « ${product.nom} »`, String(product.stock))
      : product.stock + amount;
    if (requestedStock === null || requestedStock === '') return;

    try {
      const response = await fetch(`${API_URL}/vendor/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stock: Number(requestedStock), motif: amount === null ? 'inventaire' : 'reassort_rapide' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Stock impossible à mettre à jour.');
      setProducts((current) => current.map((item) => item.id === product.id ? data.data : item));
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRateClient = async (commandeId) => {
    const note = window.prompt('Note pour ce client (1 à 5) :', '5');
    if (note === null) return;
    const noteNum = Number(note);
    if (!Number.isInteger(noteNum) || noteNum < 1 || noteNum > 5) {
      alert('La note doit être un entier entre 1 et 5.');
      return;
    }
    const commentaire = window.prompt('Commentaire (optionnel) :') || '';

    try {
      const response = await fetch(`${API_URL}/avis/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commandeId, note: noteNum, commentaire }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      alert('Évaluation client enregistrée.');
    } catch (error) {
      alert(error.message || 'Erreur lors de l\'évaluation du client.');
    }
  };

  const handleUpdateShipping = async (commandeId, newStatut) => {
    try {
      const response = await fetch(`${API_URL}/commandes/${commandeId}/livraison`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut: newStatut }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`Statut de livraison mis à jour : ${newStatut}`);
        fetchVendorData(vendorId);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Erreur lors de la mise à jour de la livraison.');
    }
  };

  const handleDownloadAwb = async (commandeId, awbNumber) => {
    try {
      const response = await fetch(`${API_URL}/livraisons/${commandeId}/awb`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Erreur de téléchargement.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `awb-${awbNumber || commandeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Impossible de télécharger le bordereau AWB.');
    }
  };

  const handleProcessReturn = async (returnId, targetStatut) => {
    const comment = window.prompt("Commentaire pour le client (optionnel) :");
    try {
      const response = await fetch(`${API_URL}/retours/${returnId}/statut`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut: targetStatut, commentaireVendeur: comment }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`Retour traité : ${targetStatut}`);
        fetchReturns();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Erreur lors du traitement du retour.');
    }
  };

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/vendor/withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendeurId: vendorId,
          montant: parseFloat(withdrawalData.montant),
          iban: withdrawalData.iban,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWithdrawalData({ montant: '', iban: '' });
        setShowWithdrawalForm(false);
        fetchVendorData(vendorId);
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">{t('loading')}</div>;
  }

  const stats = vendorData?.stats || {};
  const orders = vendorData?.commandes || [];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen ${language === 'ar' ? 'rtl' : 'ltr'} bg-slate-50 font-sans`}>
      {/* Header */}
      <div className="bg-[#172B4D] text-white p-5 shadow-lg sm:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black sm:text-3xl">{t('dashboard')}</h1>
              {vendorData?.boutique?.statut === 'validee' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">Boutique vérifiée</span>
              ) : vendorData?.boutique?.statut === 'suspendue' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-300">Boutique suspendue</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">Vérification en cours</span>
              )}
            </div>
            {vendorData?.boutique && (
              <p className="text-slate-300 text-sm mt-1">{vendorData.boutique.nom} — {vendorData.boutique.adresse || 'Tunisie'}</p>
            )}
          </div>
          <button
            onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-xs transition"
          >
            {language === 'fr' ? 'عربي' : 'Français'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Finances — chaque chiffre découle du même calcul serveur (voir
            server/src/utils/finance.js), donc Ventes brutes − Commission =
            Gains nets se vérifie toujours ici. */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Finances</h2>
          <p className="text-[11px] font-semibold text-slate-400">Commission plateforme : 5% du sous-total produits (livraison exclue)</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Ventes brutes</p>
            <p className="text-xl font-black text-slate-800 mt-1">{(stats.totalVentesBrutes ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">Produits + livraison</p>
          </div>

          <div className="bg-white rounded-3xl border border-rose-100 shadow-soft p-5">
            <p className="text-rose-400 text-[11px] font-bold uppercase tracking-wider">− Commission (5%)</p>
            <p className="text-xl font-black text-rose-600 mt-1">{(stats.totalCommissions ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-rose-300">Prélevée sur le sous-total produits</p>
          </div>

          <div className="bg-white rounded-3xl border border-emerald-100 shadow-soft p-5">
            <p className="text-emerald-500 text-[11px] font-bold uppercase tracking-wider">= Gains nets</p>
            <p className="text-xl font-black text-emerald-700 mt-1">{(stats.totalVentes ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-emerald-400">Ce qui vous revient</p>
          </div>

          <div className="bg-white rounded-3xl border border-amber-100 shadow-soft p-5">
            <p className="text-amber-500 text-[11px] font-bold uppercase tracking-wider">En séquestre</p>
            <p className="text-xl font-black text-amber-600 mt-1">{(stats.soldeEnAttenteEscrow ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-amber-400">Bloqué jusqu'à fin de la fenêtre de retour</p>
          </div>

          <div className="bg-white rounded-3xl border border-teal-100 shadow-soft p-5">
            <p className="text-teal-500 text-[11px] font-bold uppercase tracking-wider">{t('balance')}</p>
            <p className="text-xl font-black text-teal-700 mt-1">{(stats.soldeDisponible ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-teal-400">Déjà versé : {(stats.totalVerse ?? 0).toFixed(3)} TND</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{t('orders')}</p>
            <p className="text-xl font-black text-slate-800 mt-1">{stats.nombreCommandes || 0}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">Hors commandes annulées</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex space-x-6">
            {[
              { id: 'overview', label: 'Commandes & Logistique' },
              { id: 'products', label: 'Mes Produits' },
              { id: 'returns', label: 'Retours & RMA' },
              { id: 'withdrawals', label: 'Paiements & Retraits' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 font-bold text-sm transition relative ${
                  activeTab === tab.id
                    ? 'text-teal-700 font-black'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-teal-700 rounded-full"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Overview & Orders Tab */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6">
            <h2 className="text-xl font-black text-slate-800 mb-6">Suivi des commandes client</h2>
            
            {orders.length === 0 ? (
              <p className="text-slate-400 text-xs py-6 text-center">Aucune commande reçue pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold">
                      <th className="py-3 px-4">N° Commande</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Statut Commande</th>
                      <th className="py-3 px-4">Livraison</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 font-bold text-slate-900">{order.numeroCommande}</td>
                        <td className="py-4 px-4">
                          <p>{order.client?.nom} {order.client?.prenom}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{order.client?.telephone}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-slate-800">{order.total.toFixed(3)} TND</p>
                          <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">Net : {Number(order.montantVendeur ?? 0).toFixed(3)} TND</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase text-[10px]">
                            {order.statut}
                          </span>
                          {order.confirmationStatut === 'en_attente' && (
                            <p className="mt-1 text-[10px] font-bold text-amber-600 uppercase">Attente confirmation client</p>
                          )}
                          {order.confirmationStatut === 'refusee' && (
                            <p className="mt-1 text-[10px] font-bold text-red-600 uppercase">Refusée par le client</p>
                          )}
                          {order.confirmationStatut === 'expiree' && (
                            <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase">Confirmation expirée</p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500">AWB: {order.livraison?.awbNumber || 'N/A'}</span>
                            {order.livraison && (
                              <p className="text-[10px] text-red-600 font-bold uppercase">
                                État: {order.livraison.statut}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Download AWB PDF */}
                            {order.livraison && (
                              <button
                                onClick={() => handleDownloadAwb(order.id, order.livraison.awbNumber)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition flex items-center gap-1.5 font-bold"
                                title="Télécharger Bordereau d'expédition AWB"
                              >
                                <Download size={14} />
                                AWB
                              </button>
                            )}

                            {/* Delivery Status Update controls */}
                            {order.livraison && order.livraison.statut !== 'livre' && order.livraison.statut !== 'retourne' && (
                              <select
                                onChange={(e) => handleUpdateShipping(order.id, e.target.value)}
                                defaultValue=""
                                className="border border-slate-200 bg-white px-2 py-1.5 rounded-xl font-bold text-slate-600"
                              >
                                <option value="" disabled>Changer statut livraison</option>
                                <option value="expedie" disabled={order.confirmationStatut === 'en_attente'}>
                                  {order.confirmationStatut === 'en_attente' ? 'Expédié (confirmation client requise)' : 'Expédié'}
                                </option>
                                <option value="en_cours_livraison">En cours</option>
                                <option value="livre">Livré (Payé COD)</option>
                                <option value="retourne">Retourné</option>
                              </select>
                            )}

                            {order.statut === 'livree' && (
                              <button
                                onClick={() => handleRateClient(order.id)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 p-2 rounded-xl transition font-bold"
                                title="Noter ce client"
                              >
                                Noter client
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800">Mes produits à la vente</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{products.filter((product) => product.stock <= 5).length} produit(s) en stock faible</p>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductFormError('');
                  setProductForm({ nom: '', description: '', prix: '', prixAvant: '', stock: '', image: '', categorieId: '', delaiRetourJoursOverride: '' });
                  setFormVariants([]);
                  setShowProductForm(true);
                }}
                className="bg-teal-700 hover:bg-teal-800 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold text-xs shadow-lg shadow-teal-100 transition"
              >
                <Plus size={16} />
                Ajouter un produit
              </button>
            </div>

            {/* Product Create/Edit Form modal */}
            {showProductForm && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 mb-8 max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">
                    {editingProduct ? 'Modifier le produit' : 'Créer un nouveau produit'}
                  </h3>
                  <button onClick={() => setShowProductForm(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-6">
                  {productFormError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                      {productFormError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Nom du produit"
                      value={productForm.nom}
                      onChange={(e) => setProductForm({ ...productForm, nom: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent transition"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Prix de base (TND)"
                      value={productForm.prix}
                      onChange={(e) => setProductForm({ ...productForm, prix: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent transition"
                      required
                      step="0.001"
                    />
                  </div>

                  {editingProduct && (
                    <div>
                      <input
                        type="number"
                        placeholder="Prix barré / avant promo (TND, optionnel)"
                        value={productForm.prixAvant}
                        onChange={(e) => setProductForm({ ...productForm, prixAvant: e.target.value })}
                        className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent transition"
                        step="0.001"
                      />
                      <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                        Politique anti-fausses promotions : le prix barré doit correspondre à un prix réellement pratiqué sur ce produit pendant au moins 7 jours. Modifiez d'abord le prix, attendez, puis proposez la remise.
                      </p>
                    </div>
                  )}

                  <textarea
                    placeholder="Description du produit"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent transition"
                    rows="3"
                    required
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Category */}
                    <select
                      value={productForm.categorieId}
                      onChange={(e) => setProductForm({ ...productForm, categorieId: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50/50 focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="">Sélectionner Catégorie</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.nom}</option>
                      ))}
                    </select>

                    <div>
                      <input
                        type="number"
                        min="0"
                        placeholder="Délai de retour (jours) — laisser vide = défaut catégorie"
                        value={productForm.delaiRetourJoursOverride}
                        onChange={(e) => setProductForm({ ...productForm, delaiRetourJoursOverride: e.target.value })}
                        className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent transition"
                      />
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">Vous pouvez resserrer le délai de votre catégorie, jamais l'élargir.</p>
                    </div>

                    {/* Image Upload Input */}
                    <div className="flex gap-2 items-center">
                      <label className="flex-1 border border-dashed border-slate-300 rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 text-xs text-slate-500 font-bold transition flex items-center justify-center gap-1.5">
                        <Upload size={14} />
                        {uploadingImage ? 'Upload...' : 'Téléverser Image'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {productForm.image && (
                        <span className="w-12 h-12 rounded-lg overflow-hidden border bg-slate-100 flex-shrink-0">
                          <img src={productForm.image} alt="Preview" className="w-full h-full object-cover" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock or Variants Switch */}
                  <div className="border-t border-slate-100 pt-6">
                    <h4 className="font-bold text-sm text-slate-800 mb-3">Déclinaisons & Stock</h4>

                    {formVariants.length === 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400 font-semibold">Stock physique global</label>
                          <input
                            type="number"
                            placeholder="Ex: 50"
                            value={productForm.stock}
                            onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                            className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700"
                            required={formVariants.length === 0}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mb-3">
                          Ou ajoutez des variantes (taille, couleur, pointure) ci-dessous pour gérer le stock par déclinaison.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 mb-4">
                        <p className="text-xs text-emerald-600 font-bold">
                          ✓ Gestion des stocks activée par variantes ({formVariants.length} variante(s)).
                          Stock total calculé : {formVariants.reduce((sum, v) => sum + v.stock, 0)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {formVariants.map((v, i) => (
                            <span key={i} className="bg-slate-100 border text-slate-700 text-xs px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                              {v.taille && `Taille: ${v.taille}`}
                              {v.couleur && `Couleur: ${v.couleur}`}
                              {v.pointure && `Pt: ${v.pointure}`}
                              <span className="bg-teal-700 text-white rounded px-1.5 py-0.5 text-[10px] font-black">{v.stock} pcs</span>
                              {v.prixSupplement > 0 && <span className="text-teal-700 text-[10px] font-black">+{v.prixSupplement} TND</span>}
                              <button type="button" onClick={() => removeVariantFromForm(i)} className="text-red-500 hover:text-red-700 ml-1 font-bold">×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Variant Widget */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mt-4 space-y-3">
                      <p className="text-xs font-bold text-slate-600">Ajouter une déclinaison de produit</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <input
                          type="text"
                          placeholder="Taille (Ex: M)"
                          value={newVariant.taille}
                          onChange={(e) => setNewVariant({ ...newVariant, taille: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Couleur (Ex: Noir)"
                          value={newVariant.couleur}
                          onChange={(e) => setNewVariant({ ...newVariant, couleur: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Pointure (Ex: 42)"
                          value={newVariant.pointure}
                          onChange={(e) => setNewVariant({ ...newVariant, pointure: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="number"
                          placeholder="Stock"
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="number"
                          placeholder="+ TND (Optionnel)"
                          value={newVariant.prixSupplement}
                          onChange={(e) => setNewVariant({ ...newVariant, prixSupplement: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                          step="0.1"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addVariantToForm}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs transition"
                      >
                        + Ajouter Déclinaison
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-bold py-3 rounded-2xl shadow-lg shadow-teal-100 transition text-xs"
                    >
                      Sauvegarder le produit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-3 rounded-2xl transition text-xs"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden hover:-translate-y-1 transition duration-200">
                  {product.image && (
                    <img src={product.image} alt={product.nom} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <h3 className="font-bold text-slate-800 text-sm">{product.nom}</h3>
                    <p className="text-slate-500 text-xs mt-1.5 line-clamp-2">{product.description}</p>
                    
                    {/* Variants badge details */}
                    {product.variantes && product.variantes.length > 0 && (
                      <div className="my-3 flex flex-wrap gap-1">
                        {product.variantes.map((v, i) => (
                          <span key={i} className="bg-slate-50 text-slate-500 border border-slate-100 text-[10px] px-2 py-0.5 rounded-lg">
                            {v.taille || v.couleur || v.pointure} ({v.stock})
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center my-4">
                      <span className="text-xl font-black text-teal-700">{product.prix.toFixed(3)} TND</span>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                        Stock total: {product.stock}
                      </span>
                    </div>

                    <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
                        <span>Gestion rapide du stock</span>
                        <span className={product.stock <= 5 ? 'text-red-600' : 'text-emerald-700'}>{product.stock <= 5 ? 'Stock faible' : 'Disponible'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleStockAdjustment(product, 10)} className="flex-1 rounded-xl bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">+10</button>
                        <button onClick={() => handleStockAdjustment(product, -1)} disabled={product.stock < 1} className="flex-1 rounded-xl bg-amber-50 px-2 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40">-1</button>
                        <button onClick={() => handleStockAdjustment(product)} className="flex-1 rounded-xl bg-white px-2 py-2 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">Definir</button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEdit(product)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition"
                      >
                        <Edit size={14} />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition"
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RMA / Returns Tab */}
        {activeTab === 'returns' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6">
            <h2 className="text-xl font-black text-slate-800 mb-6">Demandes de retours & RMA clients</h2>

            {retours.length === 0 ? (
              <p className="text-slate-400 text-xs py-6 text-center">Aucune réclamation de retour en cours.</p>
            ) : (
              <div className="space-y-4">
                {retours.map((ret) => (
                  <div key={ret.id} className="border border-slate-100 rounded-2xl p-5 flex flex-wrap justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Retour #{ret.id}</span>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                          {ret.statut}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        Commande ID: {ret.Commande?.numeroCommande} | Valeur remboursement : {ret.montantRemboursement?.toFixed(3)} TND
                      </p>
                      <p className="text-xs text-slate-600 font-semibold bg-slate-50 p-3 rounded-xl border mt-2">
                        <strong>Motif client :</strong> {ret.motif}
                      </p>
                      {ret.commentaireVendeur && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          Remarque boutique : {ret.commentaireVendeur}
                        </p>
                      )}
                    </div>

                    {ret.statut === 'demande' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProcessReturn(ret.id, 'approuve')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                          Approuver
                        </button>
                        <button
                          onClick={() => handleProcessReturn(ret.id, 'refuse')}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                          Refuser
                        </button>
                        <button
                          onClick={() => handleProcessReturn(ret.id, 'rembourse')}
                          className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                          Valider remboursement
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">{t('withdrawalRequests')}</h2>
              <button
                onClick={() => setShowWithdrawalForm(!showWithdrawalForm)}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold text-xs shadow-lg shadow-indigo-100 transition"
              >
                <Plus size={16} />
                {t('requestWithdrawal')}
              </button>
            </div>

            {showWithdrawalForm && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 mb-6 max-w-md">
                <p className="mb-4 rounded-xl bg-[#EEF2FF] px-3 py-2 text-xs font-semibold text-[#4F46E5]">Seuil minimum de retrait : 50.000 TND</p>
                <form onSubmit={handleWithdrawal} className="space-y-4">
                  <div className="space-y-3">
                    <input
                      type="number"
                      placeholder={t('withdrawalAmount')}
                      value={withdrawalData.montant}
                      onChange={(e) => setWithdrawalData({ ...withdrawalData, montant: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700"
                      required
                      step="0.001"
                      max={stats.soldeDisponible}
                      min="50"
                      title="Le retrait minimum est de 50 TND"
                    />
                    <input
                      type="text"
                      placeholder="IBAN tunisien (RIB)"
                      value={withdrawalData.iban}
                      onChange={(e) => setWithdrawalData({ ...withdrawalData, iban: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-teal-700"
                      required
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition text-xs"
                    >
                      Soumettre
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWithdrawalForm(false)}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-2.5 rounded-xl transition text-xs"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-4">
              {vendorData?.retraits?.map((retrait) => (
                <div key={retrait.id} className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 flex justify-between items-center gap-4">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{retrait.montant.toFixed(3)} TND</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">IBAN: {retrait.iban}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      retrait.statut === 'approuve' || retrait.statut === 'verse' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {retrait.statut}
                    </span>
                    <p className="text-slate-400 text-[10px] mt-1.5">
                      {new Date(retrait.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commission info footer */}
        <div className="mt-8 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-xs">{t('commissionBreakdown')}</p>
            <p className="text-amber-800 text-[11px] mt-0.5">{t('commissionRate')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VendorDashboard;
