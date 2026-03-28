import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import {
  Euro, TrendingUp, TrendingDown, FileText, RefreshCw,
  Filter, X, ChevronDown, BarChart2, Activity, AlertCircle,
  Zap, ChevronRight, ChevronLeft
} from 'lucide-react';
import KPICard from '../components/bi/KPICard';
import KPIAlertBanner from '../components/bi/KPIAlertBanner';
import AreaChart from '../components/bi/AreaChart';
import AmbitoChart from '../components/bi/AmbitoChart';
import KPIAnalisi from '../components/bi/KPIAnalisi';
import RevenueByAreaChart from '../components/bi/RevenueByAreaChart';
import MarginByAreaChart from '../components/bi/MarginByAreaChart';

// Valori K€ → formato leggibile
function fmt(v) {
  if (!v && v !== 0) return '€0';
  const val = (v || 0) * 1000;
  if (Math.abs(val) >= 1_000_000_000) return `€${(val/1_000_000_000).toFixed(2)}B`;
  if (Math.abs(val) >= 1_000_000) return `€${(val/1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `€${(val/1_000).toFixed(0)}K`;
  return `€${Math.round(val)}`;
}
function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}
const pct = (a, b) => b > 0 ? ((a - b) / b * 100) : null;

const AREAS = ['MNO','SNO','LNO','MNE','SNE','LNE','MCS','SLCE','SLCS','IC'];
const ANNI = ['2024','2025','2026'];
const MESI = ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

// ─── Sidebar Filtri ────────────────────────────────────────────────
function FilterSidebar({ aggregati, portafoglio, filters, onChange, onApply, onReset, collapsed, onToggle }) {
  const [local, setLocal] = useState(filters);

  useEffect(() => { setLocal(filters); }, [filters]);

  const set = (k, v) => setLocal(prev => ({ ...prev, [k]: v }));

  // Valori unici dal portafoglio
  const uniq = (field) => [...new Set(portafoglio.map(c => c[field]).filter(Boolean))].sort();

  const mesi26 = useMemo(() => {
    const ag26 = aggregati?.['2026'];
    return (ag26?.byMese || []).map(m => m.mese).sort((a,b)=>a-b);
  }, [aggregati]);

  const hasFilters = Object.values(local).some(v => v && v !== '');

  if (collapsed) return (
    <div className="w-10 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-3">
      <button onClick={onToggle} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
        <ChevronRight className="w-4 h-4" />
      </button>
      <Filter className="w-4 h-4 text-gray-300" />
    </div>
  );

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-gray-800">Filtri</span>
          {hasFilters && <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
            {Object.values(local).filter(v => v && v !== '').length}
          </span>}
        </div>
        <button onClick={onToggle} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Filtri */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Anno */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Anno</label>
          <div className="flex gap-1">
            {['tutti', ...ANNI].map(a => (
              <button key={a} onClick={() => set('anno', a === 'tutti' ? '' : a)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${local.anno === (a === 'tutti' ? '' : a) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                {a === 'tutti' ? 'Tutti' : a}
              </button>
            ))}
          </div>
        </div>

        {/* Mese */}
        {mesi26.length > 0 && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Mese</label>
            <select value={local.mese || ''} onChange={e => set('mese', e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tutti i mesi</option>
              {mesi26.map(m => <option key={m} value={m}>{MESI[m]}</option>)}
            </select>
          </div>
        )}

        {/* Area RAC */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Area RAC</label>
          <div className="flex flex-wrap gap-1">
            {AREAS.map(a => (
              <button key={a} onClick={() => set('area_rac', local.area_rac === a ? '' : a)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${local.area_rac === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* LOB */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">LOB</label>
          <div className="flex flex-wrap gap-1">
            {['Cloud','Connettività','IoT','Other IT','Licensing','Security'].map(l => (
              <button key={l} onClick={() => set('lob', local.lob === l ? '' : l)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${local.lob === l ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Attacco/Difesa */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Tipo</label>
          <div className="flex gap-1">
            {['','Attacco','Difesa'].map(t => (
              <button key={t} onClick={() => set('attacco_difesa', t)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${local.attacco_difesa === t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'}`}>
                {t || 'Tutti'}
              </button>
            ))}
          </div>
        </div>

        {/* Divider — filtri anagrafica */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Da Anagrafica</p>
        </div>

        {/* RAC 26 */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">RAC 26</label>
          <select value={local.rac_26 || ''} onChange={e => set('rac_26', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutti i RAC</option>
            {uniq('rac_26').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Area AM 26 */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Area AM 26</label>
          <select value={local.area_am_26 || ''} onChange={e => set('area_am_26', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutte le aree AM</option>
            {uniq('area_am_26').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Area MNG 26 */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Area MNG 26</label>
          <select value={local.area_mng_26 || ''} onChange={e => set('area_mng_26', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutte le aree MNG</option>
            {uniq('area_mng_26').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Struttura Sales Core 26 */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Struttura Sales Core</label>
          <select value={local.struttura_sales_26 || ''} onChange={e => set('struttura_sales_26', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutte</option>
            {uniq('struttura_sales_26').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Area MNG Spec */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Area MNG Spec</label>
          <select value={local.area_mng_spec_26 || ''} onChange={e => set('area_mng_spec_26', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutte</option>
            {uniq('area_mng_spec_26').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Specialist LSS */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Specialist LSS</label>
          <select value={local.specialist_lss || ''} onChange={e => set('specialist_lss', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutti</option>
            {uniq('acc_specialist_lss').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Specialist SEC */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Specialist SEC</label>
          <select value={local.specialist_sec || ''} onChange={e => set('specialist_sec', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutti</option>
            {uniq('acc_specialist_sec').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Specialist Cloud/IoT/5G */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Specialist Cloud/IoT/5G</label>
          <select value={local.specialist_cloud || ''} onChange={e => set('specialist_cloud', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutti</option>
            {uniq('acc_specialist_cloud_iot_5g').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* IoT */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">IoT Specialist</label>
          <select value={local.iot || ''} onChange={e => set('iot', e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tutti</option>
            {uniq('iot').map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        <button onClick={() => onApply(local)}
          className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">
          Applica filtri
        </button>
        {hasFilters && (
          <button onClick={() => { const empty = Object.fromEntries(Object.keys(local).map(k => [k, ''])); setLocal(empty); onReset(); }}
            className="w-full py-1.5 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            Rimuovi tutti i filtri
          </button>
        )}
      </div>
    </div>
  );
}

function InlineKPI({ label, value, delta, color = 'gray', small = false }) {
  const colors = { blue: 'text-blue-400', green: 'text-green-400', red: 'text-red-400', orange: 'text-orange-400', purple: 'text-purple-400', gray: 'text-gray-300' };
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 font-medium mb-0.5">{label}</span>
      <span className={`${small ? 'text-lg' : 'text-2xl'} font-black ${colors[color]} leading-none`}>{value}</span>
      {delta !== null && delta !== undefined && (
        <span className={`text-xs font-semibold mt-0.5 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% YoY
        </span>
      )}
    </div>
  );
}

function AreaRow({ area, d24, d25, d26 }) {
  const s24 = d24?.serv || 0, s25 = d25?.serv || 0, s26 = d26?.serv || 0;
  if (!s24 && !s25 && !s26) return null;
  const diff = s26 - s25;
  const varPct = s25 > 0 ? (diff / s25 * 100) : null;
  const maxVal = Math.max(s24, s25, s26, 1);
  return (
    <tr className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
      <td className="py-2 pr-3"><span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-xs font-bold text-gray-700">{area}</span></td>
      <td className="py-2 text-right text-gray-400 text-xs">{s24 > 0 ? fmt(s24) : '—'}</td>
      <td className="py-2 text-right text-xs text-gray-600">{s25 > 0 ? fmt(s25) : '—'}</td>
      <td className="py-2 text-right">
        <span className="text-sm font-bold text-gray-800">{s26 > 0 ? fmt(s26) : '—'}</span>
        <div className="h-1 rounded-full bg-gray-100 mt-0.5">
          <div className={`h-1 rounded-full ${diff >= 0 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${s26/maxVal*100}%` }} />
        </div>
      </td>
      <td className={`py-2 text-right text-sm font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(diff)}</td>
      <td className={`py-2 text-right text-xs font-bold ${varPct === null ? 'text-gray-300' : varPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>{varPct === null ? '—' : fmtPct(varPct)}</td>
      <td className="py-2 text-right text-xs text-gray-400">{(d24?.n||0)+(d25?.n||0)+(d26?.n||0)}</td>
    </tr>
  );
}

function Skeleton({ className }) { return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />; }

// ─── MAIN ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { aggregati, loading, hasAggregati, reload } = useData();

  // Portafoglio clienti per filtri anagrafica
  const [portafoglio, setPortafoglio] = useState([]);
  const [portafoglioMap, setPortafoglioMap] = useState({}); // ragione_sociale → record

  // Filtri
  const EMPTY_FILTERS = { anno: '', mese: '', area_rac: '', lob: '', attacco_difesa: '', rac_26: '', area_am_26: '', area_mng_26: '', struttura_sales_26: '', area_mng_spec_26: '', specialist_lss: '', specialist_sec: '', specialist_cloud: '', iot: '' };
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aggregating, setAggregating] = useState(false);

  useEffect(() => {
    loadPortafoglio();
  }, []);

  const loadPortafoglio = async () => {
    try {
      const snap = await getDocs(collection(db, 'portafoglio_clienti'));
      const docs = snap.docs.map(d => d.data());
      setPortafoglio(docs);
      // Mappa ragione_sociale → record portafoglio
      const map = {};
      docs.forEach(c => {
        if (c.ragione_sociale) map[c.ragione_sociale.toLowerCase().trim()] = c;
        if (c.capogruppo) map[c.capogruppo.toLowerCase().trim()] = c;
      });
      setPortafoglioMap(map);
    } catch (e) { console.error(e); }
  };

  // Arricchisce i deal con i dati del portafoglio
  const enrichDeal = (deal) => {
    const key = (deal.ragione_sociale_capogruppo || deal.ragione_sociale || '').toLowerCase().trim();
    const ptf = portafoglioMap[key];
    return ptf ? { ...deal, _ptf: ptf } : deal;
  };

  // Applica filtri agli aggregati
  const computeFilteredKPI = useMemo(() => {
    if (!aggregati) return null;
    const f = appliedFilters;
    const hasAnagraficaFilter = f.rac_26 || f.area_am_26 || f.area_mng_26 || f.struttura_sales_26 || f.area_mng_spec_26 || f.specialist_lss || f.specialist_sec || f.specialist_cloud || f.iot;

    // Se non ci sono filtri anagrafica, usa aggregati diretti
    if (!hasAnagraficaFilter && !f.anno && !f.mese && !f.area_rac && !f.lob && !f.attacco_difesa) {
      return {
        useAggregati: true,
        ag24: aggregati['2024'],
        ag25: aggregati['2025'],
        ag26: aggregati['2026'],
      };
    }

    // Con filtri, dobbiamo filtrare i clienti del portafoglio e restituire un set filtrato
    let clientiAmmessi = null;
    if (hasAnagraficaFilter) {
      clientiAmmessi = new Set(
        portafoglio
          .filter(c =>
            (!f.rac_26 || c.rac_26 === f.rac_26) &&
            (!f.area_am_26 || c.area_am_26 === f.area_am_26) &&
            (!f.area_mng_26 || c.area_mng_26 === f.area_mng_26) &&
            (!f.struttura_sales_26 || c.struttura_sales_26 === f.struttura_sales_26) &&
            (!f.area_mng_spec_26 || c.area_mng_spec_26 === f.area_mng_spec_26) &&
            (!f.specialist_lss || c.acc_specialist_lss === f.specialist_lss) &&
            (!f.specialist_sec || c.acc_specialist_sec === f.specialist_sec) &&
            (!f.specialist_cloud || c.acc_specialist_cloud_iot_5g === f.specialist_cloud) &&
            (!f.iot || c.iot === f.iot)
          )
          .flatMap(c => [c.ragione_sociale?.toLowerCase().trim(), c.capogruppo?.toLowerCase().trim()])
          .filter(Boolean)
      );
    }

    return { useAggregati: false, clientiAmmessi, filters: f };
  }, [aggregati, appliedFilters, portafoglio, portafoglioMap]);

  // KPI da usare (aggregati o filtrati)
  const getKpi = (anno) => {
    if (!computeFilteredKPI) return null;
    if (computeFilteredKPI.useAggregati) {
      const ag = computeFilteredKPI[`ag${anno.slice(2)}`] || aggregati?.[anno];
      if (!ag) return null;
      const f = appliedFilters;
      if (f.area_rac) {
        const a = ag.byArea?.find(x => x.area === f.area_rac);
        return a ? { serv: a.serv, canoni: a.canoni, diff: a.diff, att: a.att, dif: a.dif, n: a.n } : null;
      }
      if (f.lob) {
        const l = ag.byLob?.find(x => x.lob === f.lob);
        return l ? { serv: l.serv, canoni: l.canoni, diff: 0, att: 0, dif: 0, n: l.n } : null;
      }
      return ag.kpi;
    }
    // Con filtri anagrafica — non possiamo usare aggregati, mostriamo indicazione
    return null;
  };

  const ag24kpi = getKpi('2024');
  const ag25kpi = getKpi('2025');
  const ag26kpi = getKpi('2026');
  const delta2625 = pct(ag26kpi?.serv, ag25kpi?.serv);
  const delta2524 = pct(ag25kpi?.serv, ag24kpi?.serv);

  const byAreaData = useMemo(() => {
    if (!aggregati) return [];
    const areas = [...new Set(ANNI.flatMap(a => aggregati[a]?.byArea?.map(x => x.area) || []))];
    return areas.map(area => ({
      area_rac: area,
      ...Object.fromEntries(ANNI.flatMap(anno => {
        const ag = aggregati[anno];
        const a = ag?.byArea?.find(x => x.area === area);
        return [[`serv_${anno}`, a?.serv||0], [`diff_${anno}`, a?.diff||0], [`canoni_${anno}`, a?.canoni||0]];
      }))
    }));
  }, [aggregati]);

  const byLobData26 = useMemo(() => aggregati?.['2026']?.byLob?.sort((a,b)=>b.serv-a.serv)||[], [aggregati]);

  const hasAnagraficaFilter = Object.entries(appliedFilters).some(([k,v]) => v && ['rac_26','area_am_26','area_mng_26','struttura_sales_26','area_mng_spec_26','specialist_lss','specialist_sec','specialist_cloud','iot'].includes(k));
  const hasAnyFilter = Object.values(appliedFilters).some(v => v && v !== '');

  const triggerAggregation = async () => {
    setAggregating(true);
    try {
      const fn = httpsCallable(functionsInstance, 'aggregateDeals');
      await fn({});
      await reload();
    } catch (e) { console.error(e); }
    setAggregating(false);
  };

  if (loading) return (
    <div className="flex h-full">
      <div className="w-64 bg-white border-r border-gray-100 animate-pulse" />
      <div className="flex-1 p-6 space-y-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    </div>
  );

  if (!hasAggregati) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-full gap-4">
      <AlertCircle className="w-12 h-12 text-amber-400" />
      <h2 className="text-lg font-bold text-gray-700">Aggregati non disponibili</h2>
      <button onClick={triggerAggregation} disabled={aggregating}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
        {aggregating ? 'Calcolo...' : '⚡ Calcola aggregati'}
      </button>
    </div>
  );

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <FilterSidebar
        aggregati={aggregati}
        portafoglio={portafoglio}
        filters={appliedFilters}
        onChange={() => {}}
        onApply={(f) => setAppliedFilters(f)}
        onReset={() => setAppliedFilters(EMPTY_FILTERS)}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Business Intelligence</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Portafoglio 2024 · 2025 · 2026
              {hasAnyFilter && <span className="ml-2 text-blue-500 font-semibold">· Filtri attivi</span>}
              {hasAnagraficaFilter && <span className="ml-1 text-amber-500 text-xs">(KPI da calcolare su dati raw)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {hasAnyFilter && (
              <button onClick={() => setAppliedFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                <X className="w-3.5 h-3.5" /> Rimuovi filtri
              </button>
            )}
            <button onClick={triggerAggregation} disabled={aggregating}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-600">
              {aggregating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {aggregating ? 'Aggiornamento...' : 'Aggiorna'}
            </button>
          </div>
        </div>

        {/* Filtri attivi chips */}
        {hasAnyFilter && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(appliedFilters).filter(([,v]) => v).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                <span className="text-blue-400 capitalize">{k.replace(/_/g,' ')}:</span> {v}
                <button onClick={() => setAppliedFilters(prev => ({ ...prev, [k]: '' }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}

        {/* KPI Hero */}
        {ag26kpi && (
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 divide-x divide-white/10">
              <InlineKPI label="Portafoglio 2026" value={fmt(ag26kpi?.serv)} delta={delta2625} color="blue" />
              <div className="pl-4"><InlineKPI label="Portafoglio 2025" value={fmt(ag25kpi?.serv)} delta={delta2524} color="purple" /></div>
              <div className="pl-4"><InlineKPI label="Portafoglio 2024" value={fmt(ag24kpi?.serv)} color="gray" /></div>
              <div className="pl-4"><InlineKPI label="Differenziale 2026" value={fmt(ag26kpi?.diff)} color={(ag26kpi?.diff||0)>=0?'green':'red'} /></div>
              <div className="pl-4">
                <InlineKPI label="Deal totali" value={((ag24kpi?.n||0)+(ag25kpi?.n||0)+(ag26kpi?.n||0)).toLocaleString('it-IT')} color="orange" small />
              </div>
            </div>
          </div>
        )}

        {hasAnagraficaFilter && !ag26kpi && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
            ⚠️ I filtri per RAC/Specialist richiedono il calcolo sui dati raw. I KPI mostrati sono quelli globali.
            Vai su <strong>Dettaglio</strong> per vedere i dati filtrati per questi campi.
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPICard title="Portafoglio 2026" value={fmt(ag26kpi?.serv)} sub={`${ag26kpi?.n||0} deal`} delta={delta2625} icon={Euro} color="blue" />
          <KPICard title="Portafoglio 2025" value={fmt(ag25kpi?.serv)} sub={`${ag25kpi?.n||0} deal`} icon={Euro} color="purple" />
          <KPICard title="Portafoglio 2024" value={fmt(ag24kpi?.serv)} sub={`${ag24kpi?.n||0} deal`} icon={Euro} color="gray" />
          <KPICard title="Differenziale 2026" value={fmt(ag26kpi?.diff)} sub="vs anno precedente" icon={(ag26kpi?.diff||0)>=0?TrendingUp:TrendingDown} color={(ag26kpi?.diff||0)>=0?'green':'orange'} />
          <KPICard title="Canoni 2026" value={fmt(ag26kpi?.canoni)} sub={`vs ${fmt(ag25kpi?.canoni)} 2025`} icon={FileText} color="orange" />
        </div>

        <KPIAlertBanner values={{ diff_2026: ag26kpi?.diff, ytd_2026: ag26kpi?.serv, diff_2025: ag25kpi?.diff }} />

        {/* Mix cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canoni */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Canoni per Anno</h3>
            <div className="space-y-3">
              {ANNI.map(a => {
                const kpi = getKpi(a);
                const maxC = Math.max(...ANNI.map(x => getKpi(x)?.canoni||0), 1);
                return (
                  <div key={a}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{a}</span><span className="font-bold text-gray-800">{fmt(kpi?.canoni||0)}</span></div>
                    <div className="h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${a==='2026'?'bg-blue-500':a==='2025'?'bg-purple-400':'bg-gray-400'}`} style={{width:`${(kpi?.canoni||0)/maxC*100}%`}} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attacco/Difesa */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mix Attacco / Difesa</h3>
            <div className="space-y-3">
              {ANNI.map(a => {
                const kpi = getKpi(a);
                const att = kpi?.att||0, dif = kpi?.dif||0, tot = att+dif;
                const pA = tot > 0 ? (att/tot*100) : 0;
                return (
                  <div key={a}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{a}</span><span className="text-gray-400">{fmt(tot)}</span></div>
                    <div className="h-3 rounded-full bg-blue-100 overflow-hidden flex">
                      <div className="h-3 bg-green-500" style={{width:`${pA}%`}} />
                      <div className="h-3 bg-blue-400 flex-1" />
                    </div>
                    <div className="flex justify-between text-[10px] mt-0.5 text-gray-400">
                      <span className="text-green-600">▣ Att {pA.toFixed(0)}%</span>
                      <span className="text-blue-500">▣ Dif {(100-pA).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top LOB */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top LOB 2026</h3>
            <div className="space-y-2">
              {byLobData26.filter(l=>l.lob&&l.lob!=='N/D').slice(0,6).map((l,i)=>{
                const max = byLobData26[0]?.serv||1;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-600 truncate max-w-[140px]">{l.lob}</span><span className="font-bold text-gray-800">{fmt(l.serv)}</span></div>
                    <div className="h-1 rounded-full bg-gray-100"><div className="h-1 rounded-full bg-orange-400" style={{width:`${l.serv/max*100}%`}} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grafici */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ricavi per Area (2025 vs 2026)</h3>
            <RevenueByAreaChart data={byAreaData} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Margini per Area (2025 vs 2026)</h3>
            <MarginByAreaChart data={byAreaData} />
          </div>
        </div>

        {/* Tabella aree */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Variazione per Area RAC</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">2024 · 2025 · 2026</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b-2 border-gray-100">
                <th className="text-left pb-2 font-semibold">Area</th>
                <th className="text-right pb-2 font-semibold">2024</th>
                <th className="text-right pb-2 font-semibold">2025</th>
                <th className="text-right pb-2 font-semibold">2026</th>
                <th className="text-right pb-2 font-semibold">Diff 26/25</th>
                <th className="text-right pb-2 font-semibold">Var %</th>
                <th className="text-right pb-2 font-semibold">Deal</th>
              </tr></thead>
              <tbody>
                {AREAS.map(area => (
                  <AreaRow key={area} area={area}
                    d24={aggregati?.['2024']?.byArea?.find(a=>a.area===area)}
                    d25={aggregati?.['2025']?.byArea?.find(a=>a.area===area)}
                    d26={aggregati?.['2026']?.byArea?.find(a=>a.area===area)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top clienti */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top 20 Clienti 2026</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-semibold">#</th>
                <th className="text-left pb-2 font-semibold">Cliente</th>
                <th className="text-right pb-2 font-semibold">Portafoglio</th>
                <th className="text-right pb-2 font-semibold">Canoni</th>
                <th className="text-right pb-2 font-semibold">Differenziale</th>
                <th className="text-center pb-2 font-semibold">Area</th>
                <th className="text-right pb-2 font-semibold">Deal</th>
              </tr></thead>
              <tbody>
                {(aggregati?.['2026']?.topClienti||[])
                  .filter(c => {
                    if (!appliedFilters.area_rac) return true;
                    return c.area === appliedFilters.area_rac;
                  })
                  .slice(0, 20)
                  .map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30">
                    <td className="py-2 text-gray-400">{i+1}</td>
                    <td className="py-2 font-medium text-gray-800 max-w-[180px] truncate">{c.nome}</td>
                    <td className="py-2 text-right font-semibold text-gray-800">{fmt(c.serv)}</td>
                    <td className="py-2 text-right text-gray-600">{fmt(c.canoni)}</td>
                    <td className={`py-2 text-right font-medium ${(c.diff||0)>=0?'text-green-600':'text-red-500'}`}>{fmt(c.diff)}</td>
                    <td className="py-2 text-center"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{c.area}</span></td>
                    <td className="py-2 text-right text-gray-500">{c.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
