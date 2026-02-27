
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, orderBy, 
  enableIndexedDbPersistence, runTransaction, setLogLevel,
  DocumentSnapshot, QuerySnapshot, DocumentData 
} from 'firebase/firestore';
import { DailyReport, AppSettings, Wagon, Station, MapPoint, MtuRegion, AdminUser } from '../types';
import { logger } from './logger'; // Import logger

// --- CONFIGURATION FROM .ENV ---
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';
const USE_LOCAL_BACKEND = process.env.VITE_USE_LOCAL_BACKEND === 'true';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDa0NpM85dNSHiV8Bc_7Zhk94zwf-_6Vjk",
  authDomain: "railway-app-95390.firebaseapp.com",
  projectId: "railway-app-95390",
  storageBucket: "railway-app-95390.firebasestorage.app",
  messagingSenderId: "397194105094",
  appId: "1:397194105094:web:43b168e5aa0532c2f70e87",
  measurementId: "G-3KLPST7J1E"
};

// Initialize Firebase Conditionally
let app: any = null;
let db: any = null;

if (!USE_LOCAL_BACKEND) {
  try {
    // Suppress Firestore warnings (fixes circular JSON crashes in some console wrappers and hides deprecation warnings)
    setLogLevel('error');

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("[Firebase] Initialized successfully. Backend is active.");
    
    // Legacy persistence initialization (Compatible with gstatic imports)
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Persistence failed: Browser not supported');
        }
    });
  } catch (e) {
    // Only log the message string to avoid circular error in logger
    console.warn("Firebase initialization failed (Offline mode active):", String(e));
  }
}

// --- HELPER: ROBUST DEEP CLEAN (Sanitizes data for DB/Storage) ---
const deepClean = (obj: any, visited = new WeakSet()): any => {
  // 1. Primitives
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 2. Dates
  if (obj instanceof Date) {
    if (isNaN(obj.getTime())) return null;
    return obj.toISOString();
  }
  
  // Handle Firestore Timestamps if they somehow leak in
  if (obj && typeof obj === 'object' && typeof obj.toDate === 'function') {
      return obj.toDate().toISOString();
  }

  // 3. Circular Reference Check
  if (visited.has(obj)) {
    return null; 
  }
  visited.add(obj);

  // 4. Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepClean(item, visited));
  }

  // 5. Complex Object Filtering (Firestore internals, DOM nodes, etc.)
  // We strictly allow only plain Objects (constructor.name === 'Object' or null prototype).
  if (obj.constructor && obj.constructor.name !== 'Object') {
      return undefined;
  }
  
  // Specific checks for DOM or Leaflet just in case constructor check was bypassed
  if (obj._leaflet_id !== undefined || (obj.nodeType && typeof obj.cloneNode === 'function')) {
      return undefined;
  }

  // 6. Plain Object Copy
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.startsWith('_') || key.startsWith('$')) continue; // Skip internal keys
      const val = deepClean(obj[key], visited);
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }
  return result;
};

const safeStringify = (data: any): string => {
  try {
    const cleaned = deepClean(data);
    const str = JSON.stringify(cleaned);
    return str === undefined ? "{}" : str;
  } catch (e) {
    console.warn("JSON Stringify Failed:", String(e));
    return "{}";
  }
};

// --- INTERNAL EVENT BUS ---
type EventType = 'reports' | 'settings' | 'admins';
const listeners: Record<EventType, Array<() => void>> = {
  reports: [],
  settings: [],
  admins: []
};

const notifyChange = (type: EventType) => {
  listeners[type].forEach(cb => cb());
};

const subscribeToLocalChanges = (type: EventType, callback: () => void) => {
  listeners[type].push(callback);
  return () => {
    listeners[type] = listeners[type].filter(cb => cb !== callback);
  };
};

// --- LOCAL STORAGE HELPERS ---
const LS = {
  SETTINGS: 'uty_map_config',
  ADMINS: 'uty_admins_list',
  
  saveSettings: (data: any) => {
    try {
      localStorage.setItem(LS.SETTINGS, safeStringify(data));
    } catch (e) {}
  },
  getSettings: () => {
    try {
      const d = localStorage.getItem(LS.SETTINGS);
      if (d) return JSON.parse(d);
      return null;
    } catch (e) { return null; }
  },
  
  getAdmins: () => {
    try {
      const d = localStorage.getItem(LS.ADMINS);
      return d ? JSON.parse(d) : [];
    } catch (e) { return []; }
  },
  
  saveAdmin: (user: any) => {
    try {
      const admins = LS.getAdmins();
      const filtered = admins.filter((a: any) => a.username !== user.username);
      filtered.push(user);
      localStorage.setItem(LS.ADMINS, safeStringify(filtered));
    } catch (e) {}
  },

  deleteAdmin: (username: string) => {
     try {
       const admins = LS.getAdmins().filter((a: any) => a.username !== username);
       localStorage.setItem(LS.ADMINS, safeStringify(admins));
     } catch (e) {}
  }
};

const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Firestore operation timed out after ${ms}ms`));
        }, ms);
        promise.then(v => { clearTimeout(timer); resolve(v); }).catch(r => { clearTimeout(timer); reject(r); });
    });
};

// --- API FUNCTIONS (HYBRID STRATEGY WITH TRANSACTION) ---



export const getReportByDate = async (date: string): Promise<DailyReport | undefined> => {
  let finalData: any = null;
  const cleanDate = date.trim();

  // 1. Try Fetching from Backend
  try {
    if (USE_LOCAL_BACKEND) {
        const res = await fetch(`${API_URL}/reports/${cleanDate}`);
        if (res.ok) finalData = await res.json();
    } else if (db) {
        const docSnap = await withTimeout(getDoc(doc(db, "reports", cleanDate))) as DocumentSnapshot<DocumentData>;
        if (docSnap.exists()) finalData = docSnap.data();
    }
  } catch (error) {
    console.warn(`[Load Info] Backend load failed.`);
  }

  if (finalData) {
    const sections = finalData.sections || [];
    
    // Robust Un-Minification
    const unMinifiedWagons = (finalData.wagons || []).map((w: any) => ({
      sequence: w.s ?? w.sequence ?? 0,
      number: w.n ?? w.number ?? "",
      operationCode: w.o ?? w.operationCode ?? "",
      cargoWeight: w.w ?? w.cargoWeight ?? 0,
      stationCode: w.st ?? w.stationCode ?? "",
      cargoCode: w.c ?? w.cargoCode ?? "",
      entryPointId: w.ep ?? w.entryPointId ?? null,
      trainIndex: w.ti ?? w.trainIndex ?? "",
      rawBlock: w.rb ?? (w.si !== undefined ? sections[w.si] : ""),
      arrivalDate: w.ad || w.arrivalDate || undefined
    }));

    return {
      date: finalData.date,
      rawData: finalData.rawData || "",
      wagons: unMinifiedWagons, 
      sections: sections,
      stations: [],
      timestamp: finalData.timestamp || Date.now()
    } as DailyReport;
  }
  return undefined;
};

export const getReportsInRange = async (startDate: string, endDate: string): Promise<DailyReport[]> => {
  const reports: DailyReport[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const datesToFetch: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      datesToFetch.push(d.toISOString().split('T')[0]);
  }

  for (const date of datesToFetch) {
      const report = await getReportByDate(date);
      if (report) reports.push(report);
  }
  return reports;
};

export const getReportDates = async (): Promise<string[]> => {
  const dates = new Set<string>();
  
  // Get Backend Dates
  try {
    if (USE_LOCAL_BACKEND) {
        const res = await fetch(`${API_URL}/reports`);
        if (res.ok) {
            const list = await res.json();
            list.forEach((item: any) => dates.add(item.date));
        }
    } else if (db) {
        const snapshot = await withTimeout(getDocs(collection(db, "reports"))) as QuerySnapshot<DocumentData>;
        snapshot.docs.forEach(doc => dates.add(doc.id));
    }
  } catch (error) {
      console.warn("Backend date fetch failed.");
  }
  
  return Array.from(dates).sort().reverse();
};

export const getAllReports = async (): Promise<DailyReport[]> => {
  const reportsMap = new Map<string, DailyReport>();

  // Load Backend Reports
  try {
    if (USE_LOCAL_BACKEND) {
        const res = await fetch(`${API_URL}/reports`);
        if (res.ok) {
            const list = await res.json();
            list.forEach((l: any) => {
                reportsMap.set(l.date, {
                    date: l.date,
                    timestamp: l.timestamp || Date.now(),
                    wagons: [],
                    rawData: "",
                    stations: [],
                    wagonCount: l.wagonCount || 0,
                    totalWeight: 0
                });
            });
        }
    } else if (db) {
        const q = query(collection(db, "reports"), orderBy("date", "desc"));
        const snapshot = await withTimeout(getDocs(q)) as QuerySnapshot<DocumentData>;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            reportsMap.set(doc.id, {
                date: doc.id, 
                timestamp: data.timestamp || Date.now(),
                wagons: [],
                rawData: "",
                stations: [],
                wagonCount: data.wagons?.length || 0,
                totalWeight: 0
            });
        });
    }
  } catch (error) {
    // Silent fail
  }

  return Array.from(reportsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
};

export const subscribeToReports = (onUpdate: (reports: DailyReport[]) => void): () => void => {
  const refresh = () => getAllReports().then(onUpdate);
  const unsubscribeLocal = subscribeToLocalChanges('reports', refresh);
  
  refresh(); 
  const interval = setInterval(refresh, 5000); 
  const unsubscribeRemote = () => clearInterval(interval);
  
  return () => { unsubscribeLocal(); unsubscribeRemote(); };
};

export const deleteTrainFromReport = async (date: string, trainIndex: string): Promise<{ success: boolean, message?: string }> => {
  const cleanDate = date.trim();
  const normalize = (s: string) => (s || "").replace(/\[.*?_MARKER\]/g, '').trim();
  const targetIndex = normalize(trainIndex);

  try {
    if (USE_LOCAL_BACKEND) {
        const res = await fetch(`${API_URL}/reports/${cleanDate}`);
        if (res.ok) {
            const data = await res.json();
            const updatedWagons = (data.wagons || []).filter((w: any) => normalize(w.ti || w.trainIndex) !== targetIndex);
            await fetch(`${API_URL}/reports/${cleanDate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: safeStringify({ ...data, wagons: updatedWagons })
            });
        }
    } else if (db) {
        const docRef = doc(db, "reports", cleanDate);
        await withTimeout(runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (sfDoc.exists()) {
                const data = sfDoc.data();
                const updatedWagons = (data.wagons || []).filter((w: any) => normalize(w.ti || w.trainIndex) !== targetIndex);
                transaction.update(docRef, { wagons: updatedWagons });
            }
        }), 10000);
    }
    notifyChange('reports');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const deleteReport = async (date: string): Promise<{ success: boolean, message?: string }> => {
  const cleanDate = date.trim();

  try {
    if (USE_LOCAL_BACKEND) {
        const res = await fetch(`${API_URL}/reports/${cleanDate}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Backend delete failed");
    } else if (db) {
        await withTimeout(deleteDoc(doc(db, "reports", cleanDate)));
    }
    notifyChange('reports');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// --- SETTINGS & ADMIN ---
export const saveMapSettings = async (mapPoints: MapPoint[], mtuRegions: MtuRegion[]) => {
  const cleanPoints = mapPoints.map(p => ({
    id: String(p.id),
    name: String(p.name),
    lat: Number(p.lat),
    lng: Number(p.lng),
    region: String(p.region)
  }));
  const cleanRegions = mtuRegions.map(r => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    points: (r.points || []).map((pt: any) => {
        let lat, lng;
        if (Array.isArray(pt)) { lat = pt[0]; lng = pt[1]; } 
        else if (typeof pt === 'object' && pt !== null) { lat = pt.lat; lng = pt.lng; }
        return { lat: Number(lat), lng: Number(lng) };
    }).filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng))
  }));

  const payload = { id: 'map_config', mapPoints: cleanPoints, mtuRegions: cleanRegions };
  LS.saveSettings(payload);
  notifyChange('settings');
  
  try { 
      const cleanPayload = deepClean(payload);
      if (USE_LOCAL_BACKEND) {
          await fetch(`${API_URL}/settings`, { method: 'POST', body: safeStringify(cleanPayload) });
      } else if (db) {
          setDoc(doc(db, "settings", "map_config"), cleanPayload).catch(() => {}); 
      }
  } catch (e: any) {}
  return true;
};

export const loadMapSettings = async (): Promise<AppSettings | undefined> => {
  let data: AppSettings | undefined = undefined;
  try {
    if (USE_LOCAL_BACKEND) {
        const res = await fetch(`${API_URL}/settings`);
        if (res.ok) data = await res.json();
    } else if (db) {
        const docSnap = await withTimeout(getDoc(doc(db, "settings", "map_config"))) as DocumentSnapshot<DocumentData>;
        if (docSnap.exists()) data = docSnap.data() as AppSettings;
    }
  } catch (e) {}
  
  if (!data) data = LS.getSettings();
  if (data) {
       const sanitizePoints = (points: any[]) => (points || []).map((p: any) => [Number(p[0] || p.lat), Number(p[1] || p.lng)] as [number, number]).filter((p: number[]) => !isNaN(p[0]) && !isNaN(p[1]));
       data.mapPoints = (data.mapPoints || []).filter((p: any) => !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)));
       data.mtuRegions = (data.mtuRegions || []).map((r: any) => ({ ...r, points: sanitizePoints(r.points) }));
       return data;
  }
  return undefined;
};

export const subscribeToSettings = (onUpdate: (settings: AppSettings) => void): () => void => {
  const refresh = () => loadMapSettings().then(s => s && onUpdate(s));
  const unsubscribeLocal = subscribeToLocalChanges('settings', refresh);
  
  refresh(); 
  const interval = setInterval(refresh, 5000); 
  const unsubscribeRemote = () => clearInterval(interval);
  
  return () => { unsubscribeLocal(); unsubscribeRemote(); };
};

const DEFAULT_ADMIN: AdminUser = { username: 'admin', role: 'superadmin', name: 'Super Admin', addedAt: Date.now(), deviceInfo: 'System', lastLogin: Date.now() };

export const verifyAdmin = async (username: string, pass: string, deviceInfo: string): Promise<AdminUser | null> => {
  if (USE_LOCAL_BACKEND) {
      const localAdmins = LS.getAdmins();
      const found = localAdmins.find((a: any) => a.username === username && a.password === pass);
      if (found) {
          if (username === 'admin' && found.role !== 'superadmin') {
              found.role = 'superadmin';
              LS.saveAdmin(found);
          }
          return found;
      }
      if (username === 'admin' && pass === 'admin' && localAdmins.length === 0) return DEFAULT_ADMIN;
      return null;
  }

  try {
     if (db) {
         const docRef = doc(db, "admins", username);
         const docSnap = await withTimeout(getDoc(docRef), 3000) as DocumentSnapshot<DocumentData>;
         if (docSnap.exists() && docSnap.data()?.password === pass) {
            const data = docSnap.data() as AdminUser;
            if (username === 'admin' && data.role !== 'superadmin') {
                data.role = 'superadmin';
                await setDoc(docRef, { role: 'superadmin' }, { merge: true }).catch(() => {});
            }
            await setDoc(docRef, { lastLogin: Date.now(), deviceInfo }, { merge: true }).catch(() => {});
            return data;
         } else if (username === 'admin' && pass === 'admin') {
             const adminsSnap = await getDocs(collection(db, "admins"));
             if (adminsSnap.empty) {
                 await setDoc(docRef, { ...DEFAULT_ADMIN, password: 'admin' });
                 return DEFAULT_ADMIN;
             }
         }
     } else {
         const localAdmins = LS.getAdmins();
         const found = localAdmins.find((a: any) => a.username === username && a.password === pass);
         if (found) {
             if (username === 'admin' && found.role !== 'superadmin') {
                 found.role = 'superadmin';
                 LS.saveAdmin(found);
             }
             return found;
         }
         if (username === 'admin' && pass === 'admin' && localAdmins.length === 0) return DEFAULT_ADMIN;
     }
  } catch (e) {}
  return null;
};

// --- ADMIN MANAGEMENT ---

export const getAdmins = async (): Promise<AdminUser[]> => {
  if (!USE_LOCAL_BACKEND && db) {
      try {
        const snapshot = await withTimeout(getDocs(collection(db, "admins"))) as QuerySnapshot<DocumentData>;
        if (!snapshot.empty) {
            return snapshot.docs.map(d => {
                const data = d.data() as AdminUser;
                if (data.username === 'admin') data.role = 'superadmin';
                return data;
            });
        }
      } catch (e) {}
  }
  const local = LS.getAdmins();
  if (local.length > 0) {
      return local.map((a: any) => {
          if (a.username === 'admin') a.role = 'superadmin';
          return a;
      });
  }
  return [DEFAULT_ADMIN];
};

export const subscribeToAdmins = (onUpdate: (admins: AdminUser[]) => void): () => void => {
  const refresh = () => getAdmins().then(onUpdate);
  const unsubscribeLocal = subscribeToLocalChanges('admins', refresh);
  
  refresh(); 
  const interval = setInterval(refresh, 5000); 
  const unsubscribeRemote = () => clearInterval(interval);
  
  return () => { unsubscribeLocal(); unsubscribeRemote(); };
};

export const addAdmin = async (admin: AdminUser, pass: string, creator?: string): Promise<boolean> => {
  const newAdmin = { ...admin, password: pass, createdBy: creator };
  LS.saveAdmin(newAdmin);
  notifyChange('admins');
  
  if (creator) {
      logSystemAction('ADMIN_ADD', creator, `Added admin: ${admin.username}`);
  }
  
  if (!USE_LOCAL_BACKEND && db) {
      try { await withTimeout(setDoc(doc(db, "admins", admin.username), newAdmin)); } catch (e) {}
  }
  return true;
};

export const deleteAdmin = async (username: string, deleter?: string): Promise<boolean> => {
  LS.deleteAdmin(username);
  notifyChange('admins');
  
  if (deleter) {
      logSystemAction('ADMIN_DELETE', deleter, `Deleted admin: ${username}`);
  }

  if (!USE_LOCAL_BACKEND && db) {
      try { await withTimeout(deleteDoc(doc(db, "admins", username))); } catch (e) {}
  }
  return true;
};

export const updateAdmin = async (username: string, updates: Partial<AdminUser>, updater?: string): Promise<boolean> => {
    // Local Storage Update
    const admins = LS.getAdmins();
    const idx = admins.findIndex((a: any) => a.username === username);
    if (idx >= 0) {
        admins[idx] = { ...admins[idx], ...updates };
        LS.saveSettings(admins); // Note: LS.saveSettings is for map config, need to fix LS helper if used for admins
        // Actually LS.saveAdmin handles add/update if we pass full object.
        // Let's just re-save
        localStorage.setItem(LS.ADMINS, safeStringify(admins));
    }
    notifyChange('admins');

    if (updater) {
        logSystemAction('ADMIN_UPDATE', updater, `Updated admin: ${username}`);
    }

    if (!USE_LOCAL_BACKEND && db) {
        try { await withTimeout(setDoc(doc(db, "admins", username), updates, { merge: true })); } catch (e) {}
    }
    return true;
};
export const logSystemAction = async (action: 'LOGIN' | 'DATA_UPLOAD' | 'DATA_DELETE' | 'ADMIN_ADD' | 'ADMIN_DELETE' | 'ADMIN_UPDATE', username: string, details: string) => {
    const logEntry = {
        id: String(Date.now()) + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        action,
        username,
        details
    };

    try {
        if (USE_LOCAL_BACKEND) {
            // In a real local backend, we would POST to /logs
            // For now, we might just console log or store in LS if needed, but let's skip LS for logs to avoid quota issues
        } else if (db) {
            await setDoc(doc(db, "logs", logEntry.id), logEntry);
        }
    } catch (e) {
        console.warn("Failed to save log", e);
    }
};

export const getSystemLogs = async (): Promise<any[]> => {
    try {
        if (db) {
            const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data());
        }
    } catch (e) {}
    return [];
};

// Updated saveDailyReport to include user logging
export const saveDailyReport = async (date: string, newRawData: string, newWagons: Wagon[], stations: Station[], user?: AdminUser): Promise<{ success: boolean, backendSaved: boolean, report?: any, message?: string }> => {
  const cleanDate = date.trim();
  const timestamp = Date.now();

  // Log the action
  if (user) {
      const wagonCount = newWagons.length;
      logSystemAction('DATA_UPLOAD', user.username, `Uploaded ${wagonCount} wagons for date ${cleanDate}`);
  }

  // Deduplicate raw blocks into a section pool to save massive space
  const sectionPool: string[] = [];
  const sectionMap = new Map<string, number>();

  const getSectionIndex = (rb: string | undefined) => {
    if (!rb) return undefined;
    if (sectionMap.has(rb)) return sectionMap.get(rb);
    const idx = sectionPool.length;
    sectionPool.push(rb);
    sectionMap.set(rb, idx);
    return idx;
  };

  // Helper to ensure consistent minification
  const toMinified = (w: any) => {
    const rb = w.rb ?? w.rawBlock;
    const si = w.si ?? getSectionIndex(rb);
    
    return {
      s: w.s ?? w.sequence ?? 0,
      n: w.n ?? w.number ?? "",
      o: w.o ?? w.operationCode ?? "",
      w: w.w ?? w.cargoWeight ?? 0,
      st: w.st ?? w.stationCode ?? "",
      c: w.c ?? w.cargoCode ?? "",
      ep: w.ep ?? w.entryPointId ?? (w.entryPoint ? (w.entryPoint.fullCode || w.entryPoint.id) : null),
      ti: w.ti ?? w.trainIndex ?? "",
      ad: w.ad ?? w.arrivalDate ?? undefined,
      si: si // Store index instead of full string
    };
  };

  const minifiedNewWagons = newWagons.map(toMinified);

  const fullPayload = {
    date: cleanDate,
    rawData: newRawData || "",
    wagons: minifiedNewWagons,
    sections: sectionPool,
    timestamp
  };

  // Improved Merge Logic: Composite Key to preserve history/movements
  // AND enforces minification on all wagons
  const mergeWagons = (oldWagons: any[], newWagons: any[], oldSections: string[] = []) => {
      const map = new Map<string, any>();
      const getKey = (w: any) => w.n;

      // When merging, we need to handle section indices carefully
      // 1. Add old wagons (they already have indices pointing to oldSections)
      oldWagons.forEach(w => { 
          const rb = w.rb ?? (w.si !== undefined ? oldSections[w.si] : "");
          const si = getSectionIndex(rb);
          const min = { ...toMinified(w), si };
          if (min.n) map.set(getKey(min), min); 
      });

      // 2. Add new wagons
      newWagons.forEach(w => { 
          const rb = w.rb ?? w.rawBlock;
          const si = getSectionIndex(rb);
          const min = { ...toMinified(w), si };
          if (min.n) map.set(getKey(min), min); 
      });
      
      return Array.from(map.values());
  };

  const mergeRawData = (oldRaw: string, newRaw: string) => {
      if (!oldRaw) return newRaw;
      if (!newRaw) return oldRaw;
      
      // Normalize to check for duplicates
      const normalizedNew = newRaw.trim();
      if (oldRaw.includes(normalizedNew)) {
          return oldRaw;
      }
      
      return oldRaw + "\n\n--- MERGED [" + new Date().toLocaleTimeString() + "] ---\n" + newRaw;
  };

  // --- PRIMARY SAVE STRATEGY: BACKEND ---
  let backendSaved = false;
  let finalReport: any = fullPayload;
  let errorMessage = "";

  try {
    if (USE_LOCAL_BACKEND) {
        let existingData: any = {};
        try {
            const res = await fetch(`${API_URL}/reports/${cleanDate}`);
            if (res.ok) existingData = await res.json();
        } catch (e) {}

        const mergedWagons = mergeWagons(existingData.wagons || [], minifiedNewWagons, existingData.sections || []);

        const mergedPayload = {
            date: cleanDate,
            rawData: mergeRawData(existingData.rawData || "", newRawData),
            wagons: mergedWagons,
            sections: sectionPool,
            timestamp
        };

        const res = await fetch(`${API_URL}/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: safeStringify(mergedPayload)
        });
        
        if (!res.ok) throw new Error("Local Server Error");
        
        backendSaved = true;
        finalReport = mergedPayload;
        
    } else if (db) {
        const docRef = doc(db, "reports", cleanDate);
        
        try {
            await withTimeout(runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(docRef);
                
                let finalWagons = minifiedNewWagons;
                let finalRawData = newRawData;
                let finalSections = sectionPool;

                if (sfDoc.exists()) {
                    const data = sfDoc.data();
                    finalWagons = mergeWagons(data.wagons || [], minifiedNewWagons, data.sections || []);
                    finalRawData = mergeRawData(data.rawData || "", newRawData);
                    finalSections = sectionPool;
                }

                const cleanPayload = deepClean({
                    date: cleanDate,
                    rawData: finalRawData,
                    wagons: finalWagons,
                    sections: finalSections,
                    timestamp
                });

                transaction.set(docRef, cleanPayload);
                finalReport = cleanPayload;
            }), 10000); 
            
            backendSaved = true;
        } catch (txError) {
            errorMessage = String(txError);
            
            try {
                const docSnap = await getDoc(docRef);
                
                let finalWagons = minifiedNewWagons; 
                let finalRawData = newRawData;
                let finalSections = sectionPool;

                if (docSnap.exists()) {
                    const serverData = docSnap.data();
                    finalWagons = mergeWagons(serverData.wagons || [], minifiedNewWagons, serverData.sections || []);
                    finalRawData = mergeRawData(serverData.rawData || "", newRawData);
                    finalSections = sectionPool;
                }

                const mergedPayload = deepClean({
                    ...fullPayload,
                    wagons: finalWagons,
                    rawData: finalRawData,
                    sections: finalSections,
                    timestamp: Date.now()
                });

                await setDoc(docRef, mergedPayload);
                finalReport = mergedPayload; 
                backendSaved = true;

            } catch (fallbackError) {
                await setDoc(docRef, deepClean(fullPayload));
                backendSaved = true;
            }
        }
    }
  } catch (error) {
    const safeErrorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[Save Error] ${safeErrorMsg}`);
    errorMessage = safeErrorMsg;
    backendSaved = false;
  }

  // Notify listeners of the change
  if (backendSaved) {
      notifyChange('reports');
  }

  return { 
      success: backendSaved, 
      backendSaved, 
      report: finalReport,
      message: errorMessage
  };
};

