
import React, { useMemo } from 'react';
import { Wagon, Language } from '../types';
import { X, ShieldCheck, Clock, MapPin } from 'lucide-react';
import { identifyTrainProtocol } from '../utils/trainProtocols';
import { getCargoNameTranslated } from '../utils/translations';

interface Props {
  title: string;
  subtitle: string;
  items: Wagon[];
  onClose: () => void;
  t: (key: string) => string;
  lang: Language;
}

const WagonListModal: React.FC<Props> = ({ title, subtitle, items, onClose, t, lang }) => {
  if (!items || items.length === 0) return null;

  // Group items by train index
  const groups = useMemo(() => {
    const g = new Map<string, Wagon[]>();
    items.forEach(w => {
      const key = w.trainIndex || 'Unknown';
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(w);
    });
    
    const groupArray = Array.from(g.entries()).map(([index, wagons]) => {
       const first = wagons[0];
       const arrival = first.arrivalDate;
       
       // Parse destination from index: (XXXX+XXX+YYYY) -> YYYY
       const match = index.match(/\(\d+\+\d+\+(\d+)\)/);
       const destCode = match ? match[1] : '---';
       
       return {
         index,
         wagons,
         arrival,
         destCode
       };
    });
    
    // Sort by arrival time
    groupArray.sort((a, b) => {
       if (!a.arrival) return 1;
       if (!b.arrival) return -1;
       return a.arrival.getTime() - b.arrival.getTime();
    });
    
    return groupArray;
  }, [items]);

  return (
    <div 
       className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
       onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 space-y-8 bg-slate-50/50">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-100/80 px-6 py-3 flex flex-wrap gap-4 justify-between items-center border-b border-slate-200">
                 <div className="flex items-center gap-3">
                   <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">#{gIdx + 1}</span>
                   <span className="font-mono font-bold text-slate-800 text-sm">{group.index}</span>
                 </div>
                 <div className="flex gap-6 text-sm">
                   <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                     <Clock className="w-4 h-4 text-blue-500" />
                     <span className="font-mono font-bold text-slate-700">
                       {group.arrival ? group.arrival.getHours().toString().padStart(2, '0') + ':00' : '--:--'}
                     </span>
                   </div>
                   <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                     <MapPin className="w-4 h-4 text-emerald-500" />
                     <span className="font-mono font-bold text-slate-700">
                       {group.destCode}
                     </span>
                   </div>
                 </div>
              </div>
              
              <table className="w-full text-left text-sm text-slate-800">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-2 w-16 text-center">№</th>
                    <th className="px-6 py-2">{t('wagon_num_col')}</th>
                    <th className="px-6 py-2">{t('cargo_col')}</th>
                    <th className="px-6 py-2 text-right">{t('weight_ton')}</th>
                    <th className="px-6 py-2">{t('dest_station')}</th>
                    <th className="px-6 py-2 text-center">Prot.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {group.wagons.map((wagon, idx) => {
                    const protocol = identifyTrainProtocol(wagon.trainIndex || "");
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-2 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-6 py-2 font-mono font-bold text-blue-600">{wagon.number}</td>
                        <td className="px-6 py-2 text-slate-600">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-xs">{getCargoNameTranslated(wagon.cargoCode, lang)}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{wagon.cargoCode || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-right font-bold text-slate-700">{wagon.cargoWeight}</td>
                        <td className="px-6 py-2 text-slate-700 font-medium">{wagon.matchedStation?.name || wagon.stationCode}</td>
                        <td className="px-6 py-2 text-center">
                           {protocol && (
                             <div className="flex justify-center" title={`${protocol.mgsp} (${protocol.type})`}>
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                             </div>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-sm text-slate-600 rounded-b-2xl">
          <span className="font-medium">{t('wagons')}: <b className="text-slate-900">{items.length}</b></span>
          <span className="font-medium">{t('total_weight')}: <b className="text-slate-900">{items.reduce((acc, w) => acc + (w.cargoWeight || 0), 0).toLocaleString()} {lang === 'uz' ? 't' : 'т'}</b></span>
        </div>
      </div>
    </div>
  );
};

export default WagonListModal;
