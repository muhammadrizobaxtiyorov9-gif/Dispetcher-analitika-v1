
import React, { useMemo, useState } from 'react';
import { Wagon, Station, ReportCell, Language } from '../types';
import { FileText, X, Printer, LayoutGrid, Table, ArrowDownRight, ArrowUpRight, ShieldCheck, Info, Download } from 'lucide-react';
import { PieChart, Pie, Cell as RechartsCell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { identifyTrainProtocol } from '../utils/trainProtocols';
import { MGSP_DEFINITIONS, normalizeMgspName } from '../utils/stationUtils';
import WagonListModal from './WagonListModal';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';

interface Props {
  wagons: Wagon[];
  lang: Language;
  t: (key: string) => string;
  selectedDate: string;
}

interface ExtendedCell extends ReportCell {
  items: Wagon[];
}

interface TransitRow {
  mgsp: string;
  taj_bekabad: ExtendedCell;
  taj_kudukli: ExtendedCell;
  turkmenistan: ExtendedCell;
  kazakhstan: ExtendedCell;
  kyrgyzstan: ExtendedCell;
  galaba: ExtendedCell;
  total: ExtendedCell;
  sdacha: ExtendedCell;
}

interface ImportRow {
  mgsp: string;
  mtu1: ExtendedCell;
  mtu2: ExtendedCell;
  mtu3: ExtendedCell;
  mtu4: ExtendedCell;
  mtu5: ExtendedCell;
  mtu6: ExtendedCell;
  total: ExtendedCell;
}

const emptyCell = (): ExtendedCell => ({ wagons: 0, tonnage: 0, items: [] });

const CHART_COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#f97316', '#84cc16'
];

// Definition of Border Points (MGSP) with User-Specific Codes (Strict Mapping)
// Moved to utils/stationUtils.ts

const FlowBar = ({ label, count, weight, total, colorClass, onClick, lang }: { label: string, count: number, weight: number, total: number, colorClass: string, onClick: () => void, lang: Language }) => {
  if (count === 0) return null;
  const percentage = Math.max((count / total) * 100, 5); 
  
  return (
    <div className="mb-3 last:mb-0 group cursor-pointer" onClick={onClick}>
      <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-tight">
        <span className="flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
          {label}
        </span>
        <span className="font-bold text-slate-800">{count} <span className="text-[10px] text-slate-400 font-medium normal-case ml-0.5">({weight.toLocaleString()} {lang === 'uz' ? 't' : 'т'})</span></span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${colorClass} opacity-80 group-hover:opacity-100 transition-all duration-300`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const FlowCard: React.FC<{ title: string; transitData: TransitRow; importData: ImportRow; onOpenModal: (t: string, s: string, i: Wagon[]) => void; lang: Language; t: (k:string)=>string }> = ({ title, transitData, importData, onOpenModal, lang, t }) => {
  const transitTotal = transitData?.total.wagons || 0;
  const importTotal = importData?.total.wagons || 0;
  const grandTotal = transitTotal + importTotal;
  const isEmpty = grandTotal === 0;
  
  const regionTerm = lang === 'ru' ? 'РЖУ' : 'MTU';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-300 relative overflow-hidden flex flex-col h-full group ${isEmpty ? 'opacity-60 grayscale' : 'hover:shadow-lg hover:-translate-y-1'}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 group-hover:bg-blue-500 transition-colors duration-500"></div>

      <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-50">
        <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-2 tracking-tight">
          {title}
        </h4>
        {grandTotal > 0 && (
          <span className="text-[10px] font-extrabold bg-slate-900 text-white px-2.5 py-1 rounded-md">
            {grandTotal} {lang === 'uz' ? 'vag' : 'ваг'}
          </span>
        )}
      </div>

      <div className="space-y-6 flex-1">
        {isEmpty && (
           <div className="flex flex-col items-center justify-center h-32 text-slate-300 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              {t('not_found')}
           </div>
        )}

        {transitTotal > 0 && (
          <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100/50">
            <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {t('transit')} ({transitTotal})
            </div>
            <div className="space-y-1">
              <FlowBar label={t('taj_bekabad')} count={transitData.taj_bekabad.wagons} weight={transitData.taj_bekabad.tonnage} total={transitTotal} colorClass="bg-amber-400" onClick={() => onOpenModal(title, `${t('transit')}: ${t('taj_bekabad')}`, transitData.taj_bekabad.items)} lang={lang} />
              <FlowBar label={t('taj_kudukli')} count={transitData.taj_kudukli.wagons} weight={transitData.taj_kudukli.tonnage} total={transitTotal} colorClass="bg-amber-400" onClick={() => onOpenModal(title, `${t('transit')}: ${t('taj_kudukli')}`, transitData.taj_kudukli.items)} lang={lang} />
              <FlowBar label={t('turkmenistan')} count={transitData.turkmenistan.wagons} weight={transitData.turkmenistan.tonnage} total={transitTotal} colorClass="bg-amber-400" onClick={() => onOpenModal(title, `${t('transit')}: ${t('turkmenistan')}`, transitData.turkmenistan.items)} lang={lang} />
              <FlowBar label={t('kazakhstan')} count={transitData.kazakhstan.wagons} weight={transitData.kazakhstan.tonnage} total={transitTotal} colorClass="bg-amber-400" onClick={() => onOpenModal(title, `${t('transit')}: ${t('kazakhstan')}`, transitData.kazakhstan.items)} lang={lang} />
              <FlowBar label={t('kyrgyzstan')} count={transitData.kyrgyzstan.wagons} weight={transitData.kyrgyzstan.tonnage} total={transitTotal} colorClass="bg-amber-400" onClick={() => onOpenModal(title, `${t('transit')}: ${t('kyrgyzstan')}`, transitData.kyrgyzstan.items)} lang={lang} />
              <FlowBar label="Галаба" count={transitData.galaba.wagons} weight={transitData.galaba.tonnage} total={transitTotal} colorClass="bg-amber-400" onClick={() => onOpenModal(title, `${t('transit')}: Галаба`, transitData.galaba.items)} lang={lang} />
            </div>
          </div>
        )}

        {importTotal > 0 && (
          <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100/50">
            <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              {t('import')} ({importTotal})
            </div>
            <div className="space-y-1">
              <FlowBar label={`${regionTerm}-1`} count={importData.mtu1.wagons} weight={importData.mtu1.tonnage} total={importTotal} colorClass="bg-blue-500" onClick={() => onOpenModal(title, `${t('import')}: ${regionTerm}-1`, importData.mtu1.items)} lang={lang} />
              <FlowBar label={`${regionTerm}-2`} count={importData.mtu2.wagons} weight={importData.mtu2.tonnage} total={importTotal} colorClass="bg-blue-500" onClick={() => onOpenModal(title, `${t('import')}: ${regionTerm}-2`, importData.mtu2.items)} lang={lang} />
              <FlowBar label={`${regionTerm}-3`} count={importData.mtu3.wagons} weight={importData.mtu3.tonnage} total={importTotal} colorClass="bg-blue-500" onClick={() => onOpenModal(title, `${t('import')}: ${regionTerm}-3`, importData.mtu3.items)} lang={lang} />
              <FlowBar label={`${regionTerm}-4`} count={importData.mtu4.wagons} weight={importData.mtu4.tonnage} total={importTotal} colorClass="bg-blue-500" onClick={() => onOpenModal(title, `${t('import')}: ${regionTerm}-4`, importData.mtu4.items)} lang={lang} />
              <FlowBar label={`${regionTerm}-5`} count={importData.mtu5.wagons} weight={importData.mtu5.tonnage} total={importTotal} colorClass="bg-blue-500" onClick={() => onOpenModal(title, `${t('import')}: ${regionTerm}-5`, importData.mtu5.items)} lang={lang} />
              <FlowBar label={`${regionTerm}-6`} count={importData.mtu6.wagons} weight={importData.mtu6.tonnage} total={importTotal} colorClass="bg-blue-500" onClick={() => onOpenModal(title, `${t('import')}: ${regionTerm}-6`, importData.mtu6.items)} lang={lang} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TransitImportReport: React.FC<Props> = ({ wagons, lang, t, selectedDate }) => {
  const [modalData, setModalData] = useState<{title: string, subtitle: string, items: Wagon[]} | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'visual'>('table');

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // --- 1. TRANSIT SHEET ---
    const transitRows: any[][] = [
      [t('report_daily'), selectedDate],
      [],
      ['№', t('datyap'), t('taj_bekabad'), '', t('taj_kudukli'), '', t('turkmenistan'), '', t('kazakhstan'), '', t('kyrgyzstan'), '', 'Галаба', '', t('total_upper'), '', t('handover'), ''],
      ['', '', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн']
    ];

    // Helper to push a data row
    const pushRow = (index: string | number, name: string, row: any) => {
        transitRows.push([
            index,
            name,
            row.taj_bekabad.wagons, row.taj_bekabad.tonnage,
            row.taj_kudukli.wagons, row.taj_kudukli.tonnage,
            row.turkmenistan.wagons, row.turkmenistan.tonnage,
            row.kazakhstan.wagons, row.kazakhstan.tonnage,
            row.kyrgyzstan.wagons, row.kyrgyzstan.tonnage,
            row.galaba.wagons, row.galaba.tonnage,
            row.total.wagons, row.total.tonnage,
            row.sdacha.wagons, row.sdacha.tonnage
        ]);
    };

    // DIR 1
    transitRows.push([t('dir1').toUpperCase()]);
    DIR1_ROWS.forEach((name, i) => pushRow(i + 1, name, processedData.transitRows[name]));
    pushRow('', `${t('total_upper')} 1`, processedData.transitSub1);

    transitRows.push([]); // Spacer

    // DIR 2
    transitRows.push([t('dir2').toUpperCase()]);
    DIR2_ROWS.forEach((name, i) => pushRow(i + 1, name, processedData.transitRows[name]));
    pushRow('', `${t('total_upper')} 2`, processedData.transitSub2);

    transitRows.push([]); // Spacer

    // OTHER
    if (processedData.transitRows["ПРОЧИЕ"].total.wagons > 0) {
        pushRow('?', "ПРОЧИЕ", processedData.transitRows["ПРОЧИЕ"]);
    }

    // GRAND TOTAL
    transitRows.push([]);
    pushRow('', t('total_transit').toUpperCase(), processedData.transitGrand);

    const wsTransit = XLSX.utils.aoa_to_sheet(transitRows);
    
    // Basic Column Widths
    wsTransit['!cols'] = [{wch: 5}, {wch: 20}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}];
    
    // Merges for Headers
    wsTransit['!merges'] = [
        { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }, // No
        { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }, // Name
        { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } }, // Taj Bek
        { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } }, // Taj Kud
        { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, // Turkm
        { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } }, // Kaz
        { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } }, // Kyrg
        { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } }, // Galaba
        { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } }, // Total
        { s: { r: 2, c: 16 }, e: { r: 2, c: 17 } }, // Handover
    ];

    XLSX.utils.book_append_sheet(wb, wsTransit, "Transit");

    // --- 2. IMPORT SHEET ---
    const importRows: any[][] = [
      [t('import_acceptance'), selectedDate],
      [],
      ['№', t('datyap'), 'MTU-1', '', 'MTU-2', '', 'MTU-3', '', 'MTU-4', '', 'MTU-5', '', 'MTU-6', '', t('total_upper'), ''],
      ['', '', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн', 'ваг', 'тн']
    ];

    const pushImportRow = (index: string | number, name: string, row: any) => {
        importRows.push([
            index,
            name,
            row.mtu1.wagons, row.mtu1.tonnage,
            row.mtu2.wagons, row.mtu2.tonnage,
            row.mtu3.wagons, row.mtu3.tonnage,
            row.mtu4.wagons, row.mtu4.tonnage,
            row.mtu5.wagons, row.mtu5.tonnage,
            row.mtu6.wagons, row.mtu6.tonnage,
            row.total.wagons, row.total.tonnage
        ]);
    };

    [...DIR1_ROWS, ...DIR2_ROWS].forEach((name, i) => pushImportRow(i + 1, name, processedData.importRows[name]));
    
    if (processedData.importRows["ПРОЧИЕ"].total.wagons > 0) {
        pushImportRow('?', "ПРОЧИЕ", processedData.importRows["ПРОЧИЕ"]);
    }

    importRows.push([]);
    pushImportRow('', t('total_import').toUpperCase(), processedData.importGrand);

    const wsImport = XLSX.utils.aoa_to_sheet(importRows);
    
    wsImport['!cols'] = [{wch: 5}, {wch: 20}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}];
    wsImport['!merges'] = [
        { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
        { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
        { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } },
        { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
        { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } },
        { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } },
        { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
        { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } },
        { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } },
    ];

    XLSX.utils.book_append_sheet(wb, wsImport, "Import");

    XLSX.writeFile(wb, `Railway_Report_${selectedDate}.xlsx`);
  };

  const handlePrint = () => {
    // Ensure we are focused and use a more direct print call
    window.focus();
    
    // Some browsers need a tiny delay to ensure the focus is handled
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error("Print failed", e);
        // Fallback: try to print the parent if we're in an iframe
        if (window.parent && window.parent !== window) {
          try {
            window.parent.print();
          } catch (pe) {
            console.error("Parent print failed", pe);
            alert("Print failed. Please try using your browser's print shortcut (Ctrl+P or Cmd+P).");
          }
        }
      }
    }, 100);
  };

  const DIR1_ROWS = ["САРЫАГАЧ", "СЫРДАРЬЯ", "БЕКАБАД", "ИСТИКЛОЛ", "КИРГИЗИЯ"];
  const DIR2_ROWS = ["ХОДЖИДАВЛЕТ", "ТАЛИМАРДЖАН", "РАЗЪЕЗД 161", "КУДУКЛИ", "АМУЗАНГ", "ГАЛАБА", "ТАХИАТАШ", "КАРАКАЛПАКСТАН"];
  const OTHER_ROWS = ["ПРОЧИЕ"];
  
  // Combine all for iteration, but keep separate for display
  const IMPORT_ROWS = [...DIR1_ROWS, ...DIR2_ROWS, ...OTHER_ROWS];

  const processedData = useMemo(() => {
    const transitRows: Record<string, TransitRow> = {};
    const importRows: Record<string, ImportRow> = {};

    IMPORT_ROWS.forEach(name => {
      transitRows[name] = { mgsp: name, taj_bekabad: emptyCell(), taj_kudukli: emptyCell(), turkmenistan: emptyCell(), kazakhstan: emptyCell(), kyrgyzstan: emptyCell(), galaba: emptyCell(), total: emptyCell(), sdacha: emptyCell() };
      importRows[name] = { mgsp: name, mtu1: emptyCell(), mtu2: emptyCell(), mtu3: emptyCell(), mtu4: emptyCell(), mtu5: emptyCell(), mtu6: emptyCell(), total: emptyCell() };
    });

    const subtotalDir1 = { t: emptyCell(), i: emptyCell() };
    const subtotalDir2 = { t: emptyCell(), i: emptyCell() };
    const subtotalOther = { t: emptyCell(), i: emptyCell() };
    
    const transitGrand = { taj_bekabad: emptyCell(), taj_kudukli: emptyCell(), turkmenistan: emptyCell(), kazakhstan: emptyCell(), kyrgyzstan: emptyCell(), galaba: emptyCell(), total: emptyCell(), sdacha: emptyCell() };
    const importGrand = { mtu1: emptyCell(), mtu2: emptyCell(), mtu3: emptyCell(), mtu4: emptyCell(), mtu5: emptyCell(), mtu6: emptyCell(), total: emptyCell() };

    const addToCell = (cell: ExtendedCell, w: Wagon) => { cell.wagons++; cell.tonnage += (w.cargoWeight || 0); cell.items.push(w); };

    wagons.forEach(w => {
      // EXCLUDE EMPTY WAGONS FROM REPORT TABLES
      if (w.cargoWeight <= 0) return;

      // Improved MGSP Detection using Protocols and Deep Analysis
      const mgsp = normalizeMgspName(w.entryPoint, w.trainIndex);
      const dest = w.matchedStation;
      const destDor = dest?.dor || 0;
      
      const targetMgsp = transitRows[mgsp] ? mgsp : "ПРОЧИЕ";
      
      // Determine if Import or Transit
      const protocol = identifyTrainProtocol(w.trainIndex || "");
      
      // Special check: Galaba (73640) is in Uzbekistan (Dor 73) but treated as Transit to Afghanistan
      const isGalaba = w.stationCode.startsWith('7364') || 
                       (w.destinationStation || '').toLowerCase().includes('галаба') ||
                       (w.trainIndex || "").includes("GALABA_MARKER");

      // Import Rule: Must be Dor 73 or 72, AND NOT Galaba
      let isImport = (destDor === 73 || destDor === 72) && !isGalaba;

      if (protocol) {
         if (protocol.type === 'import') {
            // Keep heuristic for column mapping, but trust protocol for row matching?
            // For now, simple logic is preserved.
         }
      }

      if (isImport) {
        const row = importRows[targetMgsp];
        let targetCell: ExtendedCell | null = null;
        if (destDor === 72) targetCell = row.mtu1;
        else {
          switch(dest?.otd) { case 1: targetCell = row.mtu1; break; case 2: targetCell = row.mtu2; break; case 3: targetCell = row.mtu3; break; case 4: targetCell = row.mtu4; break; case 5: targetCell = row.mtu5; break; case 6: targetCell = row.mtu6; break; default: break; }
        }
        if (targetCell) { addToCell(targetCell, w); addToCell(row.total, w); }
      } else {
        const row = transitRows[targetMgsp];
        let targetCell: ExtendedCell | null = null;
        
        // --- TAJIKISTAN SPLIT LOGIC ---
        // 1. Text Markers (Highest Priority)
        // Include entry point name and handle OCR variations (Latin/Cyrillic E)
        const textMarkers = (w.destinationStation || "") + 
                            (w.matchedStation?.name || "") + 
                            (w.trainIndex || "") + 
                            (w.entryPoint?.name || "");
        // Robust regex for Bekabad and Kudukli (Handles Cyrillic/Latin lookalikes)
        // Bekabad: Б [ЕE] [КK] [АA] Б
        const isBek = /[БB][ЕE][КK][АA][БB]/i.test(textMarkers) || (w.trainIndex || "").includes("BEKAB_MARKER");
        // Kudukli: [КK] [УY] [ДD] [УY] [КK]
        const isKud = /[КK][УY][ДD][УY][КK]/i.test(textMarkers) || (w.trainIndex || "").includes("KUDUK_MARKER");
        
        const code4 = w.stationCode.substring(0, 4);
        const bekPrefixes = new Set(["7473", "7474", "7475", "7476", "7477", "7478", "7479", "7480", "7481", "7483", "7484", "7485", "7486"]);
        const kudPrefixes = new Set(["7450", "7451", "7452", "7453", "7454", "7455", "7456", "7457", "7458", "7459", "7460", "7461", "7462", "7463", "7464", "7465", "7466", "7467", "7468", "7469", "7470", "7471", "7472", "7482", "7487", "7488", "7489", "9385", "9386"]);

        // --- REFINED TRANSIT CLASSIFICATION (Senior Logic) ---
        // Priority 1: Afghanistan (Galaba)
        if (isGalaba) {
            targetCell = row.galaba;
        }
        // Priority 2: Kazakhstan (Dor 66-70)
        else if (destDor >= 66 && destDor <= 70) {
            targetCell = row.kazakhstan;
        }
        // Priority 3: Turkmenistan (Dor 75)
        else if (destDor === 75) {
            targetCell = row.turkmenistan;
        }
        // Priority 4: Kyrgyzstan (Dor 71)
        else if (destDor === 71) {
            targetCell = row.kyrgyzstan;
        }
        // Priority 5: Tajikistan (Explicit prefixes or Dor 74 or markers)
        else if (destDor === 74 || bekPrefixes.has(code4) || kudPrefixes.has(code4) || isBek || isKud) {
            if (bekPrefixes.has(code4)) {
                targetCell = row.taj_bekabad;
            } else if (kudPrefixes.has(code4)) {
                targetCell = row.taj_kudukli;
            } else if (isBek) {
                // If marker says Bekabad, but it's not clearly another country
                targetCell = row.taj_bekabad;
            } else {
                targetCell = row.taj_kudukli;
            }
        }
        // Fallback
        else {
            targetCell = row.galaba; 
        }
        
        if (targetCell) { addToCell(targetCell, w); addToCell(row.total, w); }
      }
    });

    // Helper to sum rows into totals
    const sumRows = (rows: string[], source: any, type: 'transit' | 'import') => {
      const result: any = {};
      const keys = type === 'transit' ? ['taj_bekabad', 'taj_kudukli', 'turkmenistan', 'kazakhstan', 'kyrgyzstan', 'galaba', 'total', 'sdacha'] : ['mtu1', 'mtu2', 'mtu3', 'mtu4', 'mtu5', 'mtu6', 'total'];
      keys.forEach(k => result[k] = emptyCell());
      rows.forEach(name => {
        const row = source[name];
        keys.forEach(k => {
           result[k].wagons += row[k].wagons;
           result[k].tonnage += row[k].tonnage;
           result[k].items.push(...row[k].items);
        });
      });
      return result;
    }

    const transitSub1 = sumRows(DIR1_ROWS, transitRows, 'transit');
    const transitSub2 = sumRows(DIR2_ROWS, transitRows, 'transit');
    const transitSubOther = sumRows(OTHER_ROWS, transitRows, 'transit');
    const transitGrandTotal = sumRows(IMPORT_ROWS, transitRows, 'transit');
    const importGrandTotal = sumRows(IMPORT_ROWS, importRows, 'import');

    return { transitRows, importRows, transitSub1, transitSub2, transitSubOther, transitGrand: transitGrandTotal, importGrand: importGrandTotal };
  }, [wagons]);

  const regionTerm = lang === 'ru' ? 'РЖУ' : 'MTU';

  // Chart Data preparation
  const transitEntryPieData = useMemo(() => IMPORT_ROWS.map(name => ({ name, value: processedData.transitRows[name].total.wagons })).filter(d => d.value > 0).sort((a,b) => b.value - a.value), [processedData]);
  const importEntryPieData = useMemo(() => IMPORT_ROWS.map(name => ({ name, value: processedData.importRows[name].total.wagons })).filter(d => d.value > 0).sort((a,b) => b.value - a.value), [processedData]);
  
  const transitExitPieData = useMemo(() => [
    { name: t('taj_bekabad'), value: processedData.transitGrand.taj_bekabad.wagons },
    { name: t('taj_kudukli'), value: processedData.transitGrand.taj_kudukli.wagons },
    { name: t('turkmenistan'), value: processedData.transitGrand.turkmenistan.wagons },
    { name: t('kazakhstan'), value: processedData.transitGrand.kazakhstan.wagons },
    { name: t('kyrgyzstan'), value: processedData.transitGrand.kyrgyzstan.wagons },
    { name: 'Афганистан (Галаба)', value: processedData.transitGrand.galaba.wagons },
  ].filter(d => d.value > 0).sort((a,b) => b.value - a.value), [processedData, t]);

  const rjuPieData = useMemo(() => [
    { name: `${regionTerm}-1`, value: processedData.importGrand.mtu1.wagons },
    { name: `${regionTerm}-2`, value: processedData.importGrand.mtu2.wagons },
    { name: `${regionTerm}-3`, value: processedData.importGrand.mtu3.wagons },
    { name: `${regionTerm}-4`, value: processedData.importGrand.mtu4.wagons },
    { name: `${regionTerm}-5`, value: processedData.importGrand.mtu5.wagons },
    { name: `${regionTerm}-6`, value: processedData.importGrand.mtu6.wagons },
  ].filter(d => d.value > 0).sort((a,b) => b.value - a.value), [processedData, regionTerm]);

  // Calculate totals manually for tooltips to avoid NaN
  const transitEntryTotal = useMemo(() => transitEntryPieData.reduce((acc, curr) => acc + curr.value, 0), [transitEntryPieData]);
  const transitExitTotal = useMemo(() => transitExitPieData.reduce((acc, curr) => acc + curr.value, 0), [transitExitPieData]);
  const importEntryTotal = useMemo(() => importEntryPieData.reduce((acc, curr) => acc + curr.value, 0), [importEntryPieData]);
  const rjuTotal = useMemo(() => rjuPieData.reduce((acc, curr) => acc + curr.value, 0), [rjuPieData]);

  const Cell = ({ data, onClickLabel, isTotal = false, isHeader = false }: { data: ExtendedCell, onClickLabel: string, isTotal?: boolean, isHeader?: boolean }) => {
    if (!data) return <><td className="border-r border-slate-100"></td><td className="border-r border-slate-100"></td></>;
    return (
    <>
      <td 
        className={`px-1 py-2 text-center border-r border-slate-100 text-xs tabular-nums transition-colors ${data.wagons > 0 ? 'cursor-pointer hover:bg-yellow-50 text-slate-900 font-bold' : 'text-slate-200'} ${isTotal ? 'bg-slate-50 font-extrabold' : ''} ${isHeader ? 'border-b-2 border-slate-300' : 'border-b border-slate-100'}`}
        onClick={() => data.wagons > 0 && setModalData({title: onClickLabel, subtitle: t('wagons'), items: data.items})}
      >
        {data.wagons || ''}
      </td>
      <td 
        className={`px-1 py-2 text-center border-r border-slate-100 text-[10px] tabular-nums transition-colors ${data.wagons > 0 ? 'cursor-pointer hover:bg-yellow-50 text-slate-500 font-medium' : 'text-slate-100'} ${isTotal ? 'bg-slate-50 font-bold' : ''} ${isHeader ? 'border-b-2 border-slate-300' : 'border-b border-slate-100'}`}
        onClick={() => data.wagons > 0 && setModalData({title: onClickLabel, subtitle: "Tonnaj", items: data.items})}
      >
        {data.tonnage > 0 ? data.tonnage : ''}
      </td>
    </>
    );
  };

  const HeaderRow = ({ title, colorClass }: { title: string, colorClass: string }) => (
    <tr>
      <td colSpan={15} className={`px-4 py-3 font-bold text-left ${colorClass} text-xs uppercase tracking-widest bg-slate-50 border-b border-slate-200`}>
        {title}
      </td>
    </tr>
  );

  return (
    <div id="report-container" className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 printable-area">
      {modalData && <WagonListModal title={modalData.title} subtitle={modalData.subtitle} items={modalData.items} onClose={() => setModalData(null)} t={t} lang={lang} />}
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
         <div>
           <div className="flex items-center gap-2">
             <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('report_daily')}</h2>
             <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold border border-slate-200 flex items-center gap-1">
                <Info className="w-3 h-3" /> Без порожних
             </span>
           </div>
           <p className="text-slate-400 font-medium text-sm mt-1">{t('current_date')}: <span className="text-slate-700 font-bold">{selectedDate}</span></p>
         </div>
         <div className={`flex bg-slate-100/50 p-1 rounded-xl border border-slate-200 print:hidden`}>
            <button onClick={() => setViewMode('table')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
              <Table className="w-4 h-4" /> {t('table')}
            </button>
            <button onClick={() => setViewMode('visual')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'visual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
              <LayoutGrid className="w-4 h-4" /> {t('infographics')}
            </button>
         </div>
         <div className="flex gap-2">
            <button 
              onClick={handleExportExcel} 
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-700 transition-colors print:hidden flex items-center gap-2"
              title="Download as Excel Spreadsheet"
            >
               <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button 
              onClick={handlePrint} 
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-700 transition-colors print:hidden flex items-center gap-2"
              title="Print or Save as PDF"
            >
               <Printer className="w-4 h-4" /> {t('print')}
            </button>
         </div>
      </div>

      {/* Table View - Always visible during print */}
      <div className={`${viewMode === 'table' ? 'block' : 'hidden print:block'} space-y-12`}>
           {/* Transit Table */}
           <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)]">
             <table id="transit-table" className="w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-900 text-white text-center">
                    <th rowSpan={2} className="px-2 py-3 w-12 text-[10px] uppercase font-bold tracking-wider border-r border-slate-700">№</th>
                    <th rowSpan={2} className="px-4 py-3 text-left text-[10px] uppercase font-bold tracking-wider border-r border-slate-700 min-w-[150px]">{t('mgsp_input')}</th>
                    {[t('taj_bekabad'), t('taj_kudukli'), t('turkmenistan'), t('kazakhstan'), t('kyrgyzstan'), 'Галаба'].map(h => <th key={h} colSpan={2} className="px-2 py-2 text-[10px] uppercase font-bold bg-slate-800 border-r border-slate-700 border-b border-slate-700">{h}</th>)}
                    <th colSpan={2} className="px-2 py-2 text-[10px] uppercase font-bold bg-amber-600 border-r border-amber-700 border-b border-amber-700">{t('total_upper')}</th>
                    <th colSpan={2} className="px-2 py-2 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-700">{t('handover')}</th>
                  </tr>
                  <tr className="bg-slate-900 text-slate-400 text-[9px] text-center font-mono">
                     {[...Array(7)].map((_, i) => <React.Fragment key={i}><th className="px-1 py-1 border-r border-slate-700 bg-slate-800/50">{lang === 'uz' ? 'vag' : 'ваг'}</th><th className="px-1 py-1 border-r border-slate-700 bg-slate-800/50">tn</th></React.Fragment>)}
                  </tr>
                </thead>
                <tbody className="text-sm">
                   <HeaderRow title={t('dir1')} colorClass="text-rose-600" />
                   {DIR1_ROWS.map((name, i) => (
                     <tr key={name} className="hover:bg-slate-50 transition-colors">
                       <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-100 bg-slate-50/50">{i + 1}</td>
                       <td className="px-4 py-2 font-bold text-slate-700 text-xs border-r border-slate-100">{name}</td>
                       <Cell data={processedData.transitRows[name].taj_bekabad} onClickLabel={`${name} - ${t('taj_bekabad')}`} />
                       <Cell data={processedData.transitRows[name].taj_kudukli} onClickLabel={`${name} - ${t('taj_kudukli')}`} />
                       <Cell data={processedData.transitRows[name].turkmenistan} onClickLabel={`${name} - ${t('turkmenistan')}`} />
                       <Cell data={processedData.transitRows[name].kazakhstan} onClickLabel={`${name} - ${t('kazakhstan')}`} />
                       <Cell data={processedData.transitRows[name].kyrgyzstan} onClickLabel={`${name} - ${t('kyrgyzstan')}`} />
                       <Cell data={processedData.transitRows[name].galaba} onClickLabel={`${name} - Галаба`} />
                       <Cell data={processedData.transitRows[name].total} onClickLabel={`${name} - ${t('total_upper')}`} isTotal />
                       <Cell data={processedData.transitRows[name].sdacha} onClickLabel={`${name} - ${t('handover')}`} />
                     </tr>
                   ))}
                   {/* Subtotal 1 */}
                   <tr className="bg-rose-50 border-t-2 border-rose-100">
                     <td colSpan={2} className="px-4 py-2 text-right font-bold text-rose-700 text-xs uppercase tracking-wider border-r border-rose-200">{t('total_upper')} 1:</td>
                     <Cell data={processedData.transitSub1.taj_bekabad} onClickLabel="Total 1 - BEK" isTotal />
                      <Cell data={processedData.transitSub1.taj_kudukli} onClickLabel="Total 1 - KUD" isTotal />
                     <Cell data={processedData.transitSub1.turkmenistan} onClickLabel="Total 1" isTotal />
                     <Cell data={processedData.transitSub1.kazakhstan} onClickLabel="Total 1" isTotal />
                     <Cell data={processedData.transitSub1.kyrgyzstan} onClickLabel="Total 1" isTotal />
                     <Cell data={processedData.transitSub1.galaba} onClickLabel="Total 1" isTotal />
                     <Cell data={processedData.transitSub1.total} onClickLabel="Total 1" isTotal />
                     <Cell data={processedData.transitSub1.sdacha} onClickLabel="Total 1" isTotal />
                   </tr>

                   <HeaderRow title={t('dir2')} colorClass="text-blue-600" />
                   {DIR2_ROWS.map((name, i) => (
                     <tr key={name} className="hover:bg-slate-50 transition-colors">
                       <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-100 bg-slate-50/50">{i + 1}</td>
                       <td className="px-4 py-2 font-bold text-slate-700 text-xs border-r border-slate-100">{name}</td>
                       <Cell data={processedData.transitRows[name].taj_bekabad} onClickLabel={`${name} - ${t('taj_bekabad')}`} />
                       <Cell data={processedData.transitRows[name].taj_kudukli} onClickLabel={`${name} - ${t('taj_kudukli')}`} />
                       <Cell data={processedData.transitRows[name].turkmenistan} onClickLabel={`${name} - ${t('turkmenistan')}`} />
                       <Cell data={processedData.transitRows[name].kazakhstan} onClickLabel={`${name} - ${t('kazakhstan')}`} />
                       <Cell data={processedData.transitRows[name].kyrgyzstan} onClickLabel={`${name} - ${t('kyrgyzstan')}`} />
                       <Cell data={processedData.transitRows[name].galaba} onClickLabel={`${name} - Галаба`} />
                       <Cell data={processedData.transitRows[name].total} onClickLabel={`${name} - ${t('total_upper')}`} isTotal />
                       <Cell data={processedData.transitRows[name].sdacha} onClickLabel={`${name} - ${t('handover')}`} />
                     </tr>
                   ))}
                   {/* Subtotal 2 */}
                   <tr className="bg-blue-50 border-t-2 border-blue-100">
                     <td colSpan={2} className="px-4 py-2 text-right font-bold text-blue-700 text-xs uppercase tracking-wider border-r border-blue-200">{t('total_upper')} 2:</td>
                     <Cell data={processedData.transitSub2.taj_bekabad} onClickLabel="Total 2 - BEK" isTotal />
                      <Cell data={processedData.transitSub2.taj_kudukli} onClickLabel="Total 2 - KUD" isTotal />
                     <Cell data={processedData.transitSub2.turkmenistan} onClickLabel="Total 2" isTotal />
                     <Cell data={processedData.transitSub2.kazakhstan} onClickLabel="Total 2" isTotal />
                     <Cell data={processedData.transitSub2.kyrgyzstan} onClickLabel="Total 2" isTotal />
                     <Cell data={processedData.transitSub2.galaba} onClickLabel="Total 2" isTotal />
                     <Cell data={processedData.transitSub2.total} onClickLabel="Total 2" isTotal />
                     <Cell data={processedData.transitSub2.sdacha} onClickLabel="Total 2" isTotal />
                   </tr>

                   {/* Other (Unidentified) */}
                   {processedData.transitRows["ПРОЧИЕ"].total.wagons > 0 && (
                     <>
                        <HeaderRow title={t('other_unknown')} colorClass="text-slate-500" />
                        <tr className="hover:bg-slate-50 transition-colors">
                           <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-100 bg-slate-50/50">?</td>
                           <td className="px-4 py-2 font-bold text-slate-700 text-xs border-r border-slate-100">ПРОЧИЕ</td>
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].taj_bekabad} onClickLabel="ПРОЧИЕ - Тадж (Бек)" />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].taj_kudukli} onClickLabel="ПРОЧИЕ - Тадж (Куд)" />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].turkmenistan} onClickLabel="ПРОЧИЕ - Туркм" />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].kazakhstan} onClickLabel="ПРОЧИЕ - Каз" />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].kyrgyzstan} onClickLabel="ПРОЧИЕ - Кирг" />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].galaba} onClickLabel="ПРОЧИЕ - Галаба" />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].total} onClickLabel="ПРОЧИЕ - Всего" isTotal />
                           <Cell data={processedData.transitRows["ПРОЧИЕ"].sdacha} onClickLabel="ПРОЧИЕ - Сдача" />
                        </tr>
                     </>
                   )}

                   {/* GRAND TOTAL */}
                   <tr className="bg-slate-900 text-white border-t-4 border-amber-500 font-bold">
                     <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-widest border-r border-slate-700">{t('total_transit')}:</td>
                     <Cell data={processedData.transitGrand.taj_bekabad} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.taj_kudukli} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.turkmenistan} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.kazakhstan} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.kyrgyzstan} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.galaba} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.total} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.transitGrand.sdacha} onClickLabel="GRAND TOTAL" isTotal />
                   </tr>
                </tbody>
             </table>
           </div>
           
           {/* Import Table (Similar Structure) */}
           <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)]">
             <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest">{t('import_acceptance')}</h3>
             </div>
             <table id="import-table" className="w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-900 text-white text-center">
                     <th rowSpan={2} className="px-2 py-3 w-12 text-[10px] uppercase font-bold border-r border-slate-700">№</th>
                     <th rowSpan={2} className="px-4 py-3 text-left text-[10px] uppercase font-bold border-r border-slate-700 min-w-[150px]">{t('mgsp_input')}</th>
                     {[1, 2, 3, 4, 5, 6].map(i => `${regionTerm} ${i}`).map(h => <th key={h} colSpan={2} className="px-2 py-2 text-[10px] uppercase font-bold bg-slate-800 border-r border-slate-700 border-b border-slate-700">{h}</th>)}
                     <th colSpan={2} className="px-2 py-2 text-[10px] uppercase font-bold bg-blue-600 border-r border-blue-700 border-b border-blue-700">{t('total_upper')}</th>
                  </tr>
                  <tr className="bg-slate-900 text-slate-400 text-[9px] text-center font-mono">
                     {[...Array(7)].map((_, i) => <React.Fragment key={i}><th className="px-1 py-1 border-r border-slate-700 bg-slate-800/50">{lang === 'uz' ? 'vag' : 'ваг'}</th><th className="px-1 py-1 border-r border-slate-700 bg-slate-800/50">tn</th></React.Fragment>)}
                  </tr>
                </thead>
                <tbody>
                   {[...DIR1_ROWS, ...DIR2_ROWS].map((name, i) => (
                     <tr key={name} className="hover:bg-slate-50 transition-colors">
                       <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-100 bg-slate-50/50">{i + 1}</td>
                       <td className="px-4 py-2 font-bold text-slate-700 text-xs border-r border-slate-100">{name}</td>
                       <Cell data={processedData.importRows[name].mtu1} onClickLabel={`${name} - ${regionTerm} 1`} />
                       <Cell data={processedData.importRows[name].mtu2} onClickLabel={`${name} - ${regionTerm} 2`} />
                       <Cell data={processedData.importRows[name].mtu3} onClickLabel={`${name} - ${regionTerm} 3`} />
                       <Cell data={processedData.importRows[name].mtu4} onClickLabel={`${name} - ${regionTerm} 4`} />
                       <Cell data={processedData.importRows[name].mtu5} onClickLabel={`${name} - ${regionTerm} 5`} />
                       <Cell data={processedData.importRows[name].mtu6} onClickLabel={`${name} - ${regionTerm} 6`} />
                       <Cell data={processedData.importRows[name].total} onClickLabel={`${name} - Total`} isTotal />
                     </tr>
                   ))}
                   {/* Other for Import */}
                   {processedData.importRows["ПРОЧИЕ"].total.wagons > 0 && (
                     <tr className="hover:bg-slate-50 transition-colors border-t border-slate-200">
                        <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-100 bg-slate-50/50">?</td>
                        <td className="px-4 py-2 font-bold text-slate-500 text-xs border-r border-slate-100">ПРОЧИЕ</td>
                        <Cell data={processedData.importRows["ПРОЧИЕ"].mtu1} onClickLabel={`ПРОЧИЕ - ${regionTerm} 1`} />
                        <Cell data={processedData.importRows["ПРОЧИЕ"].mtu2} onClickLabel={`ПРОЧИЕ - ${regionTerm} 2`} />
                        <Cell data={processedData.importRows["ПРОЧИЕ"].mtu3} onClickLabel={`ПРОЧИЕ - ${regionTerm} 3`} />
                        <Cell data={processedData.importRows["ПРОЧИЕ"].mtu4} onClickLabel={`ПРОЧИЕ - ${regionTerm} 4`} />
                        <Cell data={processedData.importRows["ПРОЧИЕ"].mtu5} onClickLabel={`ПРОЧИЕ - ${regionTerm} 5`} />
                        <Cell data={processedData.importRows["ПРОЧИЕ"].mtu6} onClickLabel={`ПРОЧИЕ - ${regionTerm} 6`} />
                        <Cell data={processedData.importRows["ПРОЧИЕ"].total} onClickLabel="ПРОЧИЕ - Total" isTotal />
                     </tr>
                   )}

                   <tr className="bg-slate-900 text-white border-t-4 border-blue-500 font-bold">
                     <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-widest border-r border-slate-700">{t('total_import')}:</td>
                     <Cell data={processedData.importGrand.mtu1} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.importGrand.mtu2} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.importGrand.mtu3} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.importGrand.mtu4} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.importGrand.mtu5} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.importGrand.mtu6} onClickLabel="GRAND TOTAL" isTotal />
                     <Cell data={processedData.importGrand.total} onClickLabel="GRAND TOTAL" isTotal />
                   </tr>
                </tbody>
             </table>
           </div>
        </div>
      
      {/* Visual View - Always hidden during print */}
      <div className={`${viewMode === 'visual' ? 'block print:hidden' : 'hidden'} space-y-12`}>
           {/* Summary Pie Charts */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
              {/* Chart 1: Transit Entry */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
                  <h4 className="font-bold text-slate-800 mb-4 text-center flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {t('transit_entry_chart')}
                  </h4>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie 
                                data={transitEntryPieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={50} 
                                outerRadius={80} 
                                paddingAngle={5}
                                label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')}
                            >
                              {transitEntryPieData.map((entry, index) => (
                                <RechartsCell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                formatter={(value: number, name: string) => [
                                  `${value} ${lang === 'uz' ? 'vag' : 'ваг'} (${((value / transitEntryTotal) * 100).toFixed(1)}%)`, 
                                  name
                                ]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
              </div>

               {/* Chart 2: Transit Exit (New) */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
                  <h4 className="font-bold text-slate-800 mb-4 text-center flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    {t('transit_exit_chart')}
                  </h4>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie 
                                data={transitExitPieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={50} 
                                outerRadius={80} 
                                paddingAngle={5}
                                label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')}
                            >
                              {transitExitPieData.map((entry, index) => (
                                <RechartsCell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                formatter={(value: number, name: string) => [
                                  `${value} ${lang === 'uz' ? 'vag' : 'ваг'} (${((value / transitExitTotal) * 100).toFixed(1)}%)`, 
                                  name
                                ]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
              </div>

              {/* Chart 3: Import Entry */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
                  <h4 className="font-bold text-slate-800 mb-4 text-center flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {t('import_entry_chart')}
                  </h4>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie 
                                data={importEntryPieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={50} 
                                outerRadius={80} 
                                paddingAngle={5}
                                label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')}
                            >
                              {importEntryPieData.map((entry, index) => (
                                <RechartsCell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                formatter={(value: number, name: string) => [
                                  `${value} ${lang === 'uz' ? 'vag' : 'ваг'} (${((value / importEntryTotal) * 100).toFixed(1)}%)`, 
                                  name
                                ]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
              </div>

              {/* Chart 4: Import Destination (RJU) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
                  <h4 className="font-bold text-slate-800 mb-4 text-center flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {t('import_region_chart')}
                  </h4>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie 
                                data={rjuPieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={50} 
                                outerRadius={80} 
                                paddingAngle={5}
                                label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')}
                            >
                              {rjuPieData.map((entry, index) => (
                                <RechartsCell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                formatter={(value: number, name: string) => [
                                  `${value} ${lang === 'uz' ? 'vag' : 'ваг'} (${((value / rjuTotal) * 100).toFixed(1)}%)`, 
                                  name
                                ]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
              </div>
           </div>

           {/* Detailed Flow Cards */}
           <div className="relative">
              <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3">
                 <span className="w-2 h-8 bg-rose-500 rounded-full"></span>
                 {t('dir1')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                 {DIR1_ROWS.map(name => (
                   <FlowCard key={name} title={name} transitData={processedData.transitRows[name]} importData={processedData.importRows[name]} onOpenModal={() => {}} lang={lang} t={t} />
                 ))}
              </div>
           </div>
           <div className="relative mt-8">
              <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3">
                 <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                 {t('dir2')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                 {DIR2_ROWS.map(name => (
                   <FlowCard key={name} title={name} transitData={processedData.transitRows[name]} importData={processedData.importRows[name]} onOpenModal={() => {}} lang={lang} t={t} />
                 ))}
              </div>
           </div>
           
           {/* Other/Unknown Cards */}
           {processedData.transitRows["ПРОЧИЕ"].total.wagons + processedData.importRows["ПРОЧИЕ"].total.wagons > 0 && (
             <div className="relative mt-8">
                <h3 className="text-xl font-extrabold text-slate-600 mb-6 flex items-center gap-3">
                   <span className="w-2 h-8 bg-slate-400 rounded-full"></span>
                   {t('other_unknown')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                   <FlowCard key="ПРОЧИЕ" title="ПРОЧИЕ" transitData={processedData.transitRows["ПРОЧИЕ"]} importData={processedData.importRows["ПРОЧИЕ"]} onOpenModal={() => {}} lang={lang} t={t} />
                </div>
             </div>
           )}
        </div>
    </div>
  );
};

export default TransitImportReport;
