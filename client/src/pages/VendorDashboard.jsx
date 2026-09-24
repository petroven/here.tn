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
  FileSpreadsheet,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { API_URL } from '../config/api.js';
import ProductImportModal from '../components/vendor/ProductImportModal.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import ToastHost from '../components/ui/Toast.jsx';
import Logo from '../components/ui/Logo.jsx';

export function VendorDashboard({ language = 'fr', setLanguage = () => {} }) {
  const { t } = useTranslation(language);
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const locale = isAr ? 'ar-TN' : 'fr-TN';
  const [vendorData, setVendorData] = useState(null);
  const [products, setProducts] = useState([]);
  const [retours, setRetours] = useState([]);
  const [categories, setCategories] = useState([]);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // product object when editing
  const [showImportModal, setShowImportModal] = useState(false);
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
    images: [],
    categorieId: '',
    delaiRetourJoursOverride: '',
  });
  const [productFormError, setProductFormError] = useState('');

  // KYC Form State
  const [kycForm, setKycForm] = useState({ kycCin: '', kycRib: '', documentCin: null, documentRib: null });
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycMessage, setKycMessage] = useState('');

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

  // Charge la vraie taxonomie (12 univers + sous-catégories) plutôt que de la
  // déduire des produits déjà en ligne — l'ancienne version ne proposait que
  // les catégories déjà utilisées par au moins un produit existant, ce qui
  // en faisait disparaître la plupart et générait de faux ID (position dans
  // la liste) sans rapport avec les vrais ID de la table Categorie.
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
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
        alert(tr("Erreur d'upload : ", 'خطأ في الرفع: ') + data.message);
      }
    } catch (err) {
      alert(tr("Erreur lors du téléversement de l'image.", 'خطأ أثناء رفع الصورة.'));
    } finally {
      setUploadingImage(false);
    }
  };

  // Photos additionnelles (galerie) — la photo de couverture (image) reste
  // gérée séparément par handleImageUpload ci-dessus ; celles-ci alimentent
  // productForm.images, déjà affiché en galerie sur ProductPage.
  const handleAdditionalImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImage(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json();
        if (data.success) uploadedUrls.push(data.url);
      }
      setProductForm((prev) => ({ ...prev, images: [...(prev.images || []), ...uploadedUrls] }));
    } catch (err) {
      alert(tr("Erreur lors du téléversement des photos.", 'خطأ أثناء رفع الصور.'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const removeAdditionalImage = (index) => {
    setProductForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setKycMessage('');
    if (!kycForm.kycCin || !kycForm.kycRib) {
      setKycMessage(tr('Numéro CIN et RIB requis.', 'رقم بطاقة التعريف و RIB مطلوبان.'));
      return;
    }
    setKycSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('kycCin', kycForm.kycCin);
      formData.append('kycRib', kycForm.kycRib);
      if (kycForm.documentCin) formData.append('documentCin', kycForm.documentCin);
      if (kycForm.documentRib) formData.append('documentRib', kycForm.documentRib);

      const response = await fetch(`${API_URL}/vendor/kyc/${vendorId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setKycMessage(tr('Documents envoyés — en attente de vérification par un administrateur.', 'تم إرسال الوثائق — بانتظار التحقق من طرف الإدارة.'));
        fetchVendorData(vendorId);
      } else {
        setKycMessage(data.message || tr("Erreur lors de l'envoi.", 'خطأ أثناء الإرسال.'));
      }
    } catch (err) {
      setKycMessage(tr("Erreur lors de l'envoi des documents.", 'خطأ أثناء إرسال الوثائق.'));
    } finally {
      setKycSubmitting(false);
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
        setProductForm({ nom: '', description: '', prix: '', prixAvant: '', stock: '', image: '', images: [], categorieId: '', delaiRetourJoursOverride: '' });
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
      images: Array.isArray(product.images) ? product.images : [],
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
      ? window.prompt(tr(`Nouveau stock pour « ${product.nom} »`, `المخزون الجديد لـ « ${product.nom} »`), String(product.stock))
      : product.stock + amount;
    if (requestedStock === null || requestedStock === '') return;

    try {
      const response = await fetch(`${API_URL}/vendor/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stock: Number(requestedStock), motif: amount === null ? 'inventaire' : 'reassort_rapide' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('Stock impossible à mettre à jour.', 'تعذر تحديث المخزون.'));
      setProducts((current) => current.map((item) => item.id === product.id ? data.data : item));
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRateClient = async (commandeId) => {
    const note = window.prompt(tr('Note pour ce client (1 à 5) :', 'تقييم هذا العميل (1 إلى 5):'), '5');
    if (note === null) return;
    const noteNum = Number(note);
    if (!Number.isInteger(noteNum) || noteNum < 1 || noteNum > 5) {
      alert(tr('La note doit être un entier entre 1 et 5.', 'يجب أن يكون التقييم رقمًا صحيحًا بين 1 و 5.'));
      return;
    }
    const commentaire = window.prompt(tr('Commentaire (optionnel) :', 'تعليق (اختياري):')) || '';

    try {
      const response = await fetch(`${API_URL}/avis/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commandeId, note: noteNum, commentaire }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      alert(tr('Évaluation client enregistrée.', 'تم تسجيل تقييم العميل.'));
    } catch (error) {
      alert(error.message || tr("Erreur lors de l'évaluation du client.", 'خطأ أثناء تقييم العميل.'));
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
        alert(tr(`Statut de livraison mis à jour : ${newStatut}`, `تم تحديث حالة التوصيل: ${newStatut}`));
        fetchVendorData(vendorId);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(tr('Erreur lors de la mise à jour de la livraison.', 'خطأ أثناء تحديث التوصيل.'));
    }
  };

  const handleDownloadAwb = async (commandeId, awbNumber) => {
    try {
      const response = await fetch(`${API_URL}/livraisons/${commandeId}/awb`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(tr('Erreur de téléchargement.', 'خطأ أثناء التحميل.'));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `awb-${awbNumber || commandeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(tr('Impossible de télécharger le bordereau AWB.', 'تعذر تحميل وثيقة الشحن AWB.'));
    }
  };

  const handleProcessReturn = async (returnId, targetStatut) => {
    const comment = window.prompt(tr('Commentaire pour le client (optionnel) :', 'تعليق للعميل (اختياري):'));
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
        alert(tr(`Retour traité : ${targetStatut}`, `تمت معالجة الإرجاع: ${targetStatut}`));
        fetchReturns();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(tr('Erreur lors du traitement du retour.', 'خطأ أثناء معالجة الإرجاع.'));
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

  const tabs = [
    { id: 'overview', label: tr('Commandes & Logistique', 'الطلبات واللوجستيك') },
    { id: 'products', label: tr('Mes Produits', 'منتجاتي') },
    { id: 'messages', label: tr('Messagerie', 'المراسلة') },
    { id: 'returns', label: tr('Retours & RMA', 'الإرجاعات') },
    { id: 'withdrawals', label: tr('Paiements & Retraits', 'المدفوعات والسحوبات') },
    { id: 'kyc', label: tr('Vérification (KYC)', 'التحقق من الهوية') },
  ];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={`min-h-screen ${isAr ? 'rtl' : 'ltr'} bg-slate-50 font-sans`}>
      {/* Header */}
      <div className="bg-[#1E1B18] text-white p-5 shadow-lg sm:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Logo variant="compact" tone="blanc" className="h-9 w-auto" />
              <h1 className="text-2xl font-black sm:text-3xl">{t('dashboard')}</h1>
              {vendorData?.boutique?.statut === 'validee' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">{tr('Boutique vérifiée', 'متجر موثّق')}</span>
              ) : vendorData?.boutique?.statut === 'suspendue' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-300">{tr('Boutique suspendue', 'متجر موقوف')}</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">{tr('Vérification en cours', 'التحقق جارٍ')}</span>
              )}
            </div>
            {vendorData?.boutique && (
              <p className="text-slate-300 text-sm mt-1">{vendorData.boutique.nom} — {vendorData.boutique.adresse || tr('Tunisie', 'تونس')}</p>
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
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">{tr('Finances', 'المالية')}</h2>
          <p className="text-[11px] font-semibold text-slate-400">{tr('Commission plateforme : 15% du sous-total produits (livraison exclue)', 'عمولة المنصة: 15% من مجموع المنتجات (التوصيل غير مشمول)')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-2">
          <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-5">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{tr('Ventes brutes', 'المبيعات الإجمالية')}</p>
            <p className="text-xl font-black text-slate-800 mt-1">{(stats.totalVentesBrutes ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">{tr('Produits + livraison', 'المنتجات + التوصيل')}</p>
          </div>

          <div className="bg-white rounded-lg border border-rose-100 shadow-soft p-5">
            <p className="text-rose-400 text-[11px] font-bold uppercase tracking-wider">{tr('− Commission (15%)', '− العمولة (15%)')}</p>
            <p className="text-xl font-black text-rose-600 mt-1">{(stats.totalCommissions ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-rose-300">{tr('Prélevée sur le sous-total produits', 'مقتطعة من مجموع المنتجات')}</p>
          </div>

          <div className="bg-white rounded-lg border border-emerald-100 shadow-soft p-5">
            <p className="text-emerald-500 text-[11px] font-bold uppercase tracking-wider">{tr('= Gains nets', '= الأرباح الصافية')}</p>
            <p className="text-xl font-black text-emerald-700 mt-1">{(stats.totalVentes ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-emerald-400">{tr('Ce qui vous revient', 'ما يعود إليكم')}</p>
          </div>

          <div className="bg-white rounded-lg border border-amber-100 shadow-soft p-5">
            <p className="text-amber-500 text-[11px] font-bold uppercase tracking-wider">{tr('En séquestre', 'في الضمان')}</p>
            <p className="text-xl font-black text-amber-600 mt-1">{(stats.soldeEnAttenteEscrow ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-amber-400">{tr("Bloqué jusqu'à fin de la fenêtre de retour", 'محجوز حتى انتهاء مهلة الإرجاع')}</p>
          </div>

          <div className="bg-white rounded-lg border border-terre-100 shadow-soft p-5">
            <p className="text-terre-500 text-[11px] font-bold uppercase tracking-wider">{t('balance')}</p>
            <p className="text-xl font-black text-terre-700 mt-1">{(stats.soldeDisponible ?? 0).toFixed(3)} TND</p>
            <p className="mt-1 text-[10px] font-semibold text-terre-400">{tr('Déjà versé', 'تم دفعه سابقًا')} : {(stats.totalVerse ?? 0).toFixed(3)} TND</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-5">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{t('orders')}</p>
            <p className="text-xl font-black text-slate-800 mt-1">{stats.nombreCommandes || 0}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">{tr('Hors commandes annulées', 'باستثناء الطلبات الملغاة')}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex space-x-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 font-bold text-sm transition relative ${
                  activeTab === tab.id
                    ? 'text-terre-700 font-black'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-terre-700 rounded-full"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Overview & Orders Tab */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-6">
            <h2 className="text-xl font-black text-slate-800 mb-6">{tr('Suivi des commandes client', 'متابعة طلبات العملاء')}</h2>

            {orders.length === 0 ? (
              <p className="text-slate-400 text-xs py-6 text-center">{tr('Aucune commande reçue pour le moment.', 'لا توجد طلبات مستلمة حتى الآن.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold">
                      <th className="py-3 px-4">{tr('N° Commande', 'رقم الطلب')}</th>
                      <th className="py-3 px-4">{t('customer')}</th>
                      <th className="py-3 px-4">{t('amount')}</th>
                      <th className="py-3 px-4">{tr('Statut Commande', 'حالة الطلب')}</th>
                      <th className="py-3 px-4">{tr('Livraison', 'التوصيل')}</th>
                      <th className="py-3 px-4 text-right">{tr('Actions', 'إجراءات')}</th>
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
                          <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{tr('Net', 'صافي')} : {Number(order.montantVendeur ?? 0).toFixed(3)} TND</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase text-[10px]">
                            {order.statut}
                          </span>
                          {order.confirmationStatut === 'en_attente' && (
                            <p className="mt-1 text-[10px] font-bold text-amber-600 uppercase">{tr('Attente confirmation client', 'بانتظار تأكيد العميل')}</p>
                          )}
                          {order.confirmationStatut === 'refusee' && (
                            <p className="mt-1 text-[10px] font-bold text-red-600 uppercase">{tr('Refusée par le client', 'رفضها العميل')}</p>
                          )}
                          {order.confirmationStatut === 'expiree' && (
                            <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase">{tr('Confirmation expirée', 'انتهت مهلة التأكيد')}</p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500">AWB: {order.livraison?.awbNumber || 'N/A'}</span>
                            {order.livraison && (
                              <p className="text-[10px] text-red-600 font-bold uppercase">
                                {tr('État', 'الحالة')}: {order.livraison.statut}
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
                                title={tr("Télécharger Bordereau d'expédition AWB", 'تحميل وثيقة الشحن AWB')}
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
                                <option value="" disabled>{tr('Changer statut livraison', 'تغيير حالة التوصيل')}</option>
                                <option value="expedie" disabled={order.confirmationStatut === 'en_attente'}>
                                  {order.confirmationStatut === 'en_attente' ? tr('Expédié (confirmation client requise)', 'تم الشحن (يتطلب تأكيد العميل)') : t('shipped')}
                                </option>
                                <option value="en_cours_livraison">{tr('En cours', 'قيد التنفيذ')}</option>
                                <option value="livre">{tr('Livré (Payé COD)', 'تم التسليم (دفع عند الاستلام)')}</option>
                                <option value="retourne">{tr('Retourné', 'مرتجع')}</option>
                              </select>
                            )}

                            {order.statut === 'livree' && (
                              <button
                                onClick={() => handleRateClient(order.id)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 p-2 rounded-xl transition font-bold"
                                title={tr('Noter ce client', 'تقييم هذا العميل')}
                              >
                                {tr('Noter client', 'تقييم العميل')}
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
                <h2 className="text-xl font-black text-slate-800">{tr('Mes produits à la vente', 'منتجاتي المعروضة للبيع')}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{products.filter((product) => product.stock <= 5).length} {tr('produit(s) en stock faible', 'منتج (منتجات) بمخزون منخفض')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-2xl flex items-center gap-2 font-bold text-xs shadow-soft transition"
                >
                  <FileSpreadsheet size={16} />
                  {tr('Importer (Excel/ZIP)', 'استيراد (Excel/ZIP)')}
                </button>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setProductFormError('');
                    setProductForm({ nom: '', description: '', prix: '', prixAvant: '', stock: '', image: '', images: [], categorieId: '', delaiRetourJoursOverride: '' });
                    setFormVariants([]);
                    setShowProductForm(true);
                  }}
                  className="bg-terre-700 hover:bg-terre-800 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold text-xs shadow-lg shadow-terre-100 transition"
                >
                  <Plus size={16} />
                  {tr('Ajouter un produit', 'إضافة منتج')}
                </button>
              </div>
            </div>

            {showImportModal && (
              <ProductImportModal
                vendorId={vendorId}
                token={token}
                language={language}
                onClose={() => setShowImportModal(false)}
                onImported={() => fetchProducts(vendorId)}
              />
            )}

            {/* Product Create/Edit Form modal */}
            {showProductForm && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-6 mb-8 max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">
                    {editingProduct ? tr('Modifier le produit', 'تعديل المنتج') : tr('Créer un nouveau produit', 'إنشاء منتج جديد')}
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
                      placeholder={tr('Nom du produit', 'اسم المنتج')}
                      value={productForm.nom}
                      onChange={(e) => setProductForm({ ...productForm, nom: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700 focus:border-transparent transition"
                      required
                    />
                    <input
                      type="number"
                      placeholder={tr('Prix de base (TND)', 'السعر الأساسي (د.ت)')}
                      value={productForm.prix}
                      onChange={(e) => setProductForm({ ...productForm, prix: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700 focus:border-transparent transition"
                      required
                      step="0.001"
                    />
                  </div>

                  {editingProduct && (
                    <div>
                      <input
                        type="number"
                        placeholder={tr('Prix barré / avant promo (TND, optionnel)', 'السعر قبل التخفيض (د.ت، اختياري)')}
                        value={productForm.prixAvant}
                        onChange={(e) => setProductForm({ ...productForm, prixAvant: e.target.value })}
                        className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700 focus:border-transparent transition"
                        step="0.001"
                      />
                      <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                        {tr(
                          "Politique anti-fausses promotions : le prix barré doit correspondre à un prix réellement pratiqué sur ce produit pendant au moins 7 jours. Modifiez d'abord le prix, attendez, puis proposez la remise.",
                          'سياسة مكافحة التخفيضات الوهمية: يجب أن يطابق السعر المشطوب سعرًا طُبِّق فعليًا على هذا المنتج لمدة 7 أيام على الأقل. عدّلوا السعر أولًا، انتظروا، ثم اقترحوا التخفيض.',
                        )}
                      </p>
                    </div>
                  )}

                  <textarea
                    placeholder={tr('Description du produit', 'وصف المنتج')}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700 focus:border-transparent transition"
                    rows="3"
                    required
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    {/* Category — univers + sous-catégories réels (voir fetchCategories) */}
                    <select
                      value={productForm.categorieId}
                      onChange={(e) => setProductForm({ ...productForm, categorieId: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50/50 focus:ring-2 focus:ring-terre-700"
                      required
                    >
                      <option value="">{tr('Sélectionner une catégorie', 'اختر فئة')}</option>
                      {categories.map((univers) => (
                        <optgroup key={univers.id} label={univers.nom}>
                          {(univers.sousCategories || []).map((sousCategorie) => (
                            <option key={sousCategorie.id} value={sousCategorie.id}>{sousCategorie.nom}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <div>
                      <input
                        type="number"
                        min="0"
                        placeholder={tr('Délai de retour (jours) — laisser vide = défaut catégorie', 'مهلة الإرجاع (أيام) — اتركه فارغًا لاستخدام الافتراضي')}
                        value={productForm.delaiRetourJoursOverride}
                        onChange={(e) => setProductForm({ ...productForm, delaiRetourJoursOverride: e.target.value })}
                        className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700 focus:border-transparent transition"
                      />
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">{tr("Vous pouvez resserrer le délai de votre catégorie, jamais l'élargir.", 'يمكنكم تقليص مهلة فئتكم، لكن لا يمكن توسيعها أبدًا.')}</p>
                    </div>
                  </div>

                  {/* Photos — une couverture + une galerie de photos additionnelles,
                      toutes deux déjà affichées côté client (ProductPage). */}
                  <div className="border-t border-slate-100 pt-6 space-y-3">
                    <h4 className="font-bold text-sm text-slate-800">{tr('Photos du produit', 'صور المنتج')}</h4>

                    <div className="flex gap-2 items-center">
                      <label className="flex-1 border border-dashed border-slate-300 rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 text-xs text-slate-500 font-bold transition flex items-center justify-center gap-1.5">
                        <Upload size={14} />
                        {uploadingImage ? tr('Envoi...', 'جارٍ الرفع...') : tr('Photo de couverture', 'صورة الغلاف')}
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

                    <div className="flex flex-wrap gap-2">
                      {productForm.images.map((url, i) => (
                        <span key={i} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeAdditionalImage(i)}
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/70 text-white"
                            aria-label={tr('Retirer cette photo', 'إزالة هذه الصورة')}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <label className="flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:bg-slate-50">
                        <Plus size={18} />
                        <input type="file" accept="image/*" multiple onChange={handleAdditionalImagesUpload} className="hidden" />
                      </label>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400">{tr('Ajoutez plusieurs photos (angles, détails, packaging) pour rassurer les acheteurs.', 'أضيفوا عدة صور (زوايا، تفاصيل، التغليف) لطمأنة المشترين.')}</p>
                  </div>

                  {/* Stock or Variants Switch */}
                  <div className="border-t border-slate-100 pt-6">
                    <h4 className="font-bold text-sm text-slate-800 mb-3">{tr('Déclinaisons & Stock', 'الخيارات والمخزون')}</h4>

                    {formVariants.length === 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400 font-semibold">{tr('Stock physique global', 'المخزون الإجمالي')}</label>
                          <input
                            type="number"
                            placeholder={tr('Ex: 50', 'مثال: 50')}
                            value={productForm.stock}
                            onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                            className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700"
                            required={formVariants.length === 0}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mb-3">
                          {tr('Ou ajoutez des variantes (taille, couleur, pointure) ci-dessous pour gérer le stock par déclinaison.', 'أو أضيفوا خيارات (المقاس، اللون) أدناه لإدارة المخزون حسب كل خيار.')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 mb-4">
                        <p className="text-xs text-emerald-600 font-bold">
                          {tr(
                            `✓ Gestion des stocks activée par variantes (${formVariants.length} variante(s)). Stock total calculé : ${formVariants.reduce((sum, v) => sum + v.stock, 0)}`,
                            `✓ إدارة المخزون مفعّلة عبر الخيارات (${formVariants.length}). المخزون الإجمالي المحسوب: ${formVariants.reduce((sum, v) => sum + v.stock, 0)}`,
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {formVariants.map((v, i) => (
                            <span key={i} className="bg-slate-100 border text-slate-700 text-xs px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                              {v.taille && `${tr('Taille', 'المقاس')}: ${v.taille}`}
                              {v.couleur && `${tr('Couleur', 'اللون')}: ${v.couleur}`}
                              {v.pointure && `${tr('Pt', 'قياس')}: ${v.pointure}`}
                              <span className="bg-terre-700 text-white rounded px-1.5 py-0.5 text-[10px] font-black">{v.stock} {tr('pcs', 'قطعة')}</span>
                              {v.prixSupplement > 0 && <span className="text-terre-700 text-[10px] font-black">+{v.prixSupplement} TND</span>}
                              <button type="button" onClick={() => removeVariantFromForm(i)} className="text-red-500 hover:text-red-700 ml-1 font-bold">×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Variant Widget */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mt-4 space-y-3">
                      <p className="text-xs font-bold text-slate-600">{tr('Ajouter une déclinaison de produit', 'إضافة خيار للمنتج')}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <input
                          type="text"
                          placeholder={tr('Taille (Ex: M)', 'المقاس (مثال: M)')}
                          value={newVariant.taille}
                          onChange={(e) => setNewVariant({ ...newVariant, taille: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="text"
                          placeholder={tr('Couleur (Ex: Noir)', 'اللون (مثال: أسود)')}
                          value={newVariant.couleur}
                          onChange={(e) => setNewVariant({ ...newVariant, couleur: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="text"
                          placeholder={tr('Pointure (Ex: 42)', 'القياس (مثال: 42)')}
                          value={newVariant.pointure}
                          onChange={(e) => setNewVariant({ ...newVariant, pointure: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="number"
                          placeholder={tr('Stock', 'المخزون')}
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })}
                          className="border p-2 rounded-xl text-xs outline-none bg-white"
                        />
                        <input
                          type="number"
                          placeholder={tr('+ TND (Optionnel)', '+ د.ت (اختياري)')}
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
                        {tr('+ Ajouter Déclinaison', '+ إضافة خيار')}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-terre-700 hover:bg-terre-800 text-white font-bold py-3 rounded-2xl shadow-lg shadow-terre-100 transition text-xs"
                    >
                      {tr('Sauvegarder le produit', 'حفظ المنتج')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-3 rounded-2xl transition text-xs"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-lg border border-slate-200 shadow-soft overflow-hidden hover:-translate-y-1 transition duration-200">
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
                      <span className="text-xl font-black text-terre-700">{product.prix.toFixed(3)} TND</span>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                        {tr('Stock total', 'المخزون الإجمالي')}: {product.stock}
                      </span>
                    </div>

                    <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
                        <span>{tr('Gestion rapide du stock', 'إدارة سريعة للمخزون')}</span>
                        <span className={product.stock <= 5 ? 'text-red-600' : 'text-emerald-700'}>{product.stock <= 5 ? tr('Stock faible', 'مخزون منخفض') : t('inStock')}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleStockAdjustment(product, 10)} className="flex-1 rounded-xl bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">+10</button>
                        <button onClick={() => handleStockAdjustment(product, -1)} disabled={product.stock < 1} className="flex-1 rounded-xl bg-amber-50 px-2 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40">-1</button>
                        <button onClick={() => handleStockAdjustment(product)} className="flex-1 rounded-xl bg-white px-2 py-2 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">{tr('Definir', 'تحديد')}</button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEdit(product)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition"
                      >
                        <Edit size={14} />
                        {t('edit')}
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition"
                      >
                        <Trash2 size={14} />
                        {t('delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages Tab — même ChatWidget que côté client (inlineMode), le
            backend scope déjà les conversations par req.user.id quel que
            soit le rôle, donc aucun changement serveur n'est nécessaire ici. */}
        {activeTab === 'messages' && (
          <ChatWidget inlineMode language={language} />
        )}

        {/* RMA / Returns Tab */}
        {activeTab === 'returns' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-6">
            <h2 className="text-xl font-black text-slate-800 mb-6">{tr('Demandes de retours & RMA clients', "طلبات إرجاع العملاء")}</h2>

            {retours.length === 0 ? (
              <p className="text-slate-400 text-xs py-6 text-center">{tr('Aucune réclamation de retour en cours.', 'لا توجد طلبات إرجاع حاليًا.')}</p>
            ) : (
              <div className="space-y-4">
                {retours.map((ret) => (
                  <div key={ret.id} className="border border-slate-100 rounded-2xl p-5 flex flex-wrap justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{tr('Retour', 'إرجاع')} #{ret.id}</span>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                          {ret.statut}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        {tr('Commande ID', 'رقم الطلب')}: {ret.Commande?.numeroCommande} | {tr('Valeur remboursement', 'قيمة الاسترداد')} : {ret.montantRemboursement?.toFixed(3)} TND
                      </p>
                      <p className="text-xs text-slate-600 font-semibold bg-slate-50 p-3 rounded-xl border mt-2">
                        <strong>{tr('Motif client', 'سبب العميل')} :</strong> {ret.motif}
                      </p>
                      {ret.commentaireVendeur && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          {tr('Remarque boutique', 'ملاحظة المتجر')} : {ret.commentaireVendeur}
                        </p>
                      )}
                    </div>

                    {ret.statut === 'demande' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProcessReturn(ret.id, 'approuve')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                          {t('approve')}
                        </button>
                        <button
                          onClick={() => handleProcessReturn(ret.id, 'refuse')}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                          {t('reject')}
                        </button>
                        <button
                          onClick={() => handleProcessReturn(ret.id, 'rembourse')}
                          className="bg-terre-700 hover:bg-terre-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                          {tr('Valider remboursement', "تأكيد الاسترداد")}
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
                className="bg-[#C4532C] hover:bg-[#994122] text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold text-xs shadow-lg shadow-terre-100 transition"
              >
                <Plus size={16} />
                {t('requestWithdrawal')}
              </button>
            </div>

            {showWithdrawalForm && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-6 mb-6 max-w-md">
                <p className="mb-4 rounded-xl bg-[#F8E4DE] px-3 py-2 text-xs font-semibold text-[#994122]">{tr('Seuil minimum de retrait : 50.000 TND', 'الحد الأدنى للسحب: 50.000 د.ت')}</p>
                <form onSubmit={handleWithdrawal} className="space-y-4">
                  <div className="space-y-3">
                    <input
                      type="number"
                      placeholder={t('withdrawalAmount')}
                      value={withdrawalData.montant}
                      onChange={(e) => setWithdrawalData({ ...withdrawalData, montant: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700"
                      required
                      step="0.001"
                      max={stats.soldeDisponible}
                      min="50"
                      title={tr('Le retrait minimum est de 50 TND', 'الحد الأدنى للسحب هو 50 د.ت')}
                    />
                    <input
                      type="text"
                      placeholder={tr('IBAN tunisien (RIB)', 'IBAN تونسي (RIB)')}
                      value={withdrawalData.iban}
                      onChange={(e) => setWithdrawalData({ ...withdrawalData, iban: e.target.value })}
                      className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700"
                      required
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition text-xs"
                    >
                      {tr('Soumettre', 'إرسال')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWithdrawalForm(false)}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-2.5 rounded-xl transition text-xs"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-4">
              {vendorData?.retraits?.map((retrait) => (
                <div key={retrait.id} className="bg-white rounded-lg border border-slate-200 shadow-soft p-5 flex justify-between items-center gap-4">
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
                      {new Date(retrait.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="max-w-lg">
            <div className="bg-white rounded-lg border border-slate-200 shadow-soft p-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-slate-800">{tr("Vérification d'identité (KYC)", 'التحقق من الهوية')}</h2>
                {vendorData?.boutique?.kycStatut && vendorData.boutique.kycStatut !== 'non_soumis' && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    vendorData.boutique.kycStatut === 'valide' ? 'bg-emerald-50 text-emerald-700'
                      : vendorData.boutique.kycStatut === 'rejete' ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {vendorData.boutique.kycStatut === 'valide' ? tr('Vérifié', 'تم التحقق') : vendorData.boutique.kycStatut === 'rejete' ? tr('Rejeté', 'مرفوض') : t('pending')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {tr(
                  'Envoyez votre CIN et votre RIB pour obtenir le badge "boutique vérifiée", visible par tous vos clients. Documents stockés de façon sécurisée sur nos serveurs.',
                  'أرسلوا بطاقة تعريفكم و RIB للحصول على شارة "متجر موثّق" الظاهرة لجميع عملائكم. الوثائق مخزَّنة بأمان على خوادمنا.',
                )}
              </p>

              {vendorData?.boutique?.kycStatut === 'rejete' && vendorData.boutique.kycCommentaireAdmin && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <strong>{tr('Motif du rejet', 'سبب الرفض')} :</strong> {vendorData.boutique.kycCommentaireAdmin} — {tr('vous pouvez renvoyer des documents corrigés ci-dessous.', 'يمكنكم إرسال وثائق مصححة أدناه.')}
                </div>
              )}

              {kycMessage && (
                <div className="mb-4 rounded-xl bg-[#F8E4DE] px-3 py-2 text-xs font-semibold text-[#994122]">{kycMessage}</div>
              )}

              {vendorData?.boutique?.kycStatut === 'valide' ? (
                <p className="text-sm font-bold text-emerald-700">{tr('✓ Votre identité est vérifiée. Le badge "boutique vérifiée" est actif sur votre page.', '✓ تم التحقق من هويتكم. شارة "متجر موثّق" مفعّلة على صفحتكم.')}</p>
              ) : (
                <form onSubmit={handleKycSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder={tr('Numéro de CIN', 'رقم بطاقة التعريف')}
                    value={kycForm.kycCin}
                    onChange={(e) => setKycForm({ ...kycForm, kycCin: e.target.value })}
                    className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700"
                    required
                  />
                  <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl p-3 text-xs text-slate-500 font-bold cursor-pointer hover:bg-slate-50">
                    <Upload size={14} />
                    {kycForm.documentCin ? kycForm.documentCin.name : tr('Scan/photo de la CIN', 'صورة بطاقة التعريف')}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setKycForm({ ...kycForm, documentCin: e.target.files[0] })} />
                  </label>

                  <input
                    type="text"
                    placeholder={tr('Numéro de RIB', 'رقم RIB')}
                    value={kycForm.kycRib}
                    onChange={(e) => setKycForm({ ...kycForm, kycRib: e.target.value })}
                    className="border border-slate-200 rounded-xl p-3 w-full text-sm bg-slate-50/50 outline-none focus:ring-2 focus:ring-terre-700"
                    required
                  />
                  <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl p-3 text-xs text-slate-500 font-bold cursor-pointer hover:bg-slate-50">
                    <Upload size={14} />
                    {kycForm.documentRib ? kycForm.documentRib.name : tr('Scan/photo du RIB bancaire', 'صورة RIB البنكي')}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setKycForm({ ...kycForm, documentRib: e.target.files[0] })} />
                  </label>

                  <button type="submit" disabled={kycSubmitting} className="w-full bg-terre-700 hover:bg-terre-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm">
                    {kycSubmitting ? tr('Envoi...', 'جارٍ الإرسال...') : tr('Envoyer pour vérification', 'إرسال للتحقق')}
                  </button>
                </form>
              )}
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

      <ToastHost />
    </div>
  );
}

export default VendorDashboard;
