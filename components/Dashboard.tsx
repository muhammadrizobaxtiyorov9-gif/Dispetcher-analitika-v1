import React, { useMemo, useState, useEffect } from 'react';
import { Station, Wagon, RegionName, Language } from '../types';
import { getRegionName, getCargoNameTranslated } from '../utils/translations';
import { normalizeMgspName } from '../utils/stationUtils';
import StatsCard from './StatsCard';
import TransitImportReport from './TransitImportReport';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { TrainFront, MapPin, AlertCircle, Filter, Search, Table2, BarChart3, ChevronDown, Container, ArrowRightLeft, ChevronLeft, ChevronRight, Hash, X, CheckSquare, Square, Weight, FileSpreadsheet, CheckCircle2, Calendar, Clock, FileText, Trash2, Copy } from 'lucide-react';

interface DashboardProps {
  stations: Station[];
  wagons: Wagon[];
  trainCount: number;
  lang: Language;
  t: (key: string) => string;
  selectedDate: string;
  onDeleteTrain?: (trainIndex: string) => void;
}

const ITEMS_PER_PAGE = 100;

// Helper to count wagons and calculate weight per train index
const getTrainStats = (wagons: Wagon[], stations: Station[]) => {
  const stats: Record<string, { count: number, weight: number, mainDestination: string, arrivalDate?: Date }> = {};
  
  // First pass: aggregate counts and weights
  const tempStats: Record<string, { count: number, weight: number, destinations: Record<string, number>, arrivalDate?: Date }> = {};
  
  wagons.forEach(w => {
    const rawIdx = w.trainIndex || "Unknown";
    const idx = rawIdx.replace(/\[.*?_MARKER\]/g, '').trim();
    
    if (!tempStats[idx]) {
      tempStats[idx] = { count: 0, weight: 0, destinations: {}, arrivalDate: undefined };
    }
    tempStats[idx].count += 1;
    tempStats[idx].weight += (w.cargoWeight || 0);
    
    // Ensure arrivalDate is a Date object and handle potential string rehydration
    let wagonDate: Date | undefined = undefined;
    const rawDate = w.arrivalDate || (w as any).ad;
    if (rawDate) {
        wagonDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
        // Check if valid date
        if (isNaN(wagonDate.getTime())) wagonDate = undefined;
    }
    
    // Keep the earliest arrival date found for the train
    if (wagonDate && (!tempStats[idx].arrivalDate || wagonDate < tempStats[idx].arrivalDate)) {
        tempStats[idx].arrivalDate = wagonDate;
    }
    
    const dest = w.matchedStation?.name || w.stationCode || "Unknown";
    tempStats[idx].destinations[dest] = (tempStats[idx].destinations[dest] || 0) + 1;
  });

  // Second pass: determine main destination
  Object.keys(tempStats).forEach(idx => {
    const s = tempStats[idx];
    let mainDest = "Unknown";
    
    // Attempt to extract destination from train index: (xxxx+xxx+DEST)
    // The DEST is the 3rd code in the sequence
    const indexMatch = idx.match(/\(\s*\d+\s*\+\s*\d+\s*\+\s*(\d+)\s*\)/);
    
    if (indexMatch) {
        const destCode = indexMatch[1];
        
        // Look up this code in the stations database
        // Rule: Check first 4 digits of the 6-digit code
        const destPrefix = destCode.substring(0, 4);
        const foundStation = stations.find(st => st.fullCode.startsWith(destPrefix));
        
        if (foundStation) {
            mainDest = foundStation.name;
        } else {
             // Fallback: search in wagons for this train
             const matchingWagon = wagons.find(w => w.stationCode === destCode || w.matchedStation?.fullCode === destCode);
             if (matchingWagon && matchingWagon.matchedStation) {
                 mainDest = matchingWagon.matchedStation.name;
             } else {
                  // Final fallback: just the code
                  mainDest = destCode; 
             }
        }
    } else {
        // Fallback to most frequent destination if index parsing fails
        let maxCount = -1;
        Object.entries(s.destinations).forEach(([dest, count]) => {
          if (count > maxCount) {
            maxCount = count;
            mainDest = dest;
          }
        });
    }
    
    stats[idx] = {
      count: s.count,
      weight: s.weight,
      mainDestination: mainDest,
      arrivalDate: s.arrivalDate
    };
  });

  return stats;
};

const Dashboard: React.FC<DashboardProps> = ({ stations, wagons, trainCount, lang, t, selectedDate, onDeleteTrain }) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'stats' | 'report'>('report');
  
  // Train Selection State
  const [isTrainModalOpen, setIsTrainModalOpen] = useState(false);
  const [selectedTrains, setSelectedTrains] = useState<Set<string>>(new Set());
  const [filterEntryPoint, setFilterEntryPoint] = useState<string>('all');
  const [filterDestination, setFilterDestination] = useState<string>('all');
  
  // Naturka and Delete Modal States
  const [viewNaturkaTrain, setViewNaturkaTrain] = useState<string | null>(null);
  const [deleteConfirmTrain, setDeleteConfirmTrain] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce Search Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredWagons = useMemo(() => {
    return wagons.filter(w => {
      // 1. Train Selection Filter
      if (selectedTrains.size > 0) {
         const normalizedIdx = (w.trainIndex || "").replace(/\[.*?_MARKER\]/g, '').trim();
         if (!normalizedIdx || !selectedTrains.has(normalizedIdx)) {
            return false;
         }
      }

      // 2. Region Filter
      if (selectedRegion !== 'all') {
        if (!w.matchedStation || w.matchedStation.regionName !== selectedRegion) {
          return false;
        }
      }

      // 3. Destination Filter
      if (selectedDestination !== 'all') {
         const dest = w.matchedStation?.name || w.stationCode || "Unknown";
         if (dest !== selectedDestination) return false;
      }

      // 4. Text Search
      if (debouncedSearch) {
        const lowerQ = debouncedSearch.toLowerCase();
        const wagonMatch = w.number.includes(lowerQ);
        const stationMatch = w.matchedStation?.name.toLowerCase().includes(lowerQ) || w.stationCode.includes(lowerQ);
        const cargoName = getCargoNameTranslated(w.cargoCode, lang).toLowerCase();
        const cargoMatch = w.cargoCode?.includes(lowerQ) || cargoName.includes(lowerQ);
        const trainIndexMatch = w.trainIndex?.toLowerCase().includes(lowerQ);
        return wagonMatch || stationMatch || cargoMatch || trainIndexMatch;
      }
      return true;
    });
  }, [wagons, selectedRegion, debouncedSearch, lang, selectedTrains]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredWagons.length / ITEMS_PER_PAGE);
  const paginatedWagons = useMemo(() => {
     const start = (currentPage - 1) * ITEMS_PER_PAGE;
     return filteredWagons.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredWagons, currentPage]);

  const stats = useMemo(() => {
    const total = filteredWagons.length;
    const atBorder = filteredWagons.filter(w => w.matchedStation?.isBorderPoint).length;
    
    const byRegion: Record<string, number> = {};
    Object.values(RegionName).forEach(r => byRegion[r] = 0);
    const byCargo: Record<string, number> = {};

    filteredWagons.forEach(w => {
      if (w.matchedStation) {
        const region = w.matchedStation.regionName;
        byRegion[region] = (byRegion[region] || 0) + 1;
      } else {
        byRegion['Неизвестно'] = (byRegion['Неизвестно'] || 0) + 1;
      }
      const cargoName = getCargoNameTranslated(w.cargoCode, lang);
      byCargo[cargoName] = (byCargo[cargoName] || 0) + 1;
    });

    const regionData = Object.keys(byRegion)
      .filter(k => byRegion[k] > 0)
      .map(k => ({ name: getRegionName(k, lang).split('(')[0].trim(), fullName: getRegionName(k, lang), count: byRegion[k] }));

    const cargoData = Object.keys(byCargo)
      .map(k => ({ name: k, count: byCargo[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Limit to top 10 for performance

    const borderData = [
      { name: t('at_border'), value: atBorder },
      { name: t('internal'), value: total - atBorder },
    ];

    return { total, atBorder, regionData, borderData, cargoData };
  }, [filteredWagons, lang, t]);

  // Train List & Map Logic
  const trainStats = useMemo(() => getTrainStats(wagons, stations), [wagons, stations]);
  const trainList = useMemo(() => {
     return Object.keys(trainStats).sort((a, b) => {
        const dateA = trainStats[a].arrivalDate;
        const dateB = trainStats[b].arrivalDate;
        if (!dateA && !dateB) return a.localeCompare(b);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
     });
  }, [trainStats]);
  
  // 2. Get Unique Entry Points for Dropdown
  const trainEntryMap = useMemo(() => {
    const map: Record<string, string> = {};
    wagons.forEach(w => {
      if (w.trainIndex) {
         const normalizedIdx = w.trainIndex.replace(/\[.*?_MARKER\]/g, '').trim();
         const mgspName = normalizeMgspName(w.entryPoint, w.trainIndex);
         if (mgspName !== "ПРОЧИЕ") {
            map[normalizedIdx] = mgspName;
         } else if (w.entryPoint) {
            const cleanName = w.entryPoint.name.split('(')[0].trim();
            map[normalizedIdx] = cleanName;
         }
      }
    });
    return map;
  }, [wagons]);

  const uniqueEntryPoints = useMemo(() => {
     const set = new Set<string>();
     Object.values(trainEntryMap).forEach((v) => set.add(v as string));
     return Array.from(set).sort();
  }, [trainEntryMap]);

  // 3. Get Unique Destinations for Global Filter
  const allUniqueDestinations = useMemo(() => {
     const set = new Set<string>();
     wagons.forEach(w => {
        const dest = w.matchedStation?.name || w.stationCode || "Unknown";
        set.add(dest);
     });
     return Array.from(set).sort();
  }, [wagons]);

  // 4. Get Unique Destinations for Modal Dropdown
  const uniqueDestinations = useMemo(() => {
     const set = new Set<string>();
     Object.values(trainStats).forEach((s) => set.add(s.mainDestination));
     return Array.from(set).sort();
  }, [trainStats]);

  // 4. Filter the Train List based on dropdown selections
  const visibleTrainList: string[] = useMemo(() => {
     let list = trainList.filter(id => {
        const matchesEntry = filterEntryPoint === 'all' || trainEntryMap[id] === filterEntryPoint;
        const matchesDest = filterDestination === 'all' || trainStats[id].mainDestination === filterDestination;
        return matchesEntry && matchesDest;
     });

     // Sort by arrival date (ascending)
     list.sort((a, b) => {
        const dateA = trainStats[a].arrivalDate?.getTime() || 0;
        const dateB = trainStats[b].arrivalDate?.getTime() || 0;
        return dateA - dateB;
     });

     return list;
  }, [trainList, filterEntryPoint, filterDestination, trainEntryMap, trainStats]);

  const actualTrainCount = trainList.length;

  const toggleTrainSelection = (trainIndex: string) => {
     const next = new Set(selectedTrains);
     if (next.has(trainIndex)) next.delete(trainIndex);
     else next.add(trainIndex);
     setSelectedTrains(next);
  };

  const handleSelectAllVisible = () => {
     const next = new Set(selectedTrains);
     visibleTrainList.forEach(id => next.add(id));
     setSelectedTrains(next);
  };

  const handleDeselectAllVisible = () => {
     const next = new Set(selectedTrains);
     visibleTrainList.forEach(id => next.delete(id));
     setSelectedTrains(next);
  };

  const generateNaturkaText = (trainIndex: string) => {
     // Extract the core index part (A+B+C) for robust matching
     const getCoreIndex = (idx: string) => {
        const m = idx.replace(/\s+/g, '').match(/\(\d+\+\d+\+\d+\)/);
        return m ? m[0] : idx.replace(/\s+/g, '').replace(/\[.*?_MARKER\]/g, '').trim();
     };

     const targetCore = getCoreIndex(trainIndex);

     const trainWagons = wagons.filter(w => {
         const wagonCore = getCoreIndex(w.trainIndex || "");
         return wagonCore === targetCore;
     });
     
     if (trainWagons.length === 0) return t('no_data');

     // Collect unique raw blocks
     const rawBlocks = new Set<string>();
     trainWagons.forEach(w => {
        if (w.rawBlock) {
           const cleanBlock = w.rawBlock.replace(/--- FILE SPLIT ---/g, '').trim();
           if (cleanBlock) rawBlocks.add(cleanBlock);
        }
     });
     
     if (rawBlocks.size > 0) {
        // Join unique blocks.
        return Array.from(rawBlocks).join('\n\n------------------------------------------\n\n');
     }
     
     // Fallback to generated text
     const sortedWagons = [...trainWagons].sort((a, b) => a.sequence - b.sequence);
     let text = `${trainIndex}\n\n`;
     sortedWagons.forEach(w => {
        text += `${String(w.sequence).padStart(2, '0')} ${w.number} ${w.operationCode.padEnd(8)} ${String(w.cargoWeight).padStart(3)} ${w.stationCode} ${w.cargoCode}\n`;
     });
     return text;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
      
      {/* Train Selection Modal */}
      {isTrainModalOpen && (
        <div 
           className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-200"
           onClick={() => setIsTrainModalOpen(false)}
        >
           <div 
             className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-white/20"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('select_trains')}</h3>
                 <button onClick={() => setIsTrainModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-500" />
                 </button>
              </div>
              
              {/* Toolbar: Filter & Actions */}
              <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center sticky top-0 z-10 shadow-sm">
                 <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className="relative flex-1 max-w-[180px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                           className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
                           value={filterEntryPoint}
                           onChange={(e) => setFilterEntryPoint(e.target.value)}
                        >
                           <option value="all">{lang === 'uz' ? 'Barcha Stiklar' : 'Все Стыки'}</option>
                           {uniqueEntryPoints.map(ep => (
                              <option key={ep} value={ep}>{ep}</option>
                           ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative flex-1 max-w-[180px]">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                           className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
                           value={filterDestination}
                           onChange={(e) => setFilterDestination(e.target.value)}
                        >
                           <option value="all">{lang === 'uz' ? 'Barcha Stansiyalar' : 'Все Станции'}</option>
                           {uniqueDestinations.map(dest => (
                              <option key={dest} value={dest}>{dest}</option>
                           ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    
                    <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                       {visibleTrainList.length} {lang === 'uz' ? 'ta poyezd' : 'поездов'}
                    </span>
                 </div>

                 <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSelectAllVisible}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                    >
                       <CheckCircle2 className="w-3.5 h-3.5" />
                       {lang === 'uz' ? 'Hammasini tanlash' : 'Выбрать все'}
                    </button>
                    
                    {selectedTrains.size > 0 && (
                        <button 
                          onClick={() => setSelectedTrains(new Set())}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors"
                        >
                           <X className="w-3.5 h-3.5" />
                           {t('reset_selection')} ({selectedTrains.size})
                        </button>
                    )}
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                 {visibleTrainList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                       <Filter className="w-8 h-8 mb-2 opacity-50" />
                       <p className="text-sm font-medium">No trains found for this filter</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                        {visibleTrainList.map((trainIdx, index) => {
                           const isSelected = selectedTrains.has(trainIdx);
                           const stats = trainStats[trainIdx];
                           const isEmpty = stats.weight === 0;
                           const entryPointName = trainEntryMap[trainIdx];

                           return (
                              <div 
                                 key={trainIdx} 
                                 onClick={() => toggleTrainSelection(trainIdx)}
                                 className={`group flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${isSelected ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'}`}
                              >
                                 {/* Sequence Number */}
                                 <div className={`absolute -right-2 -bottom-4 text-6xl font-black opacity-25 pointer-events-none select-none ${isSelected ? 'text-white' : 'text-slate-900/30'}`}>
                                    {index + 1}
                                 </div>
                                 
                                 <div className={`mt-1 transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-blue-400'}`}>
                                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                 </div>
                                 <div className="min-w-0 flex-1 z-10">
                                    <div className="flex justify-between items-start mb-1">
                                       <div className="flex flex-col">
                                          <div className="flex items-center gap-2 mb-1">
                                             <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                #{index + 1}
                                             </span>
                                             <div className={`text-sm font-bold font-mono truncate ${isSelected ? 'text-white' : 'text-slate-700'}`} title={trainIdx}>
                                                {trainIdx.replace(/\[.*?_MARKER\]/g, '').trim()}
                                             </div>
                                          </div>
                                          <div className={`text-[10px] font-bold mt-0.5 flex items-center gap-1.5 ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                                             <span className={`${isSelected ? 'bg-blue-500/50' : 'bg-slate-100'} px-1.5 py-0.5 rounded flex items-center gap-1`}>
                                                <Calendar className="w-3 h-3" />
                                                {stats.arrivalDate ? stats.arrivalDate.toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU') : '--.--.----'}
                                             </span>
                                             <span className={`${isSelected ? 'bg-blue-500/50' : 'bg-rose-50 text-rose-600'} px-1.5 py-0.5 rounded flex items-center gap-1`}>
                                                <Clock className="w-3 h-3" />
                                                {stats.arrivalDate ? `${String(stats.arrivalDate.getHours()).padStart(2, '0')}:${String(stats.arrivalDate.getMinutes()).padStart(2, '0')}` : '--:--'}
                                             </span>
                                          </div>
                                       </div>
                                       <div className="flex gap-1 flex-col items-end">
                                          {entryPointName && (
                                             <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${isSelected ? 'bg-blue-500 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                                                {entryPointName}
                                             </span>
                                          )}
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${isSelected ? 'bg-blue-400 text-blue-50' : 'bg-blue-50 text-blue-600'}`}>
                                             {stats.mainDestination}
                                          </span>
                                       </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                       <div className="flex items-center gap-2 text-xs font-medium">
                                          <span className={`px-2 py-1 rounded-md ${isSelected ? 'bg-blue-500 text-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                                             {stats.count} {t('wagons_count')}
                                          </span>
                                          <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                                             isSelected 
                                                ? (isEmpty ? 'bg-blue-500 text-blue-100' : 'bg-emerald-500 text-emerald-100')
                                                : (isEmpty ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')
                                          }`}>
                                             {isEmpty ? (
                                                t('empty')
                                             ) : (
                                                <>
                                                   <Weight className="w-3 h-3" />
                                                   {stats.weight.toLocaleString()} t
                                                </>
                                             )}
                                          </span>
                                       </div>
                                       <div className="flex items-center gap-1">
                                          <button 
                                             onClick={(e) => { e.stopPropagation(); setViewNaturkaTrain(trainIdx); }}
                                             className={`p-1.5 rounded-md transition-colors ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600'}`}
                                             title={lang === 'uz' ? "Naturkani ko'rish" : "Просмотр натурки"}
                                          >
                                             <FileText className="w-3.5 h-3.5" />
                                          </button>
                                          {onDeleteTrain && (
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmTrain(trainIdx); }}
                                                className={`p-1.5 rounded-md transition-colors ${isSelected ? 'bg-blue-500 text-white hover:bg-rose-400' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600'}`}
                                                title={t('delete')}
                                             >
                                                <Trash2 className="w-3.5 h-3.5" />
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                    </div>
                 )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-white rounded-b-3xl flex justify-end gap-3">
                 <button 
                    onClick={() => setIsTrainModalOpen(false)}
                    className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                 >
                    {t('cancel')}
                 </button>
                 <button 
                    onClick={() => setIsTrainModalOpen(false)}
                    className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                 >
                    {t('apply')} ({selectedTrains.size})
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Header & Filters */}
      <div className="glass p-5 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sticky top-4 z-30 transition-all border border-white/60 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
             {t('monitoring_title')}
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">{t('monitoring_subtitle')}</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button 
              onClick={() => setViewMode('report')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === 'report' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <Table2 className="w-4 h-4" /> {t('report')}
            </button>
            <button 
              onClick={() => setViewMode('stats')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === 'stats' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <BarChart3 className="w-4 h-4" /> {t('charts')}
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-grow xl:flex-grow-0 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder={t('search_placeholder')} 
              className="pl-11 pr-4 py-3 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-full xl:w-72 transition-all shadow-sm focus:shadow-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Region Filter */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-grow xl:flex-grow-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-slate-400" />
              </div>
              <select 
                className="pl-10 pr-10 py-3 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none w-full xl:w-auto cursor-pointer transition-all shadow-sm"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                <option value="all">{t('all_regions')}</option>
                {Object.values(RegionName).map(r => (
                  <option key={r} value={r}>{getRegionName(r, lang)}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Train Count Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-2 shadow-xl shadow-blue-600/20 text-white relative overflow-hidden group print:hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400 opacity-10 rounded-full blur-3xl"></div>

        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-white/10 backdrop-blur-sm text-white rounded-2xl shadow-inner border border-white/20">
            <TrainFront className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1 opacity-80">{t('processed_trains')}</p>
            <div className="flex items-center gap-4">
               <h3 
                 onClick={() => setIsTrainModalOpen(true)}
                 className="text-5xl font-black tracking-tighter flex items-center gap-3 cursor-pointer hover:text-blue-100 transition-colors underline decoration-2 decoration-white/30 underline-offset-8 decoration-dotted"
                 title={t('select_trains')}
               >
                 {selectedTrains.size > 0 ? selectedTrains.size : actualTrainCount}
                 <span className="text-lg font-bold opacity-60 font-sans tracking-normal no-underline">{t('units')}</span>
               </h3>
               {selectedTrains.size > 0 && (
                  <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm animate-in fade-in zoom-in border border-white/20">
                     Filtered
                  </div>
               )}
            </div>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6 relative z-10 pr-4">
           <div className="text-right">
              <div className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">{t('total_qty')}</div>
              <div className="text-3xl font-black">{filteredWagons.length} <span className="text-lg font-medium opacity-70">{lang === 'uz' ? 'vag.' : 'ваг.'}</span></div>
           </div>
        </div>
      </div>

      {/* VIEW MODES */}
      {viewMode === 'report' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <TransitImportReport wagons={filteredWagons} lang={lang} t={t} selectedDate={selectedDate} />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard 
              title={t('total_wagons')} 
              value={stats.total} 
              icon={<TrainFront className="w-7 h-7" />} 
              color="blue"
            />
            <StatsCard 
              title={t('at_border')} 
              value={stats.atBorder} 
              icon={<AlertCircle className="w-7 h-7" />} 
              color={stats.atBorder > 0 ? "red" : "green"}
              trend={t('attention_needed')}
            />
            <StatsCard 
              title={t('active_regions')} 
              value={stats.regionData.length} 
              icon={<MapPin className="w-7 h-7" />} 
              color="indigo"
            />
          </div>

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart: Regions */}
            <div className="bg-white p-8 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 h-[28rem] flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-6">{t('wagons_by_region')}</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={stats.regionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                      interval={0} 
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                       tick={{fontSize: 11, fill: '#64748b'}} 
                       axisLine={false}
                       tickLine={false}
                    />
                    <RechartsTooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#3b82f6" 
                      radius={[6, 6, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart: Border vs Internal */}
            <div className="bg-white p-8 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 h-[28rem] flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-6">{t('dislocation_status')}</h3>
              <div className="flex-1 min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={stats.borderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.borderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#f43f5e' : '#10b981'} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                   <span className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">{stats.total}</span>
                   <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">{lang === 'uz' ? 'Vagonlar' : 'Вагонов'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Charts Row: Cargo Type */}
          <div className="bg-white p-8 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 h-96 flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Container className="w-5 h-5 text-amber-500" />
              {t('cargo_distribution')}
            </h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={stats.cargoData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    tick={{fontSize: 12, fill: '#475569', fontWeight: 600}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip 
                    cursor={{fill: '#fffbeb'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#f59e0b" 
                    radius={[0, 4, 4, 0]} 
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Table with Pagination */}
          <div className="bg-white rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-lg font-bold text-slate-800">{t('detailed_list')}</h3>
              <span className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold shadow-sm">
                {filteredWagons.length} {t('records')}
              </span>
            </div>
            
            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-left text-sm text-slate-600 border-separate border-spacing-0">
                <thead className="bg-slate-50/50 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-6 py-4 w-16 text-center border-b border-slate-100 first:pl-8">№</th>
                    <th className="px-6 py-4 border-b border-slate-100">{t('wagon_col')}</th>
                    <th className="px-6 py-4 border-b border-slate-100">{t('train_index')}</th>
                    <th className="px-6 py-4 border-b border-slate-100">{t('cargo_col')}</th>
                    <th className="px-6 py-4 border-b border-slate-100">{t('weight_col')}</th>
                    <th className="px-6 py-4 border-b border-slate-100">{t('station_col')}</th>
                    <th className="px-6 py-4 border-b border-slate-100">{t('region_col')}</th>
                    <th className="px-6 py-4 text-center border-b border-slate-100 last:pr-8">{t('status_col')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedWagons.length > 0 ? (
                    paginatedWagons.map((wagon, idx) => (
                      <tr key={`${wagon.number}-${idx}`} className="group hover:bg-slate-50/80 transition-colors duration-200">
                        <td className="px-6 py-4 text-center text-slate-400 font-mono text-xs border-b border-slate-50 first:pl-8">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td className="px-6 py-4 font-mono font-bold text-blue-600 border-b border-slate-50">{wagon.number}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 border-b border-slate-50">{wagon.trainIndex}</td>
                        <td className="px-6 py-4 border-b border-slate-50">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-xs">{getCargoNameTranslated(wagon.cargoCode, lang)}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{wagon.cargoCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50">
                          <div className="inline-flex items-center gap-1.5 font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md text-xs tabular-nums">
                            {wagon.cargoWeight} t
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-800 font-semibold text-xs border-b border-slate-50">
                          <div className="flex flex-col">
                            <span>{wagon.matchedStation ? wagon.matchedStation.name : <span className="text-slate-400">Not Found</span>}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{wagon.stationCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50">
                          {wagon.matchedStation ? (
                            <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-white text-slate-600 border border-slate-200 shadow-sm">
                              {getRegionName(wagon.matchedStation.regionName, lang).split('(')[0]}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center border-b border-slate-50 last:pr-8">
                          {wagon.matchedStation?.isBorderPoint ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 ring-1 ring-rose-100/50">
                              {t('at_border')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 ring-1 ring-emerald-100/50">
                              {t('internal')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <div className="bg-slate-50 p-6 rounded-full mb-4">
                             <Search className="w-10 h-10 text-slate-300" />
                          </div>
                          <p className="text-lg font-semibold text-slate-600">{t('not_found')}</p>
                          <p className="text-sm text-slate-400 mt-1">{t('try_change_search')}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
               <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="text-xs text-slate-500 font-medium">
                     {t('showing')} {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredWagons.length)} {t('of')} {filteredWagons.length}
                  </div>
                  <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                        <ChevronLeft className="w-4 h-4" />
                     </button>
                     <span className="text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                        {currentPage} / {totalPages}
                     </span>
                     <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                        <ChevronRight className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}
      
      {/* Naturka Modal */}
      {viewNaturkaTrain && (
         <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={() => setViewNaturkaTrain(null)}
         >
            <div 
               className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl flex flex-col h-[90vh] animate-in zoom-in-95 duration-300 border border-white/20"
               onClick={(e) => e.stopPropagation()}
            >
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                     <FileText className="w-5 h-5 text-blue-500" />
                     {lang === 'uz' ? "Poyezd naturkasi" : "Натурка поезда"}
                  </h3>
                  <button onClick={() => setViewNaturkaTrain(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                     <X className="w-5 h-5 text-slate-500" />
                  </button>
               </div>
               <div className="p-6 flex-1 overflow-auto bg-[#1e293b] custom-scrollbar">
                  <pre className="font-mono text-xs text-green-400 leading-relaxed whitespace-pre-wrap font-medium">
                     {generateNaturkaText(viewNaturkaTrain)}
                  </pre>
               </div>
               <div className="p-6 border-t border-slate-100 bg-white rounded-b-3xl flex justify-end gap-3">
                  <button 
                     onClick={() => {
                        const text = generateNaturkaText(viewNaturkaTrain);
                        navigator.clipboard.writeText(text);
                        alert(lang === 'uz' ? "Nusxa olindi" : "Скопировано");
                     }}
                     className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                     <Copy className="w-4 h-4" />
                     {lang === 'uz' ? "Nusxa olish" : "Копировать"}
                  </button>
                  <button 
                     onClick={() => setViewNaturkaTrain(null)}
                     className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                  >
                     {t('close')}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTrain && (
         <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={() => setDeleteConfirmTrain(null)}
         >
            <div 
               className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 transform transition-all scale-100"
               onClick={(e) => e.stopPropagation()}
            >
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-rose-100 text-rose-600">
                     <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                     {lang === 'uz' ? "Poyezdni o'chirish" : "Удалить поезд"}
                  </h3>
               </div>
               
               <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  {lang === 'uz' 
                     ? `Siz rostdan ham ${deleteConfirmTrain.replace(/\[.*?_MARKER\]/g, '').trim()} indeksli poyezdni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.` 
                     : `Вы действительно хотите удалить поезд с индексом ${deleteConfirmTrain.replace(/\[.*?_MARKER\]/g, '').trim()}? Это действие нельзя отменить.`}
               </p>

               <div className="flex justify-end gap-3">
                  <button 
                     onClick={() => setDeleteConfirmTrain(null)}
                     className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors"
                  >
                     {t('cancel')}
                  </button>
                  <button 
                     onClick={() => {
                        if (onDeleteTrain) onDeleteTrain(deleteConfirmTrain);
                        setDeleteConfirmTrain(null);
                     }}
                     className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                  >
                     <Trash2 className="w-4 h-4" />
                     {t('delete')}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Dashboard;
