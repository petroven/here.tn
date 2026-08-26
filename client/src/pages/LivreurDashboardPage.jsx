import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Package, History, BarChart3, Wifi, WifiOff, Clock } from 'lucide-react';
import LivreurCourseCard from '../components/livreur/LivreurCourseCard';
import LivreurCourseDetail from '../components/livreur/LivreurCourseDetail';
import LivreurHistorique from '../components/livreur/LivreurHistorique';
import LivreurStatsPanel from '../components/livreur/LivreurStatsPanel';
import LivreurNotificationOverlay from '../components/livreur/LivreurNotificationOverlay';
import { API_URL, SERVER_ORIGIN } from '../config/api.js';

const STATUT_OPTIONS = [
  { value: 'disponible', label: 'Disponible', icon: Wifi },
  { value: 'occupe', label: 'Occupé', icon: Clock },
  { value: 'hors_ligne', label: 'Hors ligne', icon: WifiOff },
];

export default function LivreurDashboardPage({ onLogout }) {
  const token = localStorage.getItem('token');
  const [activeTab, setActiveTab] = useState('courses');
  const [profil, setProfil] = useState({ statut: 'hors_ligne' });
  const [courses, setCourses] = useState({ disponibles: [], enCours: [] });
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [historique, setHistorique] = useState(null);
  const [historiqueLoading, setHistoriqueLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [statutUpdating, setStatutUpdating] = useState(false);
  const [pendingNotification, setPendingNotification] = useState(null);
  const socketRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/livreur/courses`, { headers: authHeaders });
      const data = await response.json();
      if (data.success) setCourses(data.data);
    } catch (err) {
      console.error('Erreur chargement courses:', err);
    } finally {
      setCoursesLoading(false);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch(`${API_URL}/livreur/stats`, { headers: authHeaders });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
        setProfil((prev) => ({ ...prev, statut: data.data.statut }));
      }
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  const fetchHistorique = useCallback(async () => {
    setHistoriqueLoading(true);
    try {
      const response = await fetch(`${API_URL}/livreur/historique`, { headers: authHeaders });
      const data = await response.json();
      if (data.success) setHistorique(data.data);
    } catch (err) {
      console.error('Erreur chargement historique:', err);
    } finally {
      setHistoriqueLoading(false);
    }
  }, [token]);

  const fetchPendingNotification = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/livreur/notifications/pending`, { headers: authHeaders });
      const data = await response.json();
      if (data.success && data.data) setPendingNotification(data.data);
    } catch (err) {
      console.error('Erreur réconciliation notification:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchCourses();
    fetchStats();
    fetchPendingNotification();
    const interval = setInterval(fetchCourses, 15000);
    return () => clearInterval(interval);
  }, [fetchCourses, fetchStats, fetchPendingNotification]);

  // Socket.io: push notifications for new courses matched to this courier
  useEffect(() => {
    if (!token) return undefined;
    const socket = io(`${SERVER_ORIGIN}`, { auth: { token } });
    socketRef.current = socket;

    socket.on('notification:nouvelle', (payload) => setPendingNotification(payload));
    socket.on('notification:prise', (payload) => {
      setPendingNotification((current) => (current?.livraisonId === payload.livraisonId ? null : current));
    });
    socket.on('connect', fetchPendingNotification);

    return () => socket.disconnect();
  }, [token, fetchPendingNotification]);

  useEffect(() => {
    if (activeTab === 'historique' && !historique) fetchHistorique();
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, historique, fetchHistorique, fetchStats]);

  // Geolocation: pushed every 30s while the courier is not offline
  useEffect(() => {
    if (profil.statut === 'hors_ligne') return undefined;
    const pushPosition = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch(`${API_URL}/livreur/position`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          }).catch((err) => console.warn('Erreur envoi position:', err));
        },
        (err) => console.warn('Géolocalisation refusée ou indisponible:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    };
    pushPosition();
    const interval = setInterval(pushPosition, 30000);
    return () => clearInterval(interval);
  }, [profil.statut, token]);

  const handleStatutChange = async (statut) => {
    setStatutUpdating(true);
    try {
      const response = await fetch(`${API_URL}/livreur/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ statut }),
      });
      const data = await response.json();
      if (data.success) setProfil(data.data);
    } catch (err) {
      console.error('Erreur changement statut:', err);
    } finally {
      setStatutUpdating(false);
    }
  };

  const handleAccepter = async (courseId) => {
    try {
      const response = await fetch(`${API_URL}/livreur/courses/${courseId}/accepter`, {
        method: 'PATCH',
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        alert(data.message || 'Cette course vient d\'être prise par un autre livreur.');
      }
      fetchCourses();
    } catch (err) {
      console.error('Erreur acceptation course:', err);
    }
  };

  const handleCourseChanged = () => {
    setSelectedCourse(null);
    fetchCourses();
    fetchStats();
  };

  const handleNotificationAccepter = async (notificationId) => {
    try {
      const response = await fetch(`${API_URL}/livreur/notifications/${notificationId}/accepter`, {
        method: 'PATCH',
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        alert(data.message || 'Cette course vient d\'être prise par un autre livreur.');
      }
    } catch (err) {
      console.error('Erreur acceptation notification:', err);
    } finally {
      setPendingNotification(null);
      fetchCourses();
      fetchStats();
    }
  };

  const handleNotificationRefuser = async (notificationId) => {
    try {
      await fetch(`${API_URL}/livreur/notifications/${notificationId}/refuser`, {
        method: 'PATCH',
        headers: authHeaders,
      });
    } catch (err) {
      console.error('Erreur refus notification:', err);
    } finally {
      setPendingNotification(null);
    }
  };

  const tabs = [
    { id: 'courses', label: 'Courses', icon: Package },
    { id: 'historique', label: 'Historique', icon: History },
    { id: 'stats', label: 'Profil', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center overflow-hidden p-1">
              <img src="/logo-icon.png" alt="here.tn" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-sm font-black text-slate-900">Espace Livreur</h1>
          </div>
        </div>
        <div className="px-4 pb-3 grid grid-cols-3 gap-2">
          {STATUT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = profil.statut === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleStatutChange(opt.value)}
                disabled={statutUpdating}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition disabled:opacity-50 ${
                  active ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={13} /> {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      <main>
        {activeTab === 'courses' && (
          <div className="p-4 space-y-6 max-w-xl mx-auto">
            {coursesLoading ? (
              <p className="text-center text-sm text-slate-500 py-8">Chargement des courses...</p>
            ) : (
              <>
                {courses.enCours.length > 0 && (
                  <section className="space-y-2">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Mes courses en cours</h2>
                    {courses.enCours.map((c) => (
                      <LivreurCourseCard key={c.id} course={c} onOpen={setSelectedCourse} onAccepter={handleAccepter} />
                    ))}
                  </section>
                )}

                <section className="space-y-2">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Courses disponibles</h2>
                  {courses.disponibles.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-8">Aucune course disponible pour le moment.</p>
                  ) : (
                    courses.disponibles.map((c) => (
                      <LivreurCourseCard key={c.id} course={c} onOpen={setSelectedCourse} onAccepter={handleAccepter} />
                    ))
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === 'historique' && <LivreurHistorique historique={historique} loading={historiqueLoading} />}
        {activeTab === 'stats' && <LivreurStatsPanel stats={stats} loading={statsLoading} onLogout={onLogout} />}
      </main>

      {selectedCourse && (
        <LivreurCourseDetail
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onChanged={handleCourseChanged}
        />
      )}

      <LivreurNotificationOverlay
        notification={pendingNotification}
        onAccepter={handleNotificationAccepter}
        onRefuser={handleNotificationRefuser}
        onExpired={() => setPendingNotification(null)}
      />

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2">
        <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold text-slate-600 max-w-xl mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition ${active ? 'text-amber-600' : 'hover:text-amber-600'}`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
