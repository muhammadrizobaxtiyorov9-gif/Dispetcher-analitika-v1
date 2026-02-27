
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Station, Wagon, MapPoint, MtuRegion, Language, DateRange, AdminUser } from './types';
import { RAW_STATION_DATA } from './constants';
import { parseStationData, rehydrateWagons, parseOperationalDataGenerator, groupDataByDate, extractReportDate, calculateRailwayDate } from './utils/parser';
import { cleanDataWithAI } from './utils/aiService';
import { saveDailyReport, getReportByDate, getReportsInRange, subscribeToSettings, getReportDates, deleteTrainFromReport, logSystemAction } from './utils/db'; 
import { getTranslation } from './utils/translations';
import Dashboard from './components/Dashboard';
import HomePage from './components/HomePage';
import AdminPage from './components/AdminPage';
import { LoginPage } from './components/LoginPage';
import { AdminPanel } from './components/AdminPanel';
import { FileText, RefreshCw, FileUp, Menu, Train, LayoutDashboard, Sparkles, Wand2, Home, ChevronRight, Settings, Calendar as CalendarIcon, Database, Save, ChevronLeft, ChevronRight as ChevronRightIcon, PanelLeftClose, PanelLeftOpen, ArrowRight, Languages, Eye, X, Copy, AlertCircle, LogOut, Shield } from 'lucide-react';
// @ts-ignore
import mammoth from 'mammoth';
import { logger } from './utils/logger'; // Import Logger

const RAW_OPERATIONAL_DATA = ``;

// Initial Data for Map Points
const INITIAL_MAP_POINTS: MapPoint[] = [
  { id: '69830', name: 'САРЫАГАЧ (Келес)', lat: 41.4420, lng: 69.1680, region: 'Tashkent' }, 
  { id: '72530', name: 'СЫРДАРЬЯ (Малик)', lat: 40.8250, lng: 68.6650, region: 'Syrdarya' }, 
  { id: '72620', name: 'БЕКАБАД', lat: 40.2185, lng: 69.2250, region: 'Tashkent' }, 
  { id: '73990', name: 'ИСТИКЛОЛ', lat: 40.2580, lng: 70.8250, region: 'Fergana' }, 
  { id: '71810', name: 'КИРГИЗИЯ (Кара-Суу)', lat: 40.7100, lng: 72.8000, region: 'Andijan' }, 
  { id: '73080', name: 'ХОДЖИДАВЛЕТ', lat: 39.4250, lng: 63.6700, region: 'Bukhara' }, 
  { id: '75930', name: 'ТАЛИМАРДЖАН', lat: 38.3050, lng: 65.5500, region: 'Kashkadarya' },
  { id: '74990', name: 'РАЗЪЕЗД 161', lat: 38.3050, lng: 65.5500, region: 'Kashkadarya' },
  { id: '73620', name: 'КУДУКЛИ', lat: 37.5650, lng: 67.6350, region: 'Surkhandarya' }, 
  { id: '73650', name: 'АМУЗАНГ', lat: 37.3850, lng: 67.2950, region: 'Surkhandarya' }, 
  { id: '73640', name: 'ГАЛАБА', lat: 37.2150, lng: 67.4150, region: 'Surkhandarya' }, 
  { id: '73890', name: 'ТАХИАТАШ', lat: 42.3150, lng: 59.5450, region: 'Karakalpakstan' },
  { id: '73690', name: 'КАРАКАЛПАКСТАН', lat: 44.8800, lng: 56.0000, region: 'Karakalpakstan' }, 
];

// Initial Data for MTU Regions
const INITIAL_MTU_REGIONS: MtuRegion[] = [
  {
    id: 'mtu1',
    name: "MTУ-1 (Ташкент)",
    color: "#22c55e",
    points: [[42.0, 69.0], [42.1, 70.5], [41.0, 70.5], [40.0, 69.5], [40.0, 68.5], [40.8, 68.0]]
  },
  {
    id: 'mtu2',
    name: "MTУ-2 (Коканд)",
    color: "#a855f7",
    points: [[41.5, 70.0], [42.0, 72.0], [41.0, 73.5], [40.0, 73.0], [40.0, 70.5], [40.5, 70.5]]
  },
  {
    id: 'mtu3',
    name: "MTУ-3 (Бухара)",
    color: "#eab308",
    points: [[42.5, 62.0], [42.5, 66.0], [41.0, 67.5], [39.0, 67.0], [39.0, 63.0], [40.0, 62.0]]
  },
  {
    id: 'mtu4',
    name: "MTУ-4 (Кунград)",
    color: "#0ea5e9",
    points: [[46.0, 55.5], [46.0, 61.0], [42.0, 62.0], [40.5, 61.0], [41.0, 55.0]]
  },
  {
    id: 'mtu5',
    name: "MTУ-5 (Карши)",
    color: "#f97316",
    points: [[39.5, 65.0], [39.5, 67.5], [38.0, 67.0], [38.0, 64.5]]
  },
  {
    id: 'mtu6',
    name: "MTУ-6 (Термез)",
    color: "#ef4444",
    points: [[38.5, 66.5], [38.5, 68.5], [37.0, 68.5], [37.0, 66.5]]
  }
];

// --- MINI CALENDAR COMPONENT ---
interface MiniCalendarProps {
  dateRange: DateRange;
  onSelectRange: (range: DateRange) => void;
  availableDates: Set<string>;
  lang: Language;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ dateRange, onSelectRange, availableDates, lang }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(dateRange.endDate));
  const [selectionMode, setSelectionMode] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  
  // Custom range temporary state (first click)
  const [customStart, setCustomStart] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMonth(new Date(dateRange.endDate));
    setSelectionMode(dateRange.type as any);
    if (dateRange.type !== 'custom') setCustomStart(null);
  }, [dateRange]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); 
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const handlePrevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthNamesRu = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const monthNamesUz = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
  const monthNames = lang === 'uz' ? monthNamesUz : monthNamesRu;
  
  const weekDaysRu = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const weekDaysUz = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
  const weekDays = lang === 'uz' ? weekDaysUz : weekDaysRu;

  // Helpers for range logic
  const formatDate = (y: number, m: number, d: number) => 
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(d.setDate(monday.getDate() + 6));
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  const getMonthRange = (y: number, m: number) => {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return {
      start: first.toISOString().split('T')[0],
      end: last.toISOString().split('T')[0]
    };
  };

  const handleDayClick = (d: number) => {
    const clickedDate = formatDate(year, month, d);
    let newRange: DateRange;

    if (selectionMode === 'day') {
      newRange = { startDate: clickedDate, endDate: clickedDate, type: 'day' };
      onSelectRange(newRange);
    } 
    else if (selectionMode === 'week') {
      const { start, end } = getWeekRange(new Date(year, month, d));
      newRange = { startDate: start, endDate: end, type: 'week' };
      onSelectRange(newRange);
    } 
    else if (selectionMode === 'month') {
      const { start, end } = getMonthRange(year, month);
      newRange = { startDate: start, endDate: end, type: 'month' };
      onSelectRange(newRange);
    }
    else if (selectionMode === 'custom') {
      if (!customStart) {
        // First click: Start the range
        setCustomStart(clickedDate);
      } else {
        // Second click: End the range
        // Swap if end is before start
        const start = customStart < clickedDate ? customStart : clickedDate;
        const end = customStart < clickedDate ? clickedDate : customStart;
        
        onSelectRange({ startDate: start, endDate: end, type: 'custom' });
        setCustomStart(null); // Reset
      }
    }
  };

  // Helper to check highlight status
  const getDateStatus = (dStr: string) => {
    if (selectionMode === 'custom' && customStart) {
       // We are in the middle of selecting
       if (dStr === customStart) return 'start';
       // We can't easily show hover effect across components without heavy lifting, 
       // so just highlight the start point distinctly.
       return 'none';
    }

    if (dStr === dateRange.startDate && dStr === dateRange.endDate) return 'single';
    if (dStr === dateRange.startDate) return 'start';
    if (dStr === dateRange.endDate) return 'end';
    if (dStr > dateRange.startDate && dStr < dateRange.endDate) return 'middle';
    
    return 'none';
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-full aspect-square"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const status = getDateStatus(dateStr);
      const hasData = availableDates.has(dateStr);
      
      let btnClass = "text-slate-400 hover:bg-slate-700 hover:text-white";
      let bgClass = "rounded-full";

      // Styling based on range status
      if (status === 'single') {
         bgClass = "bg-blue-600 rounded-full shadow-lg shadow-blue-500/30";
         btnClass = "text-white font-bold";
      } else if (status === 'start') {
         bgClass = "bg-blue-600 rounded-l-full rounded-r-none shadow-lg shadow-blue-500/30";
         if (selectionMode === 'custom' && customStart === dateStr) {
            bgClass += " animate-pulse ring-2 ring-white/50"; // Pulse if waiting for second click
         }
         btnClass = "text-white font-bold";
      } else if (status === 'end') {
         bgClass = "bg-blue-600 rounded-r-full rounded-l-none shadow-lg shadow-blue-500/30";
         btnClass = "text-white font-bold";
      } else if (status === 'middle') {
         bgClass = "bg-blue-900/40 rounded-none border-y border-blue-900/50";
         btnClass = "text-blue-200";
      } else if (hasData) {
         // Not selected, but has data
         btnClass = "text-slate-200 font-medium";
      }

      days.push(
        <button 
          key={d} 
          onClick={() => handleDayClick(d)}
          className={`relative w-full aspect-square text-[10px] flex items-center justify-center transition-all duration-200 ${bgClass} ${btnClass}`}
        >
          {d}
          {hasData && status === 'none' && (
            <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="bg-[#0f172a] rounded-2xl p-4 border border-white/5 select-none w-full shadow-2xl">
      {/* Mode Switcher */}
      <div className="flex bg-[#1e293b] p-1 rounded-xl mb-4 border border-white/5">
         {(['day', 'week', 'month', 'custom'] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                 setSelectionMode(m);
                 setCustomStart(null); // Reset custom draft
                 
                 // Auto-select defaults for non-custom modes
                 if (m === 'day') handleDayClick(new Date(dateRange.endDate).getDate());
                 if (m === 'week') {
                    const {start, end} = getWeekRange(new Date(dateRange.endDate));
                    onSelectRange({startDate: start, endDate: end, type: 'week'});
                 }
                 if (m === 'month') {
                    const d = new Date(dateRange.endDate);
                    const {start, end} = getMonthRange(d.getFullYear(), d.getMonth());
                    onSelectRange({startDate: start, endDate: end, type: 'month'});
                 }
              }}
              className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${selectionMode === m ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
               {m === 'day' ? (lang === 'uz' ? 'Kun' : 'День') : 
                m === 'week' ? (lang === 'uz' ? 'Hafta' : 'Нед') : 
                m === 'month' ? (lang === 'uz' ? 'Oy' : 'Мес') :
                (lang === 'uz' ? 'Oraliq' : 'Интер')}
            </button>
         ))}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="text-xs font-bold text-white tracking-wide uppercase">
          {monthNames[month]} {year}
        </div>
        <button onClick={handleNextMonth} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-slate-500 uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 place-items-center">
        {renderDays()}
      </div>
      
      {/* Help Text for Custom Mode */}
      {selectionMode === 'custom' && (
         <div className="mt-3 text-[10px] text-center text-blue-300 bg-blue-900/20 p-2 rounded-lg border border-blue-500/20 animate-in fade-in slide-in-from-top-1">
            {customStart 
               ? (lang === 'uz' ? 'Tugash sanasini tanlang' : 'Выберите дату окончания') 
               : (lang === 'uz' ? 'Boshlanish sanasini tanlang' : 'Выберите дату начала')}
         </div>
      )}
    </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('ru');
  const t = (key: string) => getTranslation(key, lang);

  const staticStations = useMemo(() => parseStationData(RAW_STATION_DATA), []);

  const [stations, setStations] = useState<Station[]>(staticStations);
  const [wagons, setWagons] = useState<Wagon[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('Загрузка...');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'input' | 'admin'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // For Mobile
  const [isCollapsed, setIsCollapsed] = useState(false); // For Desktop (Mini Sidebar)
  const [isDragging, setIsDragging] = useState(false); // For Drag & Drop
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Date State for Archive (Range)
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: todayStr, endDate: todayStr, type: 'day' });
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [isDataFromDb, setIsDataFromDb] = useState(false);

  const [customOpData, setCustomOpData] = useState<string>(RAW_OPERATIONAL_DATA);
  const [viewableRawData, setViewableRawData] = useState<string>("");
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [mapPoints, setMapPoints] = useState<MapPoint[]>(INITIAL_MAP_POINTS);
  const [mtuRegions, setMtuRegions] = useState<MtuRegion[]>(INITIAL_MTU_REGIONS);

  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // --- GLOBAL ERROR HANDLING ---
  useEffect(() => {
    // 1. Unhandled Global Errors (Runtime Exceptions)
    const handleGlobalError = (event: ErrorEvent) => {
      logger.error('Global Error', event.error, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
      // Prevent default console error double-logging if desired, but here we keep it for safety
    };

    // 2. Unhandled Promise Rejections (Async Errors)
    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled Promise Rejection', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, []);

  // 1. Initialize App
  useEffect(() => {
    let unsubscribeSettings: (() => void) | undefined;

    const initApp = async () => {
      try {
        setLoading(true);
        setLoadingStatus(t('loading_settings'));
        
        // Load Settings & Subscribe for Real-time Updates
        unsubscribeSettings = subscribeToSettings((settings) => {
          if (settings) {
            if (settings.mapPoints) setMapPoints(settings.mapPoints);
            if (settings.mtuRegions && settings.mtuRegions.length > 0) setMtuRegions(settings.mtuRegions);
          }
        });

        setLoadingStatus(t('sync_archive'));
        await refreshAvailableDates();
        await loadDataForRange(dateRange);
      } catch (e) {
        logger.error('App Initialization Failed', e);
        setLoadingStatus("Tizimda xatolik yuz berdi");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
        initApp();
    }

    return () => {
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, [currentUser]); // Re-run init when user logs in

  const handleLogin = (user: AdminUser) => {
      setCurrentUser(user);
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (e) {}
      if (user.role === 'user') {
          setActiveTab('input');
      } else {
          setActiveTab('home');
      }
  };

  const handleLogout = () => {
      if (currentUser) {
          logSystemAction('LOGIN', currentUser.username, 'User logged out');
      }
      setCurrentUser(null);
      try {
        localStorage.removeItem('currentUser');
      } catch (e) {}
      setWagons([]);
      setIsDataFromDb(false);
  };

  const refreshAvailableDates = async () => {
    const dates = await getReportDates();
    setAvailableDates(new Set(dates));
  };

  const loadDataForRange = async (range: DateRange) => {
    setLoading(true);
    setLoadingStatus(t('getting_data'));
    try {
      let combinedWagons: Wagon[] = [];
      let combinedRawData = "";
      
      // Fetch reports for range
      const reports = await getReportsInRange(range.startDate, range.endDate);
      
      if (reports.length > 0) {
          // Sort reports by date ascending to ensure latest status overrides previous
          reports.sort((a, b) => a.date.localeCompare(b.date));
          
          // Use a Map to deduplicate wagons by Number, keeping the latest one
          const uniqueWagons = new Map<string, any>();
          
          reports.forEach(r => {
              combinedRawData += `\n--- [${r.date}] ---\n` + (r.rawData || "");
              if (r.wagons) {
                  // Rehydrate each report's wagons using its own sections pool before merging
                  const rehydrated = rehydrateWagons(r.wagons, staticStations, r.sections || []);
                  rehydrated.forEach(w => {
                      // Key by wagon number
                      if (w.number) uniqueWagons.set(w.number, w);
                  });
              }
          });
          
          // Get the rehydrated unique wagons
          combinedWagons = Array.from(uniqueWagons.values());
          
          setStations(staticStations);
          setWagons(combinedWagons);
          setViewableRawData(combinedRawData.trim());
          setIsDataFromDb(true);
      } else {
          setWagons([]);
          setViewableRawData("");
          setIsDataFromDb(false);
      }
    } catch (e) {
      logger.error('Load Data Error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeSelect = async (newRange: DateRange) => {
    setDateRange(newRange);
    await loadDataForRange(newRange);
  };

  const runParserAsync = async (rawData: string): Promise<{ wagons: Wagon[], errors: string[] }> => {
      return new Promise<{ wagons: Wagon[], errors: string[] }>((resolve, reject) => {
          try {
              const generator = parseOperationalDataGenerator(rawData, staticStations, lang);
              let allWagons: Wagon[] = [];
              let allErrors: string[] = [];
              
              const processChunk = () => {
                  try {
                      const start = performance.now();
                      while (performance.now() - start < 12) {
                          const next = generator.next();
                          if (next.done) {
                              resolve({ wagons: allWagons, errors: allErrors });
                              return;
                          }
                          
                          const val = next.value as any;
                          if (val && val.validationError) {
                              allErrors.push(val.validationError);
                          } else if (Array.isArray(val)) {
                              allWagons = allWagons.concat(val);
                          }
                      }
                      setLoadingStatus(`${t('processing')}: ${allWagons.length}...`);
                      setTimeout(processChunk, 0);
                  } catch (genErr) {
                      reject(genErr);
                  }
              };
              processChunk();
          } catch (initErr) {
              reject(initErr);
          }
      });
  };

  const processDataInternal = async (rawData: string, shouldSave: boolean) => {
    setLoading(true);
    setLoadingStatus(t('processing'));
    
    try {
      // 1. Group Raw Data by Date (Split multi-date uploads)
      const groupedData = groupDataByDate(rawData);
      const dates = Object.keys(groupedData).filter(d => d !== 'unknown');
      
      if (dates.length === 0 && !groupedData['unknown']) {
          alert(lang === 'uz' ? "Ma'lumot ichidan sana topilmadi!" : "Дата в данных не найдена!");
          setLoading(false);
          return;
      }

      const allSavedWagons: Wagon[] = [];
      const savedDates: string[] = [];
      const allValidationErrors: string[] = [];
      let finalMergedRawData = "";

      // 2. Iterate and Save Each Date Group
      for (const dateStr of dates) {
          const chunkRawData = groupedData[dateStr];
          setLoadingStatus(`${t('processing')} ${dateStr}...`);
          
          // Parse wagons for this specific date
          const { wagons: parsedWagons, errors: chunkErrors } = await runParserAsync(chunkRawData);
          
          if (chunkErrors.length > 0) {
              allValidationErrors.push(...chunkErrors);
          }
          
          if (shouldSave) {
              setLoadingStatus(`${t('saving')} ${dateStr}...`);
              
              const result = await saveDailyReport(dateStr, chunkRawData, parsedWagons, staticStations, currentUser || undefined);
              
              if (result.success) {
                  savedDates.push(dateStr);
                  
                  if (result.report) {
                      if (result.report.wagons) {
                          const rehydrated = rehydrateWagons(result.report.wagons, staticStations, result.report.sections);
                          allSavedWagons.push(...rehydrated);
                      }
                      if (result.report.rawData) {
                          finalMergedRawData = result.report.rawData;
                      }
                  } else {
                      allSavedWagons.push(...parsedWagons);
                  }
                  
                  if (!result.backendSaved) {
                      console.warn(`Backend save failed for ${dateStr}: ${result.message}`);
                      alert(`${t('save_success')} (Local Only) - Backend Error: ${result.message}`);
                  }
              } else {
                  alert(`Failed to save ${dateStr}: ${result.message}`);
              }
          } else {
              // Just viewing
              allSavedWagons.push(...parsedWagons);
          }
      }

      // Handle 'unknown' date group if exists (only for viewing, or warn)
      if (groupedData['unknown']) {
          const { wagons: unknownWagons, errors: unknownErrors } = await runParserAsync(groupedData['unknown']);
          allSavedWagons.push(...unknownWagons);
          if (unknownErrors.length > 0) allValidationErrors.push(...unknownErrors);
          if (shouldSave) {
              alert(lang === 'uz' ? "Ba'zi ma'lumotlarda sana topilmadi va ular saqlanmadi." : "В некоторых данных не найдена дата, они не были сохранены.");
          }
      }

      // 3. Update UI
      setStations(staticStations);
      setWagons(allSavedWagons); // Show everything we just processed

      if (shouldSave && savedDates.length > 0) {
          // Set range to the latest saved date
          const latestDate = savedDates.sort().reverse()[0];
          setDateRange({ startDate: latestDate, endDate: latestDate, type: 'day' });
          setIsDataFromDb(true);
          
          // Refresh list of dates
          await refreshAvailableDates();
          
          // Update viewable raw data to the final merged state from the server/LS
          if (finalMergedRawData) {
              setViewableRawData(finalMergedRawData);
          } else {
              setViewableRawData(rawData); 
          }
          
          setCustomOpData(''); 
          
          if (allValidationErrors.length > 0) {
              setValidationError(allValidationErrors.join('\n\n'));
          } else {
              alert(`${t('save_success')} (${savedDates.join(', ')})`);
          }
      } else if (allValidationErrors.length > 0) {
          setValidationError(allValidationErrors.join('\n\n'));
      }

    } catch (err: any) {
      logger.error('Process Data Error', err);
      if (err.message && err.message.startsWith('VALIDATION_ERROR:')) {
          setValidationError(err.message.replace('VALIDATION_ERROR:', ''));
      } else {
          alert(t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDataUpdate = async () => {
    if (!customOpData.trim()) return;
    await processDataInternal(customOpData, true);
  };

  const handleViewRawData = () => {
      // Priority 1: If we have merged data from DB, show that
      // Priority 2: If we have input data (unsaved), show that
      
      let dataToShow = viewableRawData;
      
      if (!dataToShow && customOpData.trim()) {
          dataToShow = customOpData;
      }
      
      if (!dataToShow) {
          alert(t('no_data'));
          return;
      }
      
      setViewableRawData(dataToShow);
      setIsRawModalOpen(true);
  };

  const handleDeleteTrain = async (trainIndex: string) => {
     if (!dateRange.endDate) return;
     
     const result = await deleteTrainFromReport(dateRange.endDate, trainIndex);
     if (result.success) {
        // Refresh data
        await loadDataForRange(dateRange);
     } else {
        alert(lang === 'uz' ? "O'chirishda xatolik yuz berdi" : "Ошибка при удалении");
     }
  };

  const handleAiCleanup = async () => {
    if (!customOpData.trim()) return;
    setIsAnalyzing(true);
    try {
      // 1. Try simple heuristic fix first (CP866/Win1251 -> UTF8)
      // Many times "garbage" is just Win1251 bytes read as UTF-8 or similar.
      // Since we don't have raw bytes here (browser already decoded it), 
      // we can try to "reverse" common mojibake patterns using the AI service 
      // OR just send it to AI to "make it readable".
      
      // The user specifically asked for "CP866 (yoki Windows-1251) kodirovkadan UTF-8 ga konvertatsiya".
      // We will use the AI service to do this "smartly".
      
      const cleanedData = await cleanDataWithAI(customOpData);
      setCustomOpData(cleanedData);
    } catch (error) {
      logger.error('AI Service Error', error);
      alert("AI Error: " + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- TRAIN COUNTING LOGIC (SMART DEDUPLICATION) ---
  const trainCount = useMemo(() => {
    if (!customOpData) return 0;
    
    // Set to store unique signatures
    const uniqueTrains = new Set<string>();

    // PRIORITY 1: Train Index Pattern (A+B+C)
    // Matches: "(6980+05+7400)" or "(6980+989+7258)"
    const indexRegex = /\(\s*\d+\s*\+\s*\d+\s*\+\s*\d+\s*\)/g;
    let match;
    let hasIndexes = false;
    
    while ((match = indexRegex.exec(customOpData)) !== null) {
        // Remove spaces to normalize
        uniqueTrains.add(match[0].replace(/\s/g, ''));
        hasIndexes = true;
    }

    // PRIORITY 2: (: ... :) Blocks (Fallback ONLY if no indexes found)
    if (!hasIndexes) {
       const sostavRegex = /\(:/g;
       const sostavMatches = customOpData.match(sostavRegex);
       if (sostavMatches) return sostavMatches.length;
    }

    // Return unique count
    return uniqueTrains.size;

  }, [customOpData]);

  const readFileContent = async (file: File): Promise<string> => {
    try {
        if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
          const arrayBuffer = await file.arrayBuffer();
          try {
            const result = await mammoth.extractRawText({ arrayBuffer });
            if (result.value) return result.value;
          } catch (err) {
            logger.warn("Mammoth failed, trying default buffer", err);
          }
        }
        const buffer = await file.arrayBuffer();
        const decoderUtf8 = new TextDecoder('utf-8');
        const textUtf8 = decoderUtf8.decode(buffer);
        
        // Detection for old encodings (Windows-1251 or IBM866/CP866)
        // Railway data often uses CP866 (DOS) or Win1251.
        const hasGarbagePattern = 
            textUtf8.includes('CÏÏB') || 
            textUtf8.includes('C\u00CF\u00CFB') || 
            textUtf8.includes('ÑÏÏÂ') || 
            textUtf8.includes('CÏÏÂ') ||
            textUtf8.includes('âîãîí'); // Common garbled 'vagon' in Win1251 viewed as UTF8
            
        const hasCyrillic = /[а-яА-ЯёЁ]/.test(textUtf8);
        const hasExtendedAscii = /[\u0080-\u00FF]/.test(textUtf8); 

        if (hasGarbagePattern || (!hasCyrillic && hasExtendedAscii)) {
            try {
                // Try Windows-1251 first as it's most common for "old" desktop apps
                const decoderWin1251 = new TextDecoder('windows-1251');
                const textWin = decoderWin1251.decode(buffer);
                
                if (/[а-яА-ЯёЁ]/.test(textWin)) return textWin;
                
                // Fallback to IBM866 (DOS Cyrillic) - very common in older railway terminals
                const decoderCP866 = new TextDecoder('ibm866');
                return decoderCP866.decode(buffer);
            } catch (e) {
                return textUtf8;
            }
        }
        return textUtf8;
    } catch (e) {
        logger.error('File Read Error', e);
        throw e;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: FileList | null = null;
    
    if ('files' in event.target && event.target.files) {
        files = event.target.files;
    } else if ('dataTransfer' in event && event.dataTransfer.files) {
        files = event.dataTransfer.files;
    }

    if (files && files.length > 0) {
      setLoading(true);
      setLoadingStatus(t('loading') + '...');
      setTimeout(async () => {
        const promises: Promise<string>[] = [];
        for (let i = 0; i < files!.length; i++) {
            promises.push(readFileContent(files![i]));
        }
        try {
            const contents = await Promise.all(promises);
            const fullText = contents.filter(t => t.trim().length > 0).join('\n\n--- FILE SPLIT ---\n\n');
            
            // Append data instead of replacing it
            setCustomOpData(prev => {
                const trimmedPrev = prev.trim();
                if (trimmedPrev.length > 0) {
                    return trimmedPrev + '\n\n--- FILE SPLIT ---\n\n' + fullText;
                }
                return fullText;
            });

            // DO NOT auto-set date here anymore. 
            // We rely on "Save" action to parse and confirm the date strictly.
        } catch (error) {
            logger.error('Upload Process Error', error);
            alert(t('error'));
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }, 50);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileUpload(e);
  };

  const NavItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button 
      onClick={() => { setActiveTab(id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
      title={isCollapsed ? label : ''}
      className={`relative group flex items-center w-full mb-1.5 rounded-xl transition-all duration-300 ease-out ${
        isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
      } ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }`}
    >
      <Icon className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '' : 'mr-3'} ${activeTab === id ? 'scale-100' : 'group-hover:scale-110'}`} />
      {!isCollapsed && (
        <>
          <span className="text-sm font-semibold tracking-wide flex-1 text-left">{label}</span>
          {activeTab === id && <ChevronRight className="w-4 h-4 ml-auto opacity-70" />}
        </>
      )}
      {isCollapsed && activeTab === id && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-r-md"></div>
      )}
    </button>
  );

  if (!currentUser) {
      return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      
      {/* Admin Panel Modal */}
      {isAdminPanelOpen && (
          <AdminPanel currentUser={currentUser} onClose={() => setIsAdminPanelOpen(false)} t={t} />
      )}

      {/* Raw Data Modal */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in zoom-in-95 duration-300 border border-white/20">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                 <div>
                    <h3 className="text-xl font-bold text-slate-900">{t('manual_input')}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-1">{dateRange.endDate}</p>
                 </div>
                 <div className="flex gap-2">
                    <button 
                       onClick={() => navigator.clipboard.writeText(viewableRawData)}
                       className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
                       title="Copy"
                    >
                       <Copy className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsRawModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600">
                       <X className="w-5 h-5" />
                    </button>
                 </div>
              </div>
              <div className="flex-1 overflow-auto bg-[#1e293b] p-4">
                 <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap font-medium leading-relaxed">
                    {viewableRawData}
                 </pre>
              </div>
           </div>
        </div>
      )}

      {/* Validation Error Modal */}
      {validationError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 border border-slate-200">
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6 rotate-3">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">
                    {lang === 'uz' ? "Sostav qabul qilinmagan" : "Состав не принят"}
                 </h3>
                 <div className="max-h-[200px] overflow-y-auto custom-scrollbar px-2 text-left">
                    <p className="text-slate-500 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                       {validationError}
                    </p>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                 <button 
                    onClick={() => setValidationError(null)}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                 >
                    {t('close')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50 print:hidden">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl shadow-xl border border-white/10 active:scale-95 transition-all">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`flex-none h-full bg-[#0B1121] text-white flex flex-col transition-all duration-500 ease-cubic-bezier(0.4, 0, 0.2, 1) shadow-2xl z-40 border-r border-slate-800 fixed inset-y-0 left-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'lg:w-20' : 'lg:w-72 w-72'}`}>
        
        {/* Sidebar Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} h-24 border-b border-slate-800/50 bg-gradient-to-b from-slate-900 to-[#0B1121] flex-none`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-none p-1 shadow-lg shadow-blue-900/20 ring-1 ring-white/5 overflow-hidden bg-white">
                 <img 
                    src="/logo.png" 
                    className="w-full h-full object-contain" 
                    alt="Logo"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-full h-full flex items-center justify-center';
                            fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600 w-5 h-5"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M4 10h16"/><path d="M12 4v16"/><line x1="8" x2="8" y1="2" y2="4"/><line x1="16" x2="16" y1="2" y2="4"/></svg>`;
                            parent.appendChild(fallback);
                        }
                    }}
                 />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight text-white leading-none whitespace-nowrap">{t('app_title')}</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70 whitespace-nowrap">{t('app_subtitle')}</p>
              </div>
            </div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className={`hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}>
             {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* Sidebar Content */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {/* Language Switcher */}
          <div className={`mb-8 ${isCollapsed ? 'flex justify-center' : ''}`}>
             <div className={`bg-slate-900 p-1 rounded-xl flex items-center border border-slate-800 ${isCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
                <button 
                  onClick={() => setLang('ru')} 
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all ${lang === 'ru' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                   <span>RU</span>
                </button>
                <button 
                  onClick={() => setLang('uz')} 
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all ${lang === 'uz' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                   <span>UZ</span>
                </button>
             </div>
          </div>

          <div className="mb-8">
             {!isCollapsed ? (
                <div className="px-1 animate-in fade-in duration-300">
                   <div className="flex items-center justify-between mb-3 px-1">
                       <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                         <CalendarIcon className="w-3.5 h-3.5 text-blue-500" /> {t('archive_date')}
                      </label>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${isDataFromDb ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                         <div className={`w-1.5 h-1.5 rounded-full ${isDataFromDb ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
                         {isDataFromDb ? 'LIVE' : 'EMPTY'}
                      </div>
                   </div>
                   <MiniCalendar dateRange={dateRange} onSelectRange={handleRangeSelect} availableDates={availableDates} lang={lang} />
                </div>
             ) : (
                <div className="flex flex-col items-center gap-2 mb-4 animate-in fade-in duration-300 group relative">
                   <div className={`w-3 h-3 rounded-full border-2 border-[#0B1121] ${isDataFromDb ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-slate-600'}`}></div>
                   <div className="absolute left-full top-0 ml-4 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                      {dateRange.endDate}
                   </div>
                </div>
             )}
          </div>

          <div className={`mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600 ${isCollapsed ? 'text-center opacity-0' : 'opacity-100 transition-opacity'}`}>
             {t('nav_main')}
          </div>
          <NavItem id="home" label={t('nav_home')} icon={Home} />
          <NavItem id="dashboard" label={t('nav_dashboard')} icon={LayoutDashboard} />
          
          <div className={`mt-8 mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600 ${isCollapsed ? 'text-center opacity-0' : 'opacity-100 transition-opacity'}`}>
             {t('nav_data')}
          </div>
          <NavItem id="input" label={t('nav_input')} icon={FileText} />
          
          {currentUser?.role !== 'user' && (
            <>
              <div className={`mt-8 mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600 ${isCollapsed ? 'text-center opacity-0' : 'opacity-100 transition-opacity'}`}>
                 {t('nav_system')}
              </div>
              <NavItem id="admin" label={t('nav_admin')} icon={Settings} />
            </>
          )}
          
          {currentUser?.role === 'superadmin' && (
            <button 
               onClick={() => setIsAdminPanelOpen(true)}
               className={`relative group flex items-center w-full mb-1.5 rounded-xl transition-all duration-300 ease-out ${
                 isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
               } text-slate-400 hover:bg-slate-800/50 hover:text-white`}
               title={isCollapsed ? t('nav_users') : ''}
            >
               <Shield className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '' : 'mr-3'} group-hover:scale-110`} />
               {!isCollapsed && <span className="text-sm font-semibold tracking-wide flex-1 text-left">{t('nav_users')}</span>}
            </button>
          )}

          <button 
             onClick={handleLogout}
             className={`relative group flex items-center w-full mb-1.5 rounded-xl transition-all duration-300 ease-out ${
               isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
             } text-red-400 hover:bg-red-500/10 hover:text-red-300 mt-4`}
             title={isCollapsed ? "Chiqish" : ''}
          >
             <LogOut className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '' : 'mr-3'} group-hover:scale-110`} />
             {!isCollapsed && <span className="text-sm font-semibold tracking-wide flex-1 text-left">Chiqish</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className={`flex-none p-5 bg-[#080c17] border-t border-slate-800 ${isCollapsed ? 'text-center' : ''}`}>
          {isCollapsed ? (
             <div className="flex flex-col gap-2 items-center">
                <div className="text-[10px] font-mono text-slate-400 font-bold">{stations.length}</div>
                <div className="h-0.5 w-6 bg-slate-800 rounded-full"></div>
                <div className="text-[10px] font-mono text-blue-500 font-bold">{wagons.length}</div>
             </div>
          ) : (
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                 <p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">{t('stations')}</p>
                 <p className="text-lg font-mono font-bold text-slate-200 tracking-tight">{stations.length}</p>
               </div>
               <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                 <p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">{t('wagons')}</p>
                 <p className="text-lg font-mono font-bold text-blue-400 tracking-tight">{wagons.length}</p>
               </div>
             </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#F8FAFC] w-full min-w-0">
        
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)]"></div>
              </div>
            </div>
            <p className="mt-6 text-slate-900 font-bold text-sm tracking-wide animate-pulse">{loadingStatus}</p>
          </div>
        )}

        {/* Tab Content */}
        {!loading && (
          <>
            {(activeTab === 'home' || activeTab === 'admin') && (
              <div className="flex-1 overflow-hidden relative h-full w-full">
                {activeTab === 'home' && <HomePage wagons={wagons} mapPoints={mapPoints} mtuRegions={mtuRegions} lang={lang} t={t} />}
                {activeTab === 'admin' && <AdminPage mapPoints={mapPoints} setMapPoints={setMapPoints} mtuRegions={mtuRegions} setMtuRegions={setMtuRegions} lang={lang} t={t} />}
              </div>
            )}
            
            {(activeTab === 'dashboard' || activeTab === 'input') && (
              <div className="flex-1 overflow-auto bg-[#F8FAFC] scroll-smooth relative h-full w-full">
                {activeTab === 'dashboard' && (
                  <div className="p-4 md:p-8 lg:p-10 max-w-[1920px] mx-auto min-h-full">
                    <Dashboard 
                      stations={stations} 
                      wagons={wagons} 
                      trainCount={trainCount} 
                      lang={lang} 
                      t={t} 
                      selectedDate={dateRange.endDate} 
                      onDeleteTrain={handleDeleteTrain}
                    />
                  </div>
                )}
                {activeTab === 'input' && (
                  <div className="p-6 lg:p-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full flex flex-col justify-center">
                    <div className="bg-white rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden w-full relative">
                      {/* Decorative top bar */}
                      <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                      
                      <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                              <Sparkles className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('upload_title')}</h2>
                          </div>
                          <p className="text-slate-500 text-base max-w-2xl leading-relaxed font-medium">
                            {t('selected_date')}: <span className="text-slate-900 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm mx-1">{dateRange.endDate}</span>
                          </p>
                        </div>
                        <div className="hidden lg:flex bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-100 text-blue-700 text-xs font-bold items-center shadow-sm backdrop-blur-sm">
                           <Database className="w-4 h-4 mr-2" /> {t('db_connected')}
                        </div>
                      </div>
                      
                      <div className="p-10 space-y-12">
                        {/* Drag and Drop Area */}
                        <div 
                          className={`group relative border-2 border-dashed rounded-[2rem] p-16 text-center transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50/30 scale-[1.02] shadow-xl shadow-blue-500/10' : 'border-slate-200 bg-slate-50/20 hover:border-blue-500 hover:bg-blue-50/10'}`}
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <div className={`w-24 h-24 bg-white rounded-[1.5rem] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center justify-center mx-auto mb-6 transition-all duration-300 ${isDragging ? 'scale-110 shadow-blue-500/20 -translate-y-2' : 'group-hover:scale-110 group-hover:shadow-blue-500/20 group-hover:-translate-y-2'}`}>
                            <FileUp className={`w-10 h-10 transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
                          </div>
                          <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">{isDragging ? (lang === 'uz' ? 'Fayllarni shu yerga tashlang' : 'Отпустите файлы здесь') : t('drag_files')}</h3>
                          <p className="text-sm text-slate-400 font-medium mb-8">{t('support_files')}</p>
                          <button className={`px-8 py-3 bg-white border rounded-xl text-sm font-bold shadow-sm transition-all ${isDragging ? 'border-blue-200 text-blue-600' : 'border-slate-200 text-slate-700 group-hover:border-blue-200 group-hover:text-blue-600'}`}>
                            {t('choose_files')}
                          </button>
                          <input type="file" multiple ref={fileInputRef} className="hidden" accept=".txt,.log,.csv,.docx,.doc" onChange={handleFileUpload} />
                        </div>

                        {/* Manual Input */}
                        <div className="relative">
                          <div className="flex justify-between items-end mb-4">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('manual_input')}</label>
                            <button onClick={handleAiCleanup} disabled={isAnalyzing} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${isAnalyzing ? 'bg-indigo-50 text-indigo-400 border-indigo-100 cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-indigo-100'}`}>
                               {isAnalyzing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('processing')}...</> : <><Wand2 className="w-3.5 h-3.5" /> {t('ai_cleanup')}</>}
                            </button>
                          </div>
                          <textarea 
                            className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none shadow-inner leading-relaxed" 
                            value={customOpData} 
                            onChange={(e) => setCustomOpData(e.target.value)} 
                            placeholder={t('paste_here')} 
                          />
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-col gap-4">
                           <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100">
                              <button onClick={() => setCustomOpData(RAW_OPERATIONAL_DATA)} className="px-6 py-3 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-sm font-bold transition-all shadow-sm">
                                 {t('reset')}
                              </button>
                              <button onClick={handleDataUpdate} className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5 active:translate-y-0">
                                 <Save className="w-4 h-4" /> {t('process_save')} <ArrowRight className="w-4 h-4 opacity-50" />
                              </button>
                           </div>
                           
                           <div className="flex items-center justify-center pt-2">
                              <button 
                                 onClick={handleViewRawData} 
                                 className="px-8 py-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border border-emerald-100 shadow-sm w-full justify-center"
                              >
                                 <Eye className="w-4 h-4" /> {lang === 'uz' ? "Ma'lumotlarni ko'rish" : "Просмотр данных"}
                              </button>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
