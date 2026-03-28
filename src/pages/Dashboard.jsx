import { useState, useEffect, useMemo } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import {
  Euro, TrendingUp, TrendingDown, FileText, RefreshCw,
  Filter, X, ChevronDown, BarChart2, Activity, AlertCircle
} from 'lucide-react';
import KPICard from '../components/bi/KPICard';
import KPIAlertBanner from '../components/bi/KPIAlertBanner';
import AreaChart from '../components/bi/AreaChart';
import AmbitoChart from '../components/bi/AmbitoChart';
import KPIAnalisi from '../components/bi/KPIAnalisi';
import DealsFilters, { EMPTY_FILTERS } from '../components/bi/DealsFilters';
import RevenueByAreaChart from '../components/bi/RevenueByAreaChart';
import MarginByAreaChart from '../components/bi/MarginByAreaChart';

function fmt(v) {
  if (!v && v !== 0) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}
function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}
const pct = (a, b) => b > 0 ? ((a - b) / b * 100) : null;

const AREAS = ['MNO','SNO','LNO','MNE','SNE','LNE','MCS','SLCE','SLCS','IC'];

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
      <td className="py-2 pr-3"><span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-xs font-bold text-gray-700 group-hover:bg-blue-100 group-hover:text-blue-800">{area}</span></td>
      <td className="py-2 text-right text-gray-400 text-xs">{s24 > 0 ? fmt(s24) : '—'}</td>
      <td className="py-2 text-right text-xs text-gray-600">{s25 > 0 ? fmt(s25) : '—'}</td>
      <td className="py-2 text-right">
        <span className="text-sm font-bold text-gray-800">{s26 > 0 ? fmt(s26) : '—'}</span>
        <div className="h-1 rounded-full bg-gray-100 mt-0.5">
          <div className={`h-1 rounded-full ${diff >= 0 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${s26 / maxVal * 100}%` }} />
        </div>
      </td>
      <td className={`py-2 text-right text-sm font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(diff)}</td>
      <td className={`py-2 text-right text-xs font-bold ${varPct === null ? 'text-gray-300' : varPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>{varPct === null ? '—' : fmtPct(varPct)}</td>
      <td className="py-2 text-right text-xs text-gray-400">{(d24?.n||0)+(d25?.n||0)+(d26?.n||0)}</td>
    </tr>
  );
}

function Skeleton({ className }) { return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />; }

export default function Dashboard() {
  const { aggregati, loading, hasAggregati, reload } = useData();
  const [aggregating, setAggregating] = useState(false);
  const [quickArea, setQuickArea] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [mtdEnabled, setMtdEnabled] = useState(false);

  const ag24 = aggregati?.['2024'];
  const ag25 = aggregati?.['2025'];
  const ag26 = aggregati?.['2026'];

  // Filtra byArea per area selezionata
  const getArea = (ag, area) => ag?.byArea?.find(a => a.area === area);
  const filterByArea = (ag) => {
    if (!ag) return null;
    if (!quickArea) return ag;
    return {
      ...ag,
      kpi: (() => {
        const a = ag.byArea?.find(x => x.area === quickArea);
        return a ? { ...ag.kpi, serv: a.serv, canoni: a.canoni, diff: a.diff, att: a.att, dif: a.dif, n: a.n } : ag.kpi;
      })(),
    };
  };

  const ag24f = filterByArea(ag24);
  const ag25f = filterByArea(ag25);
  const ag26f = filterByArea(ag26);

  // LOB data per grafici
  const byAreaData = useMemo(() => {
    const areas = [...new Set([
      ...(ag24?.byArea?.map(a => a.area) || []),
      ...(ag25?.byArea?.map(a => a.area) || []),
      ...(ag26?.byArea?.map(a => a.area) || []),
    ])];
    return areas.map(area => ({
      area_rac: area,
      ...Object.fromEntries(['2024','2025','2026'].flatMap(anno => {
        const agg = aggregati?.[anno]?.byArea?.find(a => a.area === area);
        return [[`serv_${anno}`, agg?.serv || 0], [`diff_${anno}`, agg?.diff || 0], [`canoni_${anno}`, agg?.canoni || 0]];
      }))
    }));
  }, [aggregati]);

  const byLobData26 = useMemo(() => ag26?.byLob?.sort((a,b) => b.serv - a.serv) || [], [ag26]);
  const byMeseData = useMemo(() => {
    const mesi25 = ag25?.byMese || [];
    const mesi26 = ag26?.byMese || [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const m25 = mesi25.find(x => x.mese === m);
      const m26 = mesi26.find(x => x.mese === m);
      return { mese: m, serv_2025: m25?.serv || 0, serv_2026: m26?.serv || 0, diff_2025: m25?.diff || 0, diff_2026: m26?.diff || 0 };
    }).filter(m => m.serv_2025 > 0 || m.serv_2026 > 0);
  }, [ag25, ag26]);

  const delta2625 = pct(ag26f?.kpi?.serv, ag25f?.kpi?.serv);
  const delta2524 = pct(ag25f?.kpi?.serv, ag24f?.kpi?.serv);

  const triggerAggregation = async () => {
    setAggregating(true);
    try {
      const fn = httpsCallable(functionsInstance, 'aggregateDeals');
      await fn({});
      await reload();
    } catch (e) {
      console.error('Aggregation error:', e);
    } finally {
      setAggregating(false);
    }
  };

  if (loading) return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="flex justify-between items-center">
        <div className="space-y-2"><Skeleton className="h-7 w-72" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-32" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      <Skeleton className="h-64" />
    </div>
  );

  if (!hasAggregati) return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col items-center justify-center gap-4 text-center">
      <AlertCircle className="w-12 h-12 text-amber-400" />
      <h2 className="text-lg font-bold text-gray-700">Aggregati non disponibili</h2>
      <p className="text-sm text-gray-500 max-w-md">
        I dati aggregati non sono ancora stati calcolati. Clicca il pulsante per calcolarli ora
        (operazione da fare una sola volta dopo ogni import).
      </p>
      <button onClick={triggerAggregation} disabled={aggregating}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
        {aggregating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Calcolo in corso...</> : '⚡ Calcola aggregati ora'}
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-5 min-h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Business Intelligence</h1>
          <p className="text-sm text-gray-400 mt-0.5">Portafoglio 2024 · 2025 · 2026</p>
        </div>
        <div className="flex gap-2">
          <button onClick={triggerAggregation} disabled={aggregating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${aggregating ? 'animate-spin' : ''}`} />
            {aggregating ? 'Aggiornamento...' : 'Aggiorna aggregati'}
          </button>
        </div>
      </div>

      {/* Quick area filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setQuickArea(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${!quickArea ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            Tutte le aree
          </button>
          {AREAS.map(a => (
            <button key={a} onClick={() => setQuickArea(quickArea === a ? null : a)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${quickArea === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}>
              {a}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-700 font-semibold">
            <Activity className="w-3 h-3" /> Dati aggiornati
          </span>
        </div>
      </div>

      {/* KPI Hero */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 divide-x divide-white/10">
          <InlineKPI label="Portafoglio 2026" value={fmt(ag26f?.kpi?.serv)} delta={delta2625} color="blue" />
          <div className="pl-4"><InlineKPI label="Portafoglio 2025" value={fmt(ag25f?.kpi?.serv)} delta={delta2524} color="purple" /></div>
          <div className="pl-4"><InlineKPI label="Portafoglio 2024" value={fmt(ag24f?.kpi?.serv)} color="gray" /></div>
          <div className="pl-4"><InlineKPI label="Differenziale 2026" value={fmt(ag26f?.kpi?.diff)} color={(ag26f?.kpi?.diff||0) >= 0 ? 'green' : 'red'} /></div>
          <div className="pl-4">
            <InlineKPI label="Deal totali" value={((ag24f?.kpi?.n||0)+(ag25f?.kpi?.n||0)+(ag26f?.kpi?.n||0)).toLocaleString('it-IT')} color="orange" small />
            <span className="text-[11px] text-white/40 mt-1 block">{ag24f?.kpi?.n||0} '24 · {ag25f?.kpi?.n||0} '25 · {ag26f?.kpi?.n||0} '26</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard title="Portafoglio 2026" value={fmt(ag26f?.kpi?.serv)} sub={`${ag26f?.kpi?.n||0} deal`} delta={delta2625} icon={Euro} color="blue" />
        <KPICard title="Portafoglio 2025" value={fmt(ag25f?.kpi?.serv)} sub={`${ag25f?.kpi?.n||0} deal`} icon={Euro} color="purple" />
        <KPICard title="Portafoglio 2024" value={fmt(ag24f?.kpi?.serv)} sub={`${ag24f?.kpi?.n||0} deal`} icon={Euro} color="gray" />
        <KPICard title="Differenziale 2026" value={fmt(ag26f?.kpi?.diff)} sub="vs anno precedente" icon={(ag26f?.kpi?.diff||0) >= 0 ? TrendingUp : TrendingDown} color={(ag26f?.kpi?.diff||0) >= 0 ? 'green' : 'orange'} />
        <KPICard title="Canoni 2026" value={fmt(ag26f?.kpi?.canoni)} sub={`vs ${fmt(ag25f?.kpi?.canoni)} 2025`} icon={FileText} color="orange" />
      </div>

      {/* Alert */}
      <KPIAlertBanner values={{ diff_2026: ag26f?.kpi?.diff, ytd_2026: ag26f?.kpi?.serv, diff_2025: ag25f?.kpi?.diff }} />

      {/* Mix cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Canoni */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Canoni per Anno</h3>
          <div className="space-y-3">
            {[['2024', ag24f], ['2025', ag25f], ['2026', ag26f]].map(([a, ag]) => {
              const val = ag?.kpi?.canoni || 0;
              const max = Math.max(ag24f?.kpi?.canoni||0, ag25f?.kpi?.canoni||0, ag26f?.kpi?.canoni||0, 1);
              return (
                <div key={a}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{a}</span><span className="font-bold text-gray-800">{fmt(val)}</span></div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div className={`h-1.5 rounded-full ${a==='2026'?'bg-blue-500':a==='2025'?'bg-purple-400':'bg-gray-400'}`} style={{width:`${val/max*100}%`}} />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between pt-2 border-t border-gray-100 text-xs">
              <span className="text-gray-400">Var 25→26</span>
              <span className={`font-bold ${((ag26f?.kpi?.canoni||0)-(ag25f?.kpi?.canoni||0))>=0?'text-green-600':'text-red-500'}`}>
                {fmt((ag26f?.kpi?.canoni||0)-(ag25f?.kpi?.canoni||0))}
              </span>
            </div>
          </div>
        </div>

        {/* Attacco / Difesa */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mix Attacco / Difesa</h3>
          <div className="space-y-3">
            {[['2024', ag24f], ['2025', ag25f], ['2026', ag26f]].map(([a, ag]) => {
              const att = ag?.kpi?.att || 0, dif = ag?.kpi?.dif || 0, tot = att + dif;
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

        {/* Top LOB 2026 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top LOB 2026</h3>
          <div className="space-y-2">
            {byLobData26.filter(l => l.lob && l.lob !== 'N/D').slice(0, 6).map((l, i) => {
              const max = byLobData26[0]?.serv || 1;
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

      {/* Area table */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Variazione per Area RAC</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">2024 · 2025 · 2026</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b-2 border-gray-100">
                <th className="text-left pb-2 font-semibold">Area</th>
                <th className="text-right pb-2 font-semibold">2024</th>
                <th className="text-right pb-2 font-semibold">2025</th>
                <th className="text-right pb-2 font-semibold">2026</th>
                <th className="text-right pb-2 font-semibold">Diff 26/25</th>
                <th className="text-right pb-2 font-semibold">Var %</th>
                <th className="text-right pb-2 font-semibold">Deal</th>
              </tr>
            </thead>
            <tbody>
              {AREAS.map(area => (
                <AreaRow key={area} area={area}
                  d24={ag24?.byArea?.find(a => a.area === area)}
                  d25={ag25?.byArea?.find(a => a.area === area)}
                  d26={ag26?.byArea?.find(a => a.area === area)} />
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
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-semibold">#</th>
                <th className="text-left pb-2 font-semibold">Cliente</th>
                <th className="text-right pb-2 font-semibold">Portafoglio</th>
                <th className="text-right pb-2 font-semibold">Canoni</th>
                <th className="text-right pb-2 font-semibold">Differenziale</th>
                <th className="text-center pb-2 font-semibold">Area</th>
                <th className="text-right pb-2 font-semibold">Deal</th>
              </tr>
            </thead>
            <tbody>
              {(ag26?.topClienti || []).filter(c => !quickArea || c.area === quickArea).slice(0, 20).map((c, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
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
  );
}
