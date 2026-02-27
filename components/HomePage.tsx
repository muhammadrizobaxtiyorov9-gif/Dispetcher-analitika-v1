
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wagon, MapPoint, MtuRegion, Language } from '../types';
import { normalizeMgspName } from '../utils/stationUtils';
import { Train, ArrowDownRight, ArrowUpRight, Activity, X, Map as MapIcon, Layers, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { getCargoNameTranslated } from '../utils/translations';

// Declare Leaflet globally since we loaded it via script tag
declare const L: any;

interface Props {
  wagons: Wagon[];
  mapPoints: MapPoint[];
  mtuRegions: MtuRegion[];
  lang: Language;
  t: (key: string) => string;
}

const CHART_COLORS = ['#3b82f6', '#f59e0b']; // Blue (Import), Amber (Transit)
const CARGO_COLORS = ['#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const HomePage: React.FC<Props> = ({ wagons, mapPoints, mtuRegions, lang, t }) => {
  const [time, setTime] = useState(new Date());
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(true); 
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [41.5, 64.5], 
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
      className: 'map-tiles'
    }).addTo(map);

    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a>',
      opacity: 0.9
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.fitBounds([
      [37.1, 56.0], 
      [45.0, 73.1]
    ]);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Draw Regions (Polygons)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    polygonsRef.current.forEach(p => p.remove());
    polygonsRef.current = [];

    const regionTerm = lang === 'ru' ? 'РЖУ' : 'MTU';

    mtuRegions.forEach(region => {
      const validPoints = (region.points || []).filter(p => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]));
      
      if (validPoints.length < 3) return;

      const polygon = L.polygon(validPoints, {
        color: region.color,
        fillColor: region.color,
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '4, 8', 
        lineCap: 'round'
      }).addTo(mapInstanceRef.current);
      
      const displayName = region.name.replace('MTУ', regionTerm);

      polygon.bindTooltip(displayName, {
        permanent: true,
        direction: 'center',
        className: 'glass text-[10px] font-bold shadow-sm text-slate-700 px-2 py-0.5 rounded-lg'
      });

      polygonsRef.current.push(polygon);
    });
  }, [mtuRegions, lang]);

  // Add Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    mapPoints.forEach(point => {
      if (isNaN(point.lat) || isNaN(point.lng)) return;

      const isSelected = selectedPoint?.id === point.id;
      
      const iconHtml = `
        <div class="relative flex flex-col items-center justify-end w-10 h-10 group transition-all duration-300 z-50" style="transform-origin: bottom center;">
          ${isSelected ? '<div class="absolute bottom-1 w-12 h-12 bg-blue-500 rounded-full opacity-30 animate-ping"></div>' : ''}
          <div class="relative flex items-center justify-center w-4 h-4 bg-white rounded-full shadow-lg border-[2px] ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-800'} transition-colors z-20">
            <div class="w-1.5 h-1.5 ${isSelected ? 'bg-blue-600' : 'bg-slate-800'} rounded-full"></div>
          </div>
          <div class="w-0.5 h-3 bg-slate-800 ${isSelected ? 'bg-blue-600 h-5' : ''} mt-[-2px] z-10 transition-all duration-300"></div>
          <div class="absolute bottom-full mb-2 px-2.5 py-1 glass rounded-lg shadow-lg border border-white/50 text-[10px] font-extrabold text-slate-800 uppercase tracking-wider whitespace-nowrap opacity-100 transition-all z-30 ${isSelected ? 'scale-110 -translate-y-1' : ''}">
            ${point.name.split(' ')[0]}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-marker-icon',
        html: iconHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      const marker = L.marker([point.lat, point.lng], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .on('click', () => {
          setSelectedPoint(point);
          mapInstanceRef.current.setView([point.lat, point.lng], 9, { animate: true, duration: 0.8 });
        });

      markersRef.current.push(marker);
    });
  }, [selectedPoint, mapPoints]);


  // Stats Logic with Cargo Breakdown
  const pointStats = useMemo(() => {
    if (!selectedPoint) return null;

    const relevantWagons = wagons.filter(w => {
        const mgspName = normalizeMgspName(w.entryPoint, w.trainIndex);
        return mgspName.toUpperCase() === selectedPoint.name.toUpperCase() || 
               selectedPoint.name.toUpperCase().includes(mgspName.toUpperCase()) ||
               mgspName.toUpperCase().includes(selectedPoint.name.toUpperCase());
    });

    const total = relevantWagons.length;
    let importCount = 0;
    let transitCount = 0;
    let weight = 0;
    const cargoMap: Record<string, {count: number, weight: number}> = {};

    relevantWagons.forEach(w => {
      weight += w.cargoWeight;
      const destDor = w.matchedStation?.dor;
      if (destDor === 73 || destDor === 72) {
        importCount++;
      } else {
        transitCount++;
      }

      // Cargo Stats
      const cName = getCargoNameTranslated(w.cargoCode, lang);
      if (!cargoMap[cName]) cargoMap[cName] = { count: 0, weight: 0 };
      cargoMap[cName].count += 1;
      cargoMap[cName].weight += w.cargoWeight;
    });

    // Sort top 5 cargo
    const topCargo = Object.entries(cargoMap)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    return {
      total,
      importCount,
      transitCount,
      weight,
      chartData: [
        { name: t('import'), value: importCount },
        { name: t('transit'), value: transitCount },
      ],
      topCargo
    };
  }, [selectedPoint, wagons, t, lang]);

  const regionTerm = lang === 'ru' ? 'РЖУ' : 'MTU';

  return (
    <div className="relative h-full flex flex-col bg-slate-100 overflow-hidden">
      
      {/* Floating Header */}
      <div className="absolute top-4 left-0 right-0 z-[400] px-4 pointer-events-none flex justify-center">
        <div className="glass px-5 py-2.5 rounded-full shadow-xl shadow-slate-900/5 pointer-events-auto flex items-center gap-5 border border-white/60">
            {/* Logo */}
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1 shadow-lg shadow-blue-500/10">
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
               <div>
                  <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none">{t('app_title')}</h1>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-0.5">{t('map_network')}</p>
               </div>
            </div>
            
            <div className="w-px h-8 bg-slate-200 hidden md:block"></div>

            {/* Time */}
            <div className="hidden md:flex items-center gap-4">
               <div className="text-right">
                  <div className="text-lg font-black text-slate-800 font-mono tracking-tighter leading-none tabular-nums">
                     {time.toLocaleTimeString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wide mt-0.5 text-right">
                     {time.toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
               </div>
               <div className="relative">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
               </div>
            </div>
        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0 z-0 bg-[#eef2f6]">
         <div ref={mapContainerRef} className="w-full h-full outline-none" />
         <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.05)] z-[300]"></div>
         
         {/* MTU Legend */}
         <div className="absolute bottom-8 left-6 z-[400] pointer-events-auto flex flex-col items-start gap-2">
            {isLegendOpen && (
              <div className="glass p-3 rounded-2xl shadow-2xl border border-white/60 w-60 animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div 
                  className="flex items-center justify-between mb-3 border-b border-slate-200/50 pb-2 cursor-pointer group"
                  onClick={() => setIsLegendOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[10px] font-bold uppercase text-slate-600 tracking-widest">{t('nodes_rju')}</span>
                  </div>
                  <div className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                     <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {mtuRegions.map(m => (
                    <div key={m.name} className="flex items-center justify-between p-1.5 hover:bg-white/60 rounded-lg transition-colors cursor-default">
                       <div className="flex items-center gap-2.5">
                         <div className="w-2.5 h-2.5 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: m.color }}></div>
                         <span className="text-[10px] font-bold text-slate-700 leading-tight">{m.name.replace('MTУ', regionTerm).replace(/\(.*\)/, '')}</span>
                       </div>
                       <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{m.name.match(/MTУ-\d/)?.[0].replace('MTУ', regionTerm) || regionTerm}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isLegendOpen && (
              <button 
                onClick={() => setIsLegendOpen(true)}
                className="glass p-3 rounded-full shadow-xl border border-white/60 hover:scale-105 active:scale-95 transition-all group"
                title="Показать легенду"
              >
                 <Layers className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
              </button>
            )}
         </div>
      </div>

      {/* Stats Panel */}
      {selectedPoint && pointStats && (
        <div className="absolute top-24 right-4 lg:top-24 lg:right-8 z-[500] w-96 glass rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] p-6 animate-in slide-in-from-right-10 fade-in duration-500 border border-white/60 backdrop-blur-xl">
           <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-100 shadow-sm">
                    {t('border_point')}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 leading-tight tracking-tight">{selectedPoint.name}</h3>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-500 font-mono">
                  ID: <span className="text-slate-700">{selectedPoint.id}</span>
                </div>
              </div>
              <button onClick={() => setSelectedPoint(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
           </div>

           {/* Total Stats */}
           <div className="mb-6 bg-white/50 p-5 rounded-2xl border border-white/60 shadow-inner">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('total_wagons')}</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{pointStats.total}</span>
                 <span className="text-sm font-bold text-slate-400">{t('units')}</span>
              </div>
              <div className="mt-4 w-full bg-slate-200 h-2 rounded-full overflow-hidden flex shadow-inner">
                  <div className="bg-blue-600 h-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${(pointStats.importCount / pointStats.total) * 100}%` }} />
                  <div className="bg-amber-500 h-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${(pointStats.transitCount / pointStats.total) * 100}%` }} />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/60 p-4 rounded-2xl border border-white shadow-sm hover:bg-white transition-colors group">
                 <div className="flex items-center gap-1.5 text-blue-600 mb-2">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{t('import')}</span>
                 </div>
                 <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums group-hover:scale-110 transition-transform origin-left">{pointStats.importCount}</div>
              </div>
              <div className="bg-white/60 p-4 rounded-2xl border border-white shadow-sm hover:bg-white transition-colors group">
                 <div className="flex items-center gap-1.5 text-amber-600 mb-2">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{t('transit')}</span>
                 </div>
                 <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums group-hover:scale-110 transition-transform origin-left">{pointStats.transitCount}</div>
              </div>
           </div>

           {/* Top Cargo List */}
           {pointStats.topCargo.length > 0 && (
             <div className="bg-white/40 rounded-2xl border border-white/60 p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                   <Package className="w-3.5 h-3.5 text-slate-500" />
                   <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">{t('top_cargo')}</h4>
                </div>
                <div className="space-y-2">
                   {pointStats.topCargo.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                         <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: CARGO_COLORS[idx % CARGO_COLORS.length] }}></div>
                            <span className="text-slate-700 font-bold truncate" title={item.name}>{item.name}</span>
                         </div>
                         <div className="flex items-center gap-2 flex-none">
                            <span className="text-slate-900 font-bold">{item.count}</span>
                            <span className="text-[9px] text-slate-400 font-medium">({Math.round(item.weight)}t)</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           )}

           <div className="h-32 w-full relative">
             {pointStats.total > 0 ? (
               <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie data={pointStats.chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4} dataKey="value" stroke="none">
                      {pointStats.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                  </PieChart>
               </ResponsiveContainer>
             ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Activity className="w-5 h-5 mb-1 opacity-50" />
                  Нет данных
               </div>
             )}
           </div>
        </div>
      )}

      {!selectedPoint && (
         <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[400] glass px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce cursor-default border border-white/60">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            <span className="text-sm text-slate-800 font-bold tracking-tight">{t('select_point')}</span>
         </div>
      )}
    </div>
  );
};

export default HomePage;
