import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import {
  Euro, TrendingUp, TrendingDown, FileText, RefreshCw,
  Shield, Swords, Filter, X, ChevronDown, BarChart2, Activity
} from 'lucide-react';
import KPICard from '../components/bi/KPICard';
import KPIAlertBanner from '../components/bi/KPIAlertBanner';
import AreaChart from '../components/bi/AreaChart';
import AmbitoChart from '../components/bi/AmbitoChart';
import KPIAnalisi from '../components/bi/KPIAnalisi';
import KPIDetailModal from '../components/bi/KPIDetailModal';
import DealsFilters, { EMPTY_FILTERS, applyFilters } from '../components/bi/DealsFilters';
import { enrichDealsWithPortfolio } from '../components/bi/enrichDeals';
import RevenueByAreaChart from '../components/bi/RevenueByAreaChart';
import MarginByAreaChart from '../components/bi/MarginByAreaChart';
import MonthlyTrendChart from '../components/bi/MonthlyTrendChart';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${v.toFixed(0)}`;
}

function fmtPct(v, decimals = 1) {
  if (v === null || v === undefined) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

// ✅ Paginazione corretta con startAfter — nessun limite superato
async function loadCollectionByAnno(anno) {
  const col = collection(db, 'deals');
  let all = [];
  let lastDoc = null;
  while (true) {
    const constraints = [col, where('anno', '==', anno), limit(100)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(...constraints));
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    await new Promise(r => setTimeout(r, 50));
  }
  return all;
}

async function loadPortafoglio() {
  const col = collection(db, 'portafoglio_clienti');
  let all = [];
  let lastDoc = null;
  while (true) {
    const constraints = [col, limit(100)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(...constraints));
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    await new Promise(r => setTimeout(r, 50));
  }
  return all;
}

function computeBIData(deals) {
  const byYearArea = {};
  const byYearAmbito = {};
  const byYearLob = {};
  const clientMap = {};

  for (const d of deals) {
    const s = d.serv_i_anno || 0;
    const anno = d.anno || 'N/A';
    const area = d.area_rac || 'N/A';
    const ambito = d.ambito || 'N/A';
    const lob = d.lob || 'N/A';
    const rc = d.ragione_sociale_capogruppo;
    const ad = d.attacco_difesa;

    const aKey = `${anno}_${area}`;
    if (!byYearArea[aKey]) byYearArea[aKey] = { anno, area_rac: area, serv_i_anno: 0, canoni: 0, differenziale_servizi: 0, attacco: 0, difesa: 0, count: 0 };
    byYearArea[aKey].serv_i_anno += s;
    byYearArea[aKey].canoni += d.canoni || 0;
    byYearArea[aKey].differenziale_servizi += d.differenziale_servizi || 0;
    byYearArea[aKey].count += 1;
    if (ad === 'Attacco') byYearArea[aKey].attacco += s;
    else byYearArea[aKey].difesa += s;

    const amKey = `${anno}_${ambito}`;
    if (!byYearAmbito[amKey]) byYearAmbito[amKey] = { anno, ambito, serv_i_anno: 0 };
    byYearAmbito[amKey].serv_i_anno += s;

    const lKey = `${anno}_${lob}`;
    if (!byYearLob[lKey]) byYearLob[lKey] = { anno, lob, serv_i_anno: 0 };
    byYearLob[lKey].serv_i_anno += s;

    if (rc && rc.trim() !== '') {
      if (!clientMap[rc]) clientMap[rc] = { ragione_sociale_capogruppo: rc, '2024': 0, '2025': 0, '2026': 0, areas: new Set(), n_deals: 0 };
      clientMap[rc][anno] = (clientMap[rc][anno] || 0) + s;
      if (area) clientMap[rc].areas.add(area);
      clientMap[rc].n_deals += 1;
    }
  }

  const topClients = Object.values(clientMap)
    .map(c => ({ ...c, areas: Array.from(c.areas), total: (c['2024'] || 0) + (c['2025'] || 0) + (c['2026'] || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  const deals2024 = deals.filter(d => d.anno === '2024');
  const deals2025 = deals.filter(d => d.anno === '2025');
  const deals2026 = deals.filter(d => d.anno === '2026');
  const sum = (arr, field) => arr.reduce((s, d) => s + (d[field] || 0), 0);

  const ytd = {
    '2024': sum(deals2024, 'serv_i_anno'),
    '2025': sum(deals2025, 'serv_i_anno'),
    '2026': sum(deals2026, 'serv_i_anno'),
    canoni_2024: sum(deals2024, 'canoni'),
    canoni_2025: sum(deals2025, 'canoni'),
    canoni_2026: sum(deals2026, 'canoni'),
    diff_2024: sum(deals2024, 'differenziale_servizi'),
    diff_2025: sum(deals2025, 'differenziale_servizi'),
    diff_2026: sum(deals2026, 'differenziale_servizi'),
  };

  const attacco = {};
  const difesa = {};
  for (const [anno, arr] of [['2024', deals2024], ['2025', deals2025], ['2026', deals2026]]) {
    attacco[anno] = arr.filter(d => d.attacco_difesa === 'Attacco').reduce((s, d) => s + (d.serv_i_anno || 0), 0);
    difesa[anno] = arr.filter(d => d.attacco_difesa !== 'Attacco').reduce((s, d) => s + (d.serv_i_anno || 0), 0);
  }

  return {
    byYearArea: Object.values(byYearArea),
    byYearAmbito: Object.values(byYearAmbito),
    byYearLob: Object.values(byYearLob),
    topClients, ytd, attacco, difesa,
    total_deals: deals.length,
    total_2024: deals2024.length,
    total_2025: deals2025.length,
    total_2026: deals2026.length,
  };
}

function FilterChip({ label, value, onRemove }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
      <span className="text-blue-400">{label}:</span> {value}
      <button onClick={onRemove} className="ml-0.5 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
    </span>
  );
}

const AREAS = ['MNO','SNO','LNO','MNE','SNE','LNE','MCS','SLCE','SLCS','IC'];

function QuickAreaFilter({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => onChange(null)}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${!selected ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
        Tutte le aree
      </button>
      {AREAS.map(a => (
        <button key={a} onClick={() => onChange(selected === a ? null : a)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${selected === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}>
          {a}
        </button>
      ))}
    </div>
  );
}

function InlineKPI({ label, value, delta, color = 'gray', small = false }) {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-500', orange: 'text-orange-500', purple: 'text-purple-600', gray: 'text-gray-700' };
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 font-medium mb-0.5">{label}</span>
      <span className={`${small ? 'text-lg' : 'text-2xl'} font-black ${colors[color]} leading-none`}>{value}</span>
      {delta !== undefined && delta !== null && (
        <span className={`text-xs font-semibold mt-0.5 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% YoY
        </span>
      )}
    </div>
  );
}

function AreaRow({ area, d24, d25, d26 }) {
  const s24 = d24?.serv_i_anno || 0;
  const s25 = d25?.serv_i_anno || 0;
  const s26 = d26?.serv_i_anno || 0;
  if (s24 === 0 && s25 === 0 && s26 === 0) return null;
  const diff2625 = s26 - s25;
  const varPct2625 = s25 > 0 ? ((diff2625 / s25) * 100) : null;
  const diff2524 = s25 - s24;
  const varPct2524 = s24 > 0 ? ((diff2524 / s24) * 100) : null;
  const maxVal = Math.max(s24, s25, s26, 1);
  return (
    <tr className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
      <td className="py-2.5 pr-3"><span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-xs font-bold text-gray-700 group-hover:bg-blue-100 group-hover:text-blue-800 transition-colors">{area}</span></td>
      <td className="py-2.5 text-right text-gray-400 text-xs">{s24 > 0 ? fmt(s24) : '—'}</td>
      <td className="py-2.5 text-right text-xs">
        <span className={`font-medium ${s25 > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{s25 > 0 ? fmt(s25) : '—'}</span>
        {s24 > 0 && s25 > 0 && <span className={`block text-[10px] ${varPct2524 >= 0 ? 'text-green-500' : 'text-red-400'}`}>{fmtPct(varPct2524)}</span>}
      </td>
      <td className="py-2.5 text-right">
        <span className="text-sm font-bold text-gray-800">{s26 > 0 ? fmt(s26) : '—'}</span>
        <div className="h-1 rounded-full bg-gray-100 mt-1 w-full">
          <div className={`h-1 rounded-full ${diff2625 >= 0 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${s26 / maxVal * 100}%` }} />
        </div>
      </td>
      <td className={`py-2.5 text-right text-sm font-semibold ${diff2625 >= 0 ? 'text-green-600' : 'text-red-500'}`}>{s25 > 0 || s26 > 0 ? fmt(diff2625) : '—'}</td>
      <td className={`py-2.5 text-right text-xs font-bold ${varPct2625 === null ? 'text-gray-300' : varPct2625 >= 0 ? 'text-green-600' : 'text-red-500'}`}>
        {varPct2625 === null ? '—' : fmtPct(varPct2625)}
      </td>
      <td className="py-2.5 text-right text-xs text-gray-400">{(d24?.count || 0) + (d25?.count || 0) + (d26?.count || 0)}</td>
    </tr>
  );
}

function Skeleton({ className }) { return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />; }

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2"><Skeleton className="h-7 w-72" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

const MESI_NAMES = ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export default function Dashboard() {
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Caricamento deals...');
  const [hasData, setHasData] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [quickArea, setQuickArea] = useState(null);
  const [kpiDetail, setKpiDetail] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [mtdEnabled, setMtdEnabled] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Carica tutti e 3 gli anni in sequenza con paginazione corretta
      setLoadingMsg('Caricamento 2024...');
      const deals2024 = await loadCollectionByAnno('2024');
      setLoadingMsg('Caricamento 2025...');
      const deals2025 = await loadCollectionByAnno('2025');
      setLoadingMsg('Caricamento 2026...');
      const deals2026 = await loadCollectionByAnno('2026');
      setLoadingMsg('Caricamento portafoglio...');
      const rawPtf = await loadPortafoglio();

      const rawDeals = [...deals2024, ...deals2025, ...deals2026];

      if (!rawDeals || rawDeals.length === 0) {
        setHasData(false);
        return;
      }

      setLoadingMsg('Elaborazione dati...');
      await new Promise(r => setTimeout(r, 0));
      const enriched = enrichDealsWithPortfolio(rawDeals, rawPtf);
      setHasData(true);
      setAllDeals(enriched);
    } catch (err) {
      console.error('[Dashboard] Errore caricamento:', err);
      setError(err?.message || 'Errore sconosciuto');
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const mtdMesi = useMemo(() => {
    const annoRif = '2026';
    const mesi = [...new Set(allDeals.filter(d => d.anno === annoRif).map(d => d.mese).filter(Boolean))].sort((a,b)=>a-b);
    return mesi;
  }, [allDeals]);

  const mtdDeals = useMemo(() => {
    if (!mtdEnabled || mtdMesi.length === 0) return allDeals;
    return allDeals.filter(d => d.anno === '2026' || mtdMesi.includes(d.mese));
  }, [allDeals, mtdEnabled, mtdMesi]);

  const filteredByArea = useMemo(() => {
    if (!quickArea) return mtdDeals;
    return mtdDeals.filter(d => d.area_rac === quickArea);
  }, [mtdDeals, quickArea]);

  const filteredDeals = useMemo(() => applyFilters(filteredByArea, filters), [filteredByArea, filters]);
  const biData = useMemo(() => filteredDeals.length ? computeBIData(filteredDeals) : null, [filteredDeals]);

  const deltaYoY = biData?.ytd?.['2025'] > 0
    ? ((biData.ytd['2026'] - biData.ytd['2025']) / biData.ytd['2025'] * 100) : null;

  const mtdLabel = useMemo(() => mtdMesi.map(m => MESI_NAMES[m] || m).join(' · '), [mtdMesi]);

  const activeFilterCount = useMemo(() => {
    let count = quickArea ? 1 : 0;
    if (filters.anno) count++;
    if (filters.area_rac) count++;
    if (filters.lob) count++;
    if (filters.attacco_difesa) count++;
    return count;
  }, [filters, quickArea]);

  if (loading) return (
    <div className="min-h-full bg-gray-50">
      <DashboardSkeleton />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <RefreshCw className="w-3 h-3 animate-spin" /> {loadingMsg}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5 min-h-full bg-gray-50">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Business Intelligence</h1>
          <p className="text-sm text-gray-400 mt-0.5">Portafoglio contratti & trattative · 2024 / 2025 / 2026</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm" title="Ricarica dati">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">!</div>
          <div>
            <p className="text-sm font-semibold text-red-700">Errore durante il caricamento</p>
            <p className="text-xs text-red-500 mt-0.5 font-mono">{error}</p>
            <button onClick={loadData} className="mt-2 text-xs text-red-600 underline font-medium hover:text-red-800">Riprova</button>
          </div>
        </div>
      )}

      {hasData === false && !error && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">Nessun dato caricato</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Clicca "Importa Consuntivi" per caricare il file Excel</p>
        </div>
      )}

      {hasData && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <QuickAreaFilter selected={quickArea} onChange={setQuickArea} />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-700 font-semibold">
                  <Activity className="w-3 h-3" /> Like-for-Like ✓
                </span>
                <button onClick={() => setMtdEnabled(v => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${mtdEnabled ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400 hover:text-amber-600'}`}>
                  <BarChart2 className="w-3.5 h-3.5" />
                  Confronto MTD
                  {mtdEnabled && mtdLabel && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/30 text-white text-[10px] font-bold">{mtdLabel}</span>}
                </button>
                <button onClick={() => setShowAdvancedFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${showAdvancedFilters ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                  <Filter className="w-3.5 h-3.5" />
                  Filtri avanzati
                  {activeFilterCount > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{activeFilterCount}</span>}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
                <FilterChip label="Area" value={quickArea} onRemove={() => setQuickArea(null)} />
                <FilterChip label="Anno" value={filters.anno} onRemove={() => setFilters(f => ({ ...f, anno: '' }))} />
                <FilterChip label="LOB" value={filters.lob} onRemove={() => setFilters(f => ({ ...f, lob: '' }))} />
                <FilterChip label="Tipo" value={filters.attacco_difesa} onRemove={() => setFilters(f => ({ ...f, attacco_difesa: '' }))} />
                {activeFilterCount > 1 && (
                  <button onClick={() => { setFilters(EMPTY_FILTERS); setQuickArea(null); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium underline">Rimuovi tutti</button>
                )}
              </div>
            )}
            {showAdvancedFilters && (
              <div className="pt-2 border-t border-gray-100">
                <DealsFilters deals={allDeals} filters={filters} onChange={setFilters} />
              </div>
            )}
          </div>

          {biData && (
            <>
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg">
                {mtdEnabled && mtdLabel && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold">
                      <BarChart2 className="w-3 h-3" /> MTD: {mtdLabel} — confronto stesso periodo
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 divide-x divide-white/10">
                  <InlineKPI label="Portafoglio 2026" value={fmt(biData.ytd['2026'])} delta={deltaYoY} color="blue" />
                  <div className="pl-4"><InlineKPI label="Portafoglio 2025" value={fmt(biData.ytd['2025'])} delta={biData.ytd['2024'] > 0 ? ((biData.ytd['2025'] - biData.ytd['2024']) / biData.ytd['2024'] * 100) : null} color="purple" /></div>
                  <div className="pl-4"><InlineKPI label="Portafoglio 2024" value={fmt(biData.ytd['2024'])} color="gray" /></div>
                  <div className="pl-4"><InlineKPI label="Differenziale 2026" value={fmt(biData.ytd.diff_2026)} color={biData.ytd.diff_2026 >= 0 ? 'green' : 'red'} /></div>
                  <div className="pl-4">
                    <InlineKPI label="Contratti totali" value={biData.total_deals.toLocaleString('it-IT')} color="orange" small />
                    <span className="text-[11px] text-white/40 mt-1 block">{biData.total_2024} '24 · {biData.total_2025} '25 · {biData.total_2026} '26</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="cursor-pointer" onClick={() => setKpiDetail('2026')}><KPICard title="Portafoglio 2026" value={fmt(biData.ytd['2026'])} sub="Clicca per dettaglio" delta={deltaYoY} icon={Euro} color="blue" /></div>
                <div className="cursor-pointer" onClick={() => setKpiDetail('2025')}><KPICard title="Portafoglio 2025" value={fmt(biData.ytd['2025'])} sub={mtdEnabled ? `stesso periodo (${mtdLabel})` : 'Clicca per dettaglio'} icon={Euro} color="purple" /></div>
                <div className="cursor-pointer"><KPICard title="Portafoglio 2024" value={fmt(biData.ytd['2024'])} sub={mtdEnabled ? `stesso periodo (${mtdLabel})` : `${biData.total_2024} contratti`} icon={Euro} color="gray" /></div>
                <div className="cursor-pointer" onClick={() => setKpiDetail('diff')}><KPICard title="Differenziale 2026" value={fmt(biData.ytd.diff_2026)} sub="Clicca per dettaglio" icon={biData.ytd.diff_2026 >= 0 ? TrendingUp : TrendingDown} color={biData.ytd.diff_2026 >= 0 ? 'green' : 'orange'} /></div>
                <div className="cursor-pointer" onClick={() => setKpiDetail('contratti')}><KPICard title="Contratti totali" value={biData.total_deals.toLocaleString('it-IT')} sub="Clicca per dettaglio" icon={FileText} color="orange" /></div>
              </div>

              {biData && <KPIAlertBanner values={{ diff_2026: biData.ytd.diff_2026, ytd_2026: biData.ytd['2026'], diff_2025: biData.ytd.diff_2025 }} />}
              <KPIAnalisi deals={filteredDeals} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Canoni YTD</h3>
                  <div className="space-y-3">
                    {['2024', '2025', '2026'].map(anno => {
                      const val = biData.ytd[`canoni_${anno}`];
                      const max = Math.max(biData.ytd.canoni_2024, biData.ytd.canoni_2025, biData.ytd.canoni_2026);
                      const pct = max > 0 ? (val / max * 100) : 0;
                      return (
                        <div key={anno}>
                          <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{anno}</span><span className="font-bold text-gray-800">{fmt(val)}</span></div>
                          <div className="h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${anno === '2026' ? 'bg-blue-500' : anno === '2025' ? 'bg-purple-400' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-400">Variazione</span>
                      <span className={`text-xs font-bold ${(biData.ytd.canoni_2026 - biData.ytd.canoni_2025) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(biData.ytd.canoni_2026 - biData.ytd.canoni_2025)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mix Attacco / Difesa</h3>
                  <div className="space-y-3">
                    {['2024', '2025', '2026'].map(anno => {
                      const att = biData.attacco[anno] || 0;
                      const dif = biData.difesa[anno] || 0;
                      const tot = att + dif;
                      const pA = tot > 0 ? (att / tot * 100) : 0;
                      return (
                        <div key={anno}>
                          <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{anno}</span><span className="text-gray-400">{fmt(tot)}</span></div>
                          <div className="h-3 rounded-full bg-blue-100 overflow-hidden flex">
                            <div className="h-3 bg-green-500 transition-all" style={{ width: `${pA}%` }} />
                            <div className="h-3 bg-blue-400 flex-1" />
                          </div>
                          <div className="flex justify-between text-[10px] mt-0.5 text-gray-400">
                            <span className="text-green-600">▣ Attacco {pA.toFixed(0)}% ({fmt(att)})</span>
                            <span className="text-blue-500">▣ Difesa {(100 - pA).toFixed(0)}% ({fmt(dif)})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top LOB 2026</h3>
                  <div className="space-y-2">
                    {(() => {
                      const lobs = biData.byYearLob.filter(d => d.anno === '2026' && d.lob && d.lob.trim() !== '').sort((a, b) => b.serv_i_anno - a.serv_i_anno).slice(0, 5);
                      const maxLob = lobs[0]?.serv_i_anno || 1;
                      return lobs.map((l, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1"><span className="text-gray-600 truncate max-w-[140px]">{l.lob}</span><span className="font-bold text-gray-800">{fmt(l.serv_i_anno)}</span></div>
                          <div className="h-1 rounded-full bg-gray-100"><div className="h-1 rounded-full bg-orange-400" style={{ width: `${(l.serv_i_anno / maxLob * 100)}%` }} /></div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ricavi per Area (2025 vs 2026)</h3>
                  <RevenueByAreaChart data={biData.byYearArea} />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Margini per Area (2025 vs 2026)</h3>
                  <MarginByAreaChart data={biData.byYearArea} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Confronto per Area RAC (€ Milioni)</h3>
                  <AreaChart data={biData.byYearArea} />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Mix Ambito 2026</h3>
                  <AmbitoChart data={biData.byYearAmbito} anno="2026" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Evoluzione Mensile — Ricavi e Margini (2025 vs 2026)</h3>
                <MonthlyTrendChart data={filteredDeals} />
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Variazione Portafoglio per Area RAC</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">2024 / 2025 / 2026</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b-2 border-gray-100">
                        <th className="text-left pb-2 font-semibold">Area</th>
                        <th className="text-right pb-2 font-semibold">2024</th>
                        <th className="text-right pb-2 font-semibold">2025</th>
                        <th className="text-right pb-2 font-semibold">2026</th>
                        <th className="text-right pb-2 font-semibold">Diff. 26/25</th>
                        <th className="text-right pb-2 font-semibold">Var %</th>
                        <th className="text-right pb-2 font-semibold">Contratti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {AREAS.map(area => (
                        <AreaRow key={area} area={area}
                          d24={biData.byYearArea.find(d => d.anno === '2024' && d.area_rac === area)}
                          d25={biData.byYearArea.find(d => d.anno === '2025' && d.area_rac === area)}
                          d26={biData.byYearArea.find(d => d.anno === '2026' && d.area_rac === area)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {kpiDetail && <KPIDetailModal kpiType={kpiDetail} deals={filteredDeals} onClose={() => setKpiDetail(null)} />}
    </div>
  );
}
