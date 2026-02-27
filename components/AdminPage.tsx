
import React, { useState, useEffect, useRef } from 'react';
import { MapPoint, MtuRegion, DailyReport, AdminUser, Language } from '../types';
import { saveMapSettings, deleteReport, verifyAdmin, addAdmin, deleteAdmin, subscribeToReports, subscribeToAdmins } from '../utils/db';
import { Settings, Move, PenTool, Palette, ShieldCheck, CheckCircle2, LogIn, MousePointer2, Plus, Trash2, Save, Archive, FileText, Clock, AlertTriangle, Users, UserPlus, Laptop, Smartphone, Monitor, RefreshCw, X } from 'lucide-react';

declare const L: any;

interface AdminPageProps {
  mapPoints: MapPoint[];
  setMapPoints: (points: MapPoint[]) => void;
  mtuRegions: MtuRegion[];
  setMtuRegions: (regions: MtuRegion[]) => void;
  lang: Language;
  t: (key: string) => string;
}

// --- HELPER COMPONENTS ---

const ConfirmModal = ({ 
  isOpen, 
  title, 
  message, 
  type, 
  onConfirm, 
  onCancel,
  isLoading,
  t
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  type: 'danger' | 'warning' | 'info'; 
  onConfirm: () => void; 
  onCancel: () => void;
  isLoading?: boolean;
  t: (key: string) => string;
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-full ${type === 'danger' ? 'bg-rose-100 text-rose-600' : type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </div>
        
        <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50 ${
              type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 
              type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 
              'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {type === 'danger' ? t('delete') : t('continue')}
          </button>
        </div>
      </div>
    </div>
  );
};

const getDeviceIcon = (info?: string) => {
  if (!info) return <Monitor className="w-4 h-4 text-slate-400" />;
  const lower = info.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return <Smartphone className="w-4 h-4 text-blue-500" />;
  if (lower.includes('linux') || lower.includes('mac') || lower.includes('windows')) return <Laptop className="w-4 h-4 text-indigo-500" />;
  return <Monitor className="w-4 h-4 text-slate-500" />;
};

const getDeviceInfo = () => {
   const ua = navigator.userAgent;
   let os = "Unknown OS";
   if (ua.indexOf("Win") !== -1) os = "Windows";
   if (ua.indexOf("Mac") !== -1) os = "MacOS";
   if (ua.indexOf("Linux") !== -1) os = "Linux";
   if (ua.indexOf("Android") !== -1) os = "Android";
   if (ua.indexOf("like Mac") !== -1) os = "iOS";

   let browser = "Unknown Browser";
   if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
   else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
   else if (ua.indexOf("Safari") !== -1) browser = "Safari";
   else if (ua.indexOf("Edge") !== -1) browser = "Edge";

   return `${os} / ${browser}`;
};

const AdminPage: React.FC<AdminPageProps> = ({ mapPoints, setMapPoints, mtuRegions, setMtuRegions, lang, t }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [error, setError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [activeTab, setActiveTab] = useState<'points' | 'regions' | 'archive' | 'users'>('points');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  
  // Archive State
  const [archivedReports, setArchivedReports] = useState<DailyReport[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  
  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    targetId: string | null;
    action: 'delete' | 'force-delete' | 'delete-admin' | 'delete-point';
  }>({ isOpen: false, title: '', message: '', type: 'info', targetId: null, action: 'delete' });
  
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Users State
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);
  const vertexMarkersRef = useRef<any[]>([]);
  const ghostMarkersRef = useRef<any[]>([]); 
  const dragMarkerRef = useRef<any>(null);

  // --- REAL TIME SUBSCRIPTION SETUP ---
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let unsubscribeReports: (() => void) | null = null;
    let unsubscribeAdmins: (() => void) | null = null;

    if (activeTab === 'archive') {
      setLoadingArchive(true);
      unsubscribeReports = subscribeToReports((reports) => {
        setArchivedReports(reports);
        setLoadingArchive(false);
      });
    } else if (activeTab === 'users') {
      unsubscribeAdmins = subscribeToAdmins((list) => {
        setAdmins(list);
      });
    }

    return () => {
      if (unsubscribeReports) unsubscribeReports();
      if (unsubscribeAdmins) unsubscribeAdmins();
    };
  }, [activeTab, isAuthenticated]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUser.trim() || !newAdminPass.trim()) return;
    
    setIsAddingAdmin(true);
    // Note: The subscription will auto-update the list
    const newAdmin: AdminUser = {
      username: newAdminUser.trim(),
      role: 'admin',
      name: newAdminUser.trim(),
      createdBy: currentUser || 'system',
      addedAt: Date.now()
    };
    const success = await addAdmin(newAdmin, newAdminPass.trim());
    if (success) {
      setNewAdminUser('');
      setNewAdminPass('');
    } else {
      alert("Error adding user.");
    }
    setIsAddingAdmin(false);
  };

  const initDeleteAdmin = (adminName: string) => {
    if (adminName === currentUser) {
      alert(t('cannot_delete_self'));
      return;
    }
    setModalState({
      isOpen: true,
      title: t('delete_admin_title'),
      message: `${t('delete_admin_msg')} "${adminName}"?`,
      type: 'danger',
      targetId: adminName,
      action: 'delete-admin'
    });
  };

  const initDeleteReport = (date: string) => {
    setModalState({
      isOpen: true,
      title: t('delete_confirm_title'),
      message: `${t('delete_confirm_msg')} (${date})`,
      type: 'danger',
      targetId: date,
      action: 'delete'
    });
  };

  const initDeletePoint = () => {
    if(!selectedItem) return;
    setModalState({
        isOpen: true,
        title: t('delete_point_title'),
        message: `${t('delete_point_msg')} "${selectedItem.name}"?`,
        type: 'danger',
        targetId: selectedItem.id,
        action: 'delete-point'
    });
  };

  const handleAddPoint = () => {
    // Get center of map or default
    const center = mapInstanceRef.current?.getCenter() || { lat: 41.3, lng: 69.2 };
    
    const newPoint: MapPoint = {
      id: `new_${Date.now().toString().slice(-5)}`,
      name: 'Новый пункт',
      lat: center.lat,
      lng: center.lng,
      region: 'Tashkent'
    };
    
    setMapPoints([...mapPoints, newPoint]);
    setSelectedItem(newPoint);
    setHasUnsavedChanges(true);
    
    // Pan to it
    if(mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([center.lat, center.lng], 12);
    }
  };

  const handleConfirmModal = async () => {
    if (!modalState.targetId) return;
    setIsProcessingAction(true);

    try {
      if (modalState.action === 'delete-admin') {
         await deleteAdmin(modalState.targetId);
         // Subscription updates list automatically
         closeModal();
      } 
      else if (modalState.action === 'delete-point') {
         const newPoints = mapPoints.filter(p => p.id !== modalState.targetId);
         setMapPoints(newPoints);
         setSelectedItem(null);
         setHasUnsavedChanges(true);
         closeModal();
      }
      else if (modalState.action === 'delete') {
         const date = modalState.targetId;
         // Attempt Server Delete
         const result = await deleteReport(date);
         
         if (result.success) {
           // Subscription updates list automatically for Firebase
           // For Local Backend, we might need manual update if not polling
           if (process.env.VITE_USE_LOCAL_BACKEND === 'true') {
              setArchivedReports(prev => prev.filter(r => r.date !== date));
           }
           closeModal();
         } else {
           // FAILED: Show Force Delete Modal
           setModalState({
             isOpen: true,
             title: t('error_server_delete'),
             message: t('error_server_delete_msg'),
             type: 'warning',
             targetId: date,
             action: 'force-delete'
           });
         }
      }
      else if (modalState.action === 'force-delete') {
         const date = modalState.targetId;
         await deleteReport(date); // Force local
         setArchivedReports(prev => prev.filter(r => r.date !== date));
         closeModal();
      }
    } catch (e) {
      console.error(e);
      closeModal();
    } finally {
      setIsProcessingAction(false);
    }
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Initialize Map
  useEffect(() => {
    if (!isAuthenticated || !mapContainerRef.current || mapInstanceRef.current) return;
    
    // Only initialize map if NOT in archive/users tab
    if (activeTab === 'archive' || activeTab === 'users') return;

    const map = L.map(mapContainerRef.current, {
      center: [41.5, 64.5],
      zoom: 6,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OSM',
      maxZoom: 19,
    }).addTo(map);

    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.8
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isAuthenticated, activeTab]);

  // Update Map Elements
  useEffect(() => {
    if (!mapInstanceRef.current || activeTab === 'archive' || activeTab === 'users') return;

    // Cleanup basic elements
    markersRef.current.forEach(m => m.remove());
    polygonsRef.current.forEach(p => p.remove());
    vertexMarkersRef.current.forEach(m => m.remove());
    ghostMarkersRef.current.forEach(m => m.remove());
    
    markersRef.current = [];
    polygonsRef.current = [];
    vertexMarkersRef.current = [];
    ghostMarkersRef.current = [];
    
    if (dragMarkerRef.current) {
      dragMarkerRef.current.remove();
      dragMarkerRef.current = null;
    }

    // --- DRAW REGIONS ---
    mtuRegions.forEach(region => {
      const isSelected = activeTab === 'regions' && selectedItem?.id === region.id;
      
      // Filter valid points (avoid NaN/crashes)
      const validPoints = (region.points || []).filter(p => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]));
      
      if (validPoints.length < 3) return; // Need at least 3 points for a polygon

      const polygon = L.polygon(validPoints, {
        color: region.color,
        fillColor: region.color,
        fillOpacity: isSelected ? 0.2 : 0.05,
        weight: isSelected ? 2 : 1,
        dashArray: isSelected ? null : '5, 5',
      }).addTo(mapInstanceRef.current);

      if (activeTab === 'regions') {
        polygon.on('click', () => {
          setSelectedItem(region);
        });
      }
      polygonsRef.current.push(polygon);

      if (isSelected) {
        // 1. Draw EXISTING Vertices using VALID points
        validPoints.forEach((latlng, index) => {
           const vertexIcon = L.divIcon({
             className: 'vertex-marker',
             html: `<div style="width: 12px; height: 12px; background: white; border: 2px solid ${region.color}; border-radius: 50%; cursor: move; box-shadow: 0 0 10px rgba(0,0,0,0.2);"></div>`,
             iconSize: [12, 12],
             iconAnchor: [6, 6]
           });

           const vertexMarker = L.marker(latlng, { 
             draggable: true, 
             icon: vertexIcon,
             zIndexOffset: 1000,
             title: "Drag to move, Right Click to delete"
           }).addTo(mapInstanceRef.current);

           // Dragging Logic
           vertexMarker.on('drag', (e: any) => {
              const newPos = e.target.getLatLng();
              // Create copy of valid points to avoid modifying reference prematurely
              const tempPoints = [...validPoints];
              tempPoints[index] = [newPos.lat, newPos.lng];
              polygon.setLatLngs(tempPoints);
           });

           vertexMarker.on('dragend', (e: any) => {
              const newPos = e.target.getLatLng();
              const newPoints = [...validPoints];
              newPoints[index] = [newPos.lat, newPos.lng];
              updateRegion(region.id, { points: newPoints });
           });

           // Right Click to Delete Logic
           vertexMarker.on('contextmenu', (e: any) => {
              if (validPoints.length <= 3) {
                 alert("Cannot delete. Polygon must have at least 3 points.");
                 return;
              }
              const newPoints = validPoints.filter((_, i) => i !== index);
              updateRegion(region.id, { points: newPoints });
           });

           vertexMarkersRef.current.push(vertexMarker);

           // 2. Draw GHOST Markers (Midpoints) to ADD new vertices
           // Find next point (loop back to 0 if last)
           const nextIndex = (index + 1) % validPoints.length;
           const nextPoint = validPoints[nextIndex];
           
           const midLat = (latlng[0] + nextPoint[0]) / 2;
           const midLng = (latlng[1] + nextPoint[1]) / 2;

           // Ensure midpoints are valid
           if (isNaN(midLat) || isNaN(midLng)) return;

           const ghostIcon = L.divIcon({
             className: 'ghost-marker',
             html: `<div style="width: 10px; height: 10px; background: ${region.color}; opacity: 0.5; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;"><span style="color:white; font-size: 8px; font-weight: bold;">+</span></div>`,
             iconSize: [10, 10],
             iconAnchor: [5, 5]
           });

           const ghostMarker = L.marker([midLat, midLng], {
             icon: ghostIcon,
             zIndexOffset: 900,
             title: "Click to add point"
           }).addTo(mapInstanceRef.current);

           ghostMarker.on('click', () => {
              const newPoints = [...validPoints];
              // Insert new point at nextIndex
              newPoints.splice(nextIndex, 0, [midLat, midLng]);
              updateRegion(region.id, { points: newPoints });
           });

           ghostMarkersRef.current.push(ghostMarker);
        });
      }
    });

    // --- DRAW POINTS ---
    mapPoints.forEach(point => {
      // Validate point
      if (isNaN(point.lat) || isNaN(point.lng)) return;

      const isSelected = activeTab === 'points' && selectedItem?.id === point.id;
      
      const icon = L.divIcon({
        className: 'custom-admin-marker',
        html: `<div style="background-color: ${isSelected ? '#2563eb' : '#475569'}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([point.lat, point.lng], { icon, draggable: false })
        .addTo(mapInstanceRef.current);

      if (activeTab === 'points') {
        marker.on('click', () => {
          setSelectedItem(point);
          mapInstanceRef.current.flyTo([point.lat, point.lng], 10);
        });
      }
      markersRef.current.push(marker);

      if (isSelected) {
         const dragIcon = L.divIcon({
            className: 'drag-marker',
            html: `
              <div class="relative flex flex-col items-center justify-end w-12 h-12 -mt-12">
                 <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white animate-bounce cursor-move">
                    <Move className="w-5 h-5 text-white" />
                 </div>
                 <div class="w-0.5 h-6 bg-blue-600"></div>
                 <div class="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
              </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 48]
         });

         const dragMarker = L.marker([point.lat, point.lng], { icon: dragIcon, draggable: true, zIndexOffset: 1000 })
            .addTo(mapInstanceRef.current);
         
         dragMarker.on('dragend', (e: any) => {
             const newLatLng = e.target.getLatLng();
             updatePoint(point.id, { lat: newLatLng.lat, lng: newLatLng.lng });
         });

         dragMarkerRef.current = dragMarker;
      }
    });

  }, [activeTab, selectedItem, mapPoints, mtuRegions]);

  const updatePoint = (id: string, updates: Partial<MapPoint>) => {
    const updated = mapPoints.map(p => p.id === id ? { ...p, ...updates } : p);
    setMapPoints(updated);
    setHasUnsavedChanges(true);
    if (selectedItem?.id === id) {
       setSelectedItem({ ...selectedItem, ...updates });
    }
  };

  const updateRegion = (id: string, updates: Partial<MtuRegion>) => {
    const updated = mtuRegions.map(r => r.id === id ? { ...r, ...updates } : r);
    setMtuRegions(updated);
    setHasUnsavedChanges(true);
    if (selectedItem?.id === id) {
       setSelectedItem({ ...selectedItem, ...updates });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingAuth(true);
    setError('');
    
    try {
      const deviceInfo = getDeviceInfo();
      const isValid = await verifyAdmin(username, password, deviceInfo);
      if (isValid) {
        setIsAuthenticated(true);
        setCurrentUser(username);
      } else {
        setError('Неверный логин или пароль');
      }
    } catch (e) {
      setError('Ошибка соединения с базой данных');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleSaveToDb = async () => {
    setIsSaving(true);
    const success = await saveMapSettings(mapPoints, mtuRegions);
    setTimeout(() => {
      setIsSaving(false);
      if (success) {
        setHasUnsavedChanges(false);
        alert(t('save_success'));
      } else {
        alert(t('error'));
      }
    }, 800);
  };

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 blur-sm"></div>
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center shadow-xl mb-4 text-white">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('login_title')}</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">{t('login_subtitle')}</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('login_label')}</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium"
                placeholder={t('enter_login')}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('password_label')}</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium"
                placeholder="•••••••"
              />
            </div>
            {error && <div className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-2 rounded-lg flex items-center justify-center gap-2"><AlertTriangle className="w-3 h-3"/> {error}</div>}
            <button 
              type="submit"
              disabled={isCheckingAuth}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCheckingAuth ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t('checking')}
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('login_btn')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN EDITOR ---
  return (
    <div className="flex h-full w-full bg-white relative">
      <ConfirmModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        isLoading={isProcessingAction}
        onConfirm={handleConfirmModal}
        onCancel={closeModal}
        t={t}
      />
      
      {/* Sidebar Editor */}
      <div className="w-96 flex flex-col border-r border-slate-200 bg-white shadow-2xl z-20">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
           <div className="flex items-center gap-3 mb-1">
             <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-500/30">
               <Settings className="w-5 h-5" />
             </div>
             <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('nav_admin')}</h2>
           </div>
           <p className="text-xs text-slate-500 font-medium ml-12">{t('hello')}, {currentUser}</p>
        </div>

        {/* Global Action Bar (Only for Map Edits) */}
        {activeTab !== 'archive' && activeTab !== 'users' && (
          <div className="p-3 bg-slate-50 border-b border-slate-200">
             <button 
               onClick={handleSaveToDb}
               disabled={isSaving}
               className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
                 hasUnsavedChanges 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-amber-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30'
               }`}
             >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('saving')}
                  </>
                ) : hasUnsavedChanges ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    {t('save_changes')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('all_saved')}
                  </>
                )}
             </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex p-2 bg-slate-50/50 border-b border-slate-100 gap-1 overflow-x-auto">
           <button 
             onClick={() => { setActiveTab('points'); setSelectedItem(null); }}
             className={`flex-1 py-2.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'points' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
           >
             {t('tab_points')}
           </button>
           <button 
             onClick={() => { setActiveTab('regions'); setSelectedItem(null); }}
             className={`flex-1 py-2.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'regions' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
           >
             {t('tab_regions')}
           </button>
           <button 
             onClick={() => { setActiveTab('archive'); setSelectedItem(null); }}
             className={`flex-1 py-2.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'archive' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
           >
             {t('tab_archive')}
           </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
           {activeTab === 'points' && (
             <>
               <button
                  onClick={handleAddPoint}
                  className="w-full py-2 mb-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border border-blue-200 dashed"
               >
                  <Plus className="w-4 h-4" /> {t('add_new_point')}
               </button>
               {mapPoints.map(point => (
                 <div 
                    key={point.id} 
                    onClick={() => {
                       setSelectedItem(point);
                       mapInstanceRef.current?.setView([point.lat, point.lng], 12);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${selectedItem?.id === point.id ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-500/20' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
                 >
                    <div className="flex justify-between items-center mb-1">
                       <div className="font-bold text-slate-800 text-sm">{point.name}</div>
                       <div className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{point.id}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex gap-3">
                       <span>Lat: {point.lat.toFixed(4)}</span>
                       <span>Lng: {point.lng.toFixed(4)}</span>
                    </div>
                 </div>
               ))}
             </>
           )}

           {activeTab === 'regions' && mtuRegions.map(region => (
             <div 
                key={region.id} 
                onClick={() => {
                   setSelectedItem(region);
                   // Fit bounds
                   const validPoints = (region.points || []).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
                   if (validPoints.length > 0) {
                     const lats = validPoints.map(p => p[0]);
                     const lngs = validPoints.map(p => p[1]);
                     const minLat = Math.min(...lats), maxLat = Math.max(...lats);
                     const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
                     mapInstanceRef.current?.fitBounds([[minLat, minLng], [maxLat, maxLng]]);
                   }
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${selectedItem?.id === region.id ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-500/20' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
             >
                <div className="flex items-center gap-3">
                   <div className="w-5 h-5 rounded-full border-2 border-white shadow-md ring-1 ring-black/5" style={{ backgroundColor: region.color }}></div>
                   <div className="font-bold text-slate-800 text-sm">
                      {region.name.replace('MTУ', lang === 'ru' ? 'РЖУ' : 'MTU')}
                   </div>
                </div>
             </div>
           ))}
           
           {activeTab === 'archive' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('saved_reports')}</h3>
                   {/* Refresh is now mostly automatic, but keeping for force reload if needed */}
                   <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-500 transition-colors pointer-events-none opacity-50">
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingArchive ? 'animate-spin text-blue-500' : ''}`} />
                   </button>
                </div>
                {loadingArchive && archivedReports.length === 0 ? (
                   <div className="p-6 text-center text-slate-400 text-xs">{t('loading')}</div>
                ) : archivedReports.length > 0 ? (
                   archivedReports.map(report => (
                     <div key={report.date} className="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                        <div className="flex justify-between items-start mb-2">
                           <div className="flex items-center gap-2">
                              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                 <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                 <div className="text-sm font-bold text-slate-800">{report.date}</div>
                                 <div className="text-[10px] text-slate-400 font-medium">
                                    {new Date(report.timestamp).toLocaleString(lang === 'uz' ? 'uz-UZ' : 'ru-RU')}
                                 </div>
                              </div>
                           </div>
                           <button 
                             type="button" 
                             onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                initDeleteReport(report.date);
                             }}
                             className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors relative z-10 cursor-pointer"
                             title="Удалить отчет"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                        {/* We use wagonCount from the meta object here */}
                        <div className="flex items-center gap-4 pt-2 border-t border-slate-50 mt-2">
                           <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <Archive className="w-3.5 h-3.5 text-blue-500" />
                              {/* If wagonCount is available in meta, use it, else default 0 */}
                              {(report as any).wagonCount || 0} {lang === 'uz' ? 'vag' : 'ваг'}
                           </div>
                        </div>
                     </div>
                   ))
                ) : (
                   <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      {t('archive_empty')}
                   </div>
                )}
              </div>
           )}
        </div>

        {/* Editor Panel (Bottom of Sidebar) */}
        {selectedItem && activeTab !== 'archive' && activeTab !== 'users' && (
          <div className="p-5 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-10 z-30">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <PenTool className="w-3.5 h-3.5 text-blue-600" /> {t('edit_mode')}
                </h3>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('done')}
                </button>
             </div>
             
             {activeTab === 'points' && (
               <div className="space-y-4">
                  <div className="flex gap-3">
                     <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('station_name')}</label>
                        <input 
                          type="text" 
                          value={selectedItem.name} 
                          onChange={(e) => updatePoint(selectedItem.id, { name: e.target.value })}
                          className="w-full text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        />
                     </div>
                     <div className="w-24">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('code_id')}</label>
                        <input 
                          type="text" 
                          value={selectedItem.id} 
                          onChange={(e) => updatePoint(selectedItem.id, { id: e.target.value })}
                          className="w-full text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        />
                     </div>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Region Key</label>
                     <input 
                       type="text" 
                       value={selectedItem.region} 
                       onChange={(e) => updatePoint(selectedItem.id, { region: e.target.value })}
                       className="w-full text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                     />
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                     <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 mt-0.5">
                       <Move className="w-4 h-4" />
                     </div>
                     <div>
                        <p className="text-[11px] font-bold text-blue-800 mb-0.5">{t('move_marker')}</p>
                        <p className="text-[10px] text-blue-600 leading-tight">
                           {t('move_marker_desc')}
                        </p>
                     </div>
                  </div>
                  <button 
                     onClick={initDeletePoint}
                     className="w-full py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-rose-100"
                  >
                     <Trash2 className="w-3.5 h-3.5" /> {t('delete_this_point')}
                  </button>
               </div>
             )}

             {activeTab === 'regions' && (
               <div className="space-y-4">
                  <div className="flex gap-3">
                     <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('region_name')}</label>
                        <input 
                           type="text" 
                           value={selectedItem.name} 
                           onChange={(e) => updateRegion(selectedItem.id, { name: e.target.value })}
                           className="w-full text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('color')}</label>
                        <div className="relative w-12 h-11 rounded-xl overflow-hidden shadow-sm border border-slate-200 group hover:ring-2 hover:ring-blue-500/50 transition-all">
                           <input 
                              type="color" 
                              value={selectedItem.color} 
                              onChange={(e) => updateRegion(selectedItem.id, { color: e.target.value })}
                              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer"
                           />
                           <Palette className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-difference opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                     </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col gap-2">
                     <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 mt-0.5">
                           <MousePointer2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[11px] font-bold text-indigo-800 uppercase mb-0.5">{t('visual_editor')}</p>
                           <p className="text-[10px] text-indigo-600 leading-tight">
                              {t('visual_editor_desc')}
                           </p>
                        </div>
                     </div>
                     
                     <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 mt-0.5">
                           <Plus className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[11px] font-bold text-indigo-800 uppercase mb-0.5">{t('add_points')}</p>
                           <p className="text-[10px] text-indigo-600 leading-tight">
                              {t('add_points_desc')}
                           </p>
                        </div>
                     </div>

                     <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 mt-0.5">
                           <Trash2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[11px] font-bold text-indigo-800 uppercase mb-0.5">{t('delete_point')}</p>
                           <p className="text-[10px] text-indigo-600 leading-tight">
                              {t('delete_points_desc')}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-100">
         {(activeTab === 'archive' || activeTab === 'users') ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
               {activeTab === 'archive' && (
                 <>
                   <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                      <Archive className="w-10 h-10 text-slate-300" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-600">{t('archive_manager')}</h2>
                   <p className="text-sm text-slate-500 mt-2 max-w-md text-center">
                      {t('manage_archive_desc')}
                   </p>
                 </>
               )}
               {activeTab === 'users' && (
                 <>
                   <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                      <Users className="w-10 h-10 text-slate-300" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-600">{t('access_control')}</h2>
                   <p className="text-sm text-slate-500 mt-2 max-w-md text-center">
                      {t('access_control_desc')}
                   </p>
                 </>
               )}
            </div>
         ) : (
            <>
               <div ref={mapContainerRef} className="w-full h-full outline-none" />
               {/* Overlay Info */}
               <div className="absolute top-6 right-6 z-[400] glass px-5 py-2.5 rounded-full shadow-lg border border-white/60 text-xs font-medium text-slate-500 flex items-center gap-2">
                  {t('edit_mode')}: <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{activeTab === 'points' ? t('tab_points') : t('tab_regions')}</span>
               </div>
            </>
         )}
      </div>
    </div>
  );
};

export default AdminPage;
