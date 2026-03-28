import { useState, useMemo } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import {
  Euro, TrendingUp, TrendingDown, FileText,
  RefreshCw, Filter, X, Zap, AlertCircle,
  ChevronLeft, ChevronRight, Loader2, BarChart2
} from 'lucide-react';
import KPICard from '../components/bi/KPICard';
import KPIAlertBanner from '../components/bi/KPIAlertBanner';
import RevenueByAreaChart from '../components/bi/RevenueByAreaChart';
import MarginByAreaChart from '../components/bi/MarginByAreaChart';

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
const EMPTY = {
  anno:'', mese:'', area_rac:'', lob:'', attacco_difesa:'',
  rac_26:'', area_am_26:'', area_mng_26:'', struttura_sales_26:'',
  area_mng_spec_26:'', specialist_lss:'', specialist_sec:'',
  specialist_cloud:'', iot:''
};
const ANAGRAFICA_KEYS = ['rac_26','area_am_26','area_mng_26','struttura_sales_26','area_mng_spec_26','specialist_lss','specialist_sec','specialist_cloud','iot'];

function computeKPI(deals) {
  if (!deals.length) return { serv:0, canoni:0, diff:0, att:0, dif:0, n:0, ctr:0, ttv:0 };
  return {
    n: deals.length,
    serv: deals.reduce((s,d) => s+(d.serv_i_anno||0), 0),
    canoni: deals.reduce((s,d) => s+(d.canoni||0), 0),
    diff: deals.reduce((s,d) => s+(d.differenziale_servizi||0), 0),
    att: deals.filter(d=>d.attacco_difesa==='Attacco').reduce((s,d)=>s+(d.serv_i_anno||0),0),
    dif: deals.filter(d=>d.attacco_difesa!=='Attacco').reduce((s,d)=>s+(d.serv_i_anno||0),0),
    ctr: deals.filter(d=>d.tipo==='CTR').length,
    ttv: deals.filter(d=>d.tipo==='TTV').length,
  };
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function FilterSidebar({ portafoglio, aggregati, filters, onChange, onReset, collapsed, onToggle }) {
  const uniq = (field) => [...new Set(portafoglio.map(c => c[field]).filter(Boolean))].sort();
  const mesi26 = (aggregati?.['2026']?.byMese || []).map(m => m.mese).sort((a,b)=>a-b);
  const activeCount = Object.values(filters).filter(Boolean).length;

  if (collapsed) return (
    <div className="w-10 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-3 flex-shrink-0">
      <button onClick={onToggle} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="w-4 h-4" /></button>
      <Filter className="w-4 h-4 text-gray-300" />
      {activeCount > 0 && <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{activeCount}</span>}
    </div>
  );

  const sel = (key, placeholder, field) => (
    <select value={filters[key]||''} onChange={e => onChange(key, e.target.value)}
      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
      <option value="">{placeholder}</option>
      {uniq(field||key).map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  );

  return (
    <div className="w-60 bg-white border-r border-gray-100 flex flex-col flex-shrink-0" style={{height:'100%'}}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-gray-800">Filtri</span>
          {activeCount > 0 && <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{activeCount}</span>}
        </div>
        <button onClick={onToggle} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Section label="Anno">
          <div className="flex gap-1">
            {['', ...ANNI].map(a => (
              <button key={a} onClick={() => onChange('anno', a)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${filters.anno===a?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                {a||'Tutti'}
              </button>
            ))}
          </div>
        </Section>

        {mesi26.length > 0 && (
          <Section label="Mese">
            <select value={filters.mese||''} onChange={e=>onChange('mese',e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Tutti i mesi</option>
              {mesi26.map(m=><option key={m} value={m}>{MESI[m]}</option>)}
            </select>
          </Section>
        )}

        <Section label="Area RAC">
          <div className="flex flex-wrap gap-1">
            {AREAS.map(a => (
              <button key={a} onClick={() => onChange('area_rac', filters.area_rac===a?'':a)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${filters.area_rac===a?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                {a}
              </button>
            ))}
          </div>
        </Section>

        <Section label="LOB">
          <div className="flex flex-wrap gap-1">
            {['Cloud','Connettività','IoT','Other IT','Licensing','Security'].map(l => (
              <button key={l} onClick={() => onChange('lob', filters.lob===l?'':l)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${filters.lob===l?'bg-orange-500 text-white border-orange-500':'bg-white text-gray-500 border-gray-200 hover:border-orange-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Attacco / Difesa">
          <div className="flex gap-1">
            {[['','Tutti'],['Attacco','Att'],['Difesa','Dif']].map(([v,l]) => (
              <button key={v} onClick={() => onChange('attacco_difesa', v)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${filters.attacco_difesa===v?'bg-green-600 text-white border-green-600':'bg-white text-gray-500 border-gray-200 hover:border-green-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </Section>

        <div className="border-t border-dashed border-blue-200 pt-3">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1">
            <BarChart2 className="w-3 h-3" /> Da Anagrafica
          </p>
        </div>

        <Section label="RAC 26">{sel('rac_26','Tutti i RAC','rac_26')}</Section>
        <Section label="Area AM 26">{sel('area_am_26','Tutte','area_am_26')}</Section>
        <Section label="Area MNG 26">{sel('area_mng_26','Tutte','area_mng_26')}</Section>
        <Section label="Struttura Sales Core">{sel('struttura_sales_26','Tutte','struttura_sales_26')}</Section>
        <Section label="Area MNG Spec">{sel('area_mng_spec_26','Tutte','area_mng_spec_26')}</Section>
        <Section label="Specialist LSS">{sel('specialist_lss','Tutti','acc_specialist_lss')}</Section>
        <Section label="Specialist SEC">{sel('specialist_sec','Tutti','acc_specialist_sec')}</Section>
        <Section label="Specialist Cloud/IoT/5G">{sel('specialist_cloud','Tutti','acc_specialist_cloud_iot_5g')}</Section>
        <Section label="IoT Specialist">{sel('iot','Tutti','iot')}</Section>
      </div>

      {Object.values(filters).some(Boolean) && (
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onReset} className="w-full py-1.5 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50">
            Rimuovi tutti i filtri
          </button>
        </div>
      )}
    </div>
  );
}

function InlineKPI({ label, value, delta, color='gray', small=false }) {
  const colors = { blue:'text-blue-400', green:'text-green-400', red:'text-red-400', orange:'text-orange-400', purple:'text-purple-400', gray:'text-gray-300' };
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 font-medium mb-0.5">{label}</span>
      <span className={`${small?'text-lg':'text-2xl'} font-black ${colors[color]} leading-none`}>{value}</span>
      {delta!==null&&delta!==undefined&&(
        <span className={`text-xs font-semibold mt-0.5 ${delta>=0?'text-green-400':'text-red-400'}`}>
          {delta>=0?'▲':'▼'} {Math.abs(delta).toFixed(1)}% YoY
        </span>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const {
    aggregati, loading, hasAggregati, reload,
    deals, allDeals, dealsLoading, dealsReady, dealsProgress, allReady,
    portafoglio, portafoglioMap,
  } = useData();

  const [filters, setFilters] = useState(EMPTY);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aggregating, setAggregating] = useState(false);

  const hasAnyFilter = Object.values(filters).some(Boolean);
  const hasAnagraficaFilter = ANAGRAFICA_KEYS.some(k => filters[k]);

  const onChange = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));
  const onReset = () => setFilters(EMPTY);

  // Filtra i deal in base a tutti i filtri — istantaneo dalla memoria
  const filteredDeals = useMemo(() => {
    if (!hasAnyFilter) return allDeals;
    const f = filters;
    return allDeals.filter(d => {
      if (f.anno && d.anno !== f.anno) return false;
      if (f.mese && String(d.mese) !== String(f.mese)) return false;
      if (f.area_rac && d.area_rac !== f.area_rac) return false;
      if (f.lob && d.lob !== f.lob) return false;
      if (f.attacco_difesa && d.attacco_difesa !== f.attacco_difesa) return false;
      // Filtri anagrafica — join con portafoglio
      if (hasAnagraficaFilter) {
        const key = (d.ragione_sociale_capogruppo || d.ragione_sociale || '').toLowerCase().trim();
        const ptf = portafoglioMap[key] || {};
        if (f.rac_26 && ptf.rac_26 !== f.rac_26) return false;
        if (f.area_am_26 && ptf.area_am_26 !== f.area_am_26) return false;
        if (f.area_mng_26 && ptf.area_mng_26 !== f.area_mng_26) return false;
        if (f.struttura_sales_26 && ptf.struttura_sales_26 !== f.struttura_sales_26) return false;
        if (f.area_mng_spec_26 && ptf.area_mng_spec_26 !== f.area_mng_spec_26) return false;
        if (f.specialist_lss && ptf.acc_specialist_lss !== f.specialist_lss) return false;
        if (f.specialist_sec && ptf.acc_specialist_sec !== f.specialist_sec) return false;
        if (f.specialist_cloud && ptf.acc_specialist_cloud_iot_5g !== f.specialist_cloud) return false;
        if (f.iot && ptf.iot !== f.iot) return false;
      }
      return true;
    });
  }, [allDeals, filters, hasAnyFilter, hasAnagraficaFilter, portafoglioMap]);

  // KPI calcolati dai deal filtrati (o dagli aggregati se nessun filtro)
  const kpiData = useMemo(() => {
    if (!hasAnyFilter && aggregati) {
      // Usa aggregati pre-calcolati
      return {
        source: 'aggregati',
        kpi: { '2024': aggregati['2024']?.kpi, '2025': aggregati['2025']?.kpi, '2026': aggregati['2026']?.kpi },
        byLob: aggregati['2026']?.byLob || [],
        topClienti: aggregati['2026']?.topClienti || [],
        byArea: null,
      };
    }
    if (!allReady && hasAnagraficaFilter) return null; // aspetta raw deals

    // Calcola da raw deals
    const byAnno = {};
    ANNI.forEach(anno => {
      const d = filteredDeals.filter(x => x.anno === anno);
      byAnno[anno] = computeKPI(d);
    });

    const d26 = filteredDeals.filter(x => x.anno === '2026');

    // byLob
    const lobMap = {};
    d26.forEach(d => {
      const k = d.lob||'N/D';
      if (!lobMap[k]) lobMap[k] = { lob:k, serv:0, canoni:0, n:0 };
      lobMap[k].serv += d.serv_i_anno||0;
      lobMap[k].canoni += d.canoni||0;
      lobMap[k].n++;
    });

    // topClienti
    const cMap = {};
    d26.forEach(d => {
      const k = d.ragione_sociale_capogruppo||d.ragione_sociale||'N/D';
      if (!cMap[k]) cMap[k] = { nome:k, area:d.area_rac||'', serv:0, canoni:0, diff:0, n:0 };
      cMap[k].serv += d.serv_i_anno||0;
      cMap[k].canoni += d.canoni||0;
      cMap[k].diff += d.differenziale_servizi||0;
      cMap[k].n++;
    });

    // byArea per grafico
    const areaMap = {};
    filteredDeals.forEach(d => {
      const area = d.area_rac||'N/D';
      const anno = d.anno;
      if (!areaMap[area]) areaMap[area] = { area_rac: area };
      areaMap[area][`serv_${anno}`] = (areaMap[area][`serv_${anno}`]||0) + (d.serv_i_anno||0);
      areaMap[area][`diff_${anno}`] = (areaMap[area][`diff_${anno}`]||0) + (d.differenziale_servizi||0);
      areaMap[area][`canoni_${anno}`] = (areaMap[area][`canoni_${anno}`]||0) + (d.canoni||0);
    });

    return {
      source: 'raw',
      kpi: byAnno,
      byLob: Object.values(lobMap).sort((a,b)=>b.serv-a.serv),
      topClienti: Object.values(cMap).sort((a,b)=>b.serv-a.serv).slice(0,20),
      byArea: Object.values(areaMap),
    };
  }, [filteredDeals, aggregati, hasAnyFilter, hasAnagraficaFilter, allReady]);

  // byAreaData per grafici
  const byAreaData = useMemo(() => {
    if (kpiData?.byArea) return kpiData.byArea;
    if (!aggregati) return [];
    const areas = [...new Set(ANNI.flatMap(a => aggregati[a]?.byArea?.map(x=>x.area)||[]))];
    return areas.map(area => ({
      area_rac: area,
      ...Object.fromEntries(ANNI.flatMap(anno => {
        const a = aggregati[anno]?.byArea?.find(x=>x.area===area);
        return [[`serv_${anno}`,a?.serv||0],[`diff_${anno}`,a?.diff||0],[`canoni_${anno}`,a?.canoni||0]];
      }))
    }));
  }, [kpiData, aggregati]);

  const ag26 = kpiData?.kpi?.['2026'];
  const ag25 = kpiData?.kpi?.['2025'];
  const ag24 = kpiData?.kpi?.['2024'];
  const delta2625 = pct(ag26?.serv, ag25?.serv);
  const delta2524 = pct(ag25?.serv, ag24?.serv);

  const byLob26 = kpiData?.byLob || [];
  const topClienti = kpiData?.topClienti || [];

  const triggerAggregation = async () => {
    setAggregating(true);
    try {
      const fn = httpsCallable(functionsInstance, 'aggregateDeals');
      await fn({});
      await reload();
    } catch(e) { console.error(e); }
    setAggregating(false);
  };

  if (loading) return (
    <div className="flex h-full">
      <div className="w-60 bg-white border-r border-gray-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 p-6 space-y-4">{[...Array(5)].map((_,i)=><div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}</div>
    </div>
  );

  if (!hasAggregati) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-full gap-4">
      <AlertCircle className="w-12 h-12 text-amber-400" />
      <h2 className="text-lg font-bold text-gray-700">Aggregati non disponibili</h2>
      <button onClick={triggerAggregation} disabled={aggregating}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
        {aggregating?'Calcolo...':'⚡ Calcola aggregati'}
      </button>
    </div>
  );

  return (
    <div className="flex bg-gray-50 overflow-hidden" style={{height:'100vh'}}>
      <FilterSidebar
        portafoglio={portafoglio}
        aggregati={aggregati}
        filters={filters}
        onChange={onChange}
        onReset={onReset}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v=>!v)}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Business Intelligence</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
              Portafoglio 2024 · 2025 · 2026
              {kpiData?.source==='raw' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Raw · {filteredDeals.length.toLocaleString('it-IT')} deal</span>}
              {!allReady && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {ANNI.map(a => !dealsReady[a] && dealsLoading[a] ? `${a}: ${(dealsProgress[a]||0).toLocaleString('it-IT')}...` : null).filter(Boolean).join(' ')}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {hasAnyFilter && (
              <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                <X className="w-3.5 h-3.5" /> Rimuovi filtri
              </button>
            )}
            <button onClick={triggerAggregation} disabled={aggregating}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-600">
              {aggregating?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:<Zap className="w-3.5 h-3.5"/>}
              Aggiorna
            </button>
          </div>
        </div>

        {/* Chips filtri attivi */}
        {hasAnyFilter && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(filters).filter(([,v])=>v).map(([k,v])=>(
              <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                <span className="text-blue-400">{k.replace(/_/g,' ')}:</span>{v}
                <button onClick={()=>onChange(k,'')} className="hover:text-red-500 ml-0.5"><X className="w-3 h-3"/></button>
              </span>
            ))}
          </div>
        )}

        {/* Avviso raw not ready */}
        {hasAnagraficaFilter && !allReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Caricamento dati in corso...</p>
              <p className="text-xs text-amber-500">I KPI si aggiorneranno appena i dati raw sono pronti</p>
            </div>
          </div>
        )}

        {/* KPI Hero */}
        {ag26 && (
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 divide-x divide-white/10">
              <InlineKPI label="Portafoglio 2026" value={fmt(ag26?.serv)} delta={delta2625} color="blue" />
              <div className="pl-4"><InlineKPI label="Portafoglio 2025" value={fmt(ag25?.serv)} delta={delta2524} color="purple" /></div>
              <div className="pl-4"><InlineKPI label="Portafoglio 2024" value={fmt(ag24?.serv)} color="gray" /></div>
              <div className="pl-4"><InlineKPI label="Differenziale 2026" value={fmt(ag26?.diff)} color={(ag26?.diff||0)>=0?'green':'red'} /></div>
              <div className="pl-4">
                <InlineKPI label="Deal totali" value={((ag24?.n||0)+(ag25?.n||0)+(ag26?.n||0)).toLocaleString('it-IT')} color="orange" small />
                <span className="text-[10px] text-white/40 mt-1 block">{ag24?.n||0} '24 · {ag25?.n||0} '25 · {ag26?.n||0} '26</span>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPICard title="Portafoglio 2026" value={fmt(ag26?.serv)} sub={`${ag26?.n||0} deal`} delta={delta2625} icon={Euro} color="blue" />
          <KPICard title="Portafoglio 2025" value={fmt(ag25?.serv)} sub={`${ag25?.n||0} deal`} icon={Euro} color="purple" />
          <KPICard title="Portafoglio 2024" value={fmt(ag24?.serv)} sub={`${ag24?.n||0} deal`} icon={Euro} color="gray" />
          <KPICard title="Differenziale 2026" value={fmt(ag26?.diff)} sub="vs anno precedente" icon={(ag26?.diff||0)>=0?TrendingUp:TrendingDown} color={(ag26?.diff||0)>=0?'green':'orange'} />
          <KPICard title="Canoni 2026" value={fmt(ag26?.canoni)} sub={`vs ${fmt(ag25?.canoni)} 2025`} icon={FileText} color="orange" />
        </div>

        <KPIAlertBanner values={{ diff_2026:ag26?.diff, ytd_2026:ag26?.serv, diff_2025:ag25?.diff }} />

        {/* Mix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Canoni per Anno</h3>
            <div className="space-y-3">
              {ANNI.map(a => {
                const k = kpiData?.kpi?.[a];
                const maxC = Math.max(...ANNI.map(x=>kpiData?.kpi?.[x]?.canoni||0),1);
                return (<div key={a}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{a}</span><span className="font-bold text-gray-800">{fmt(k?.canoni||0)}</span></div>
                  <div className="h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${a==='2026'?'bg-blue-500':a==='2025'?'bg-purple-400':'bg-gray-400'}`} style={{width:`${(k?.canoni||0)/maxC*100}%`}}/></div>
                </div>);
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mix Attacco / Difesa</h3>
            <div className="space-y-3">
              {ANNI.map(a => {
                const k = kpiData?.kpi?.[a];
                const att=k?.att||0, dif=k?.dif||0, tot=att+dif;
                const pA = tot>0?(att/tot*100):0;
                return (<div key={a}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">{a}</span><span className="text-gray-400">{fmt(tot)}</span></div>
                  <div className="h-3 rounded-full bg-blue-100 overflow-hidden flex">
                    <div className="h-3 bg-green-500" style={{width:`${pA}%`}}/>
                    <div className="h-3 bg-blue-400 flex-1"/>
                  </div>
                  <div className="flex justify-between text-[10px] mt-0.5">
                    <span className="text-green-600">▣ Att {pA.toFixed(0)}%</span>
                    <span className="text-blue-500">▣ Dif {(100-pA).toFixed(0)}%</span>
                  </div>
                </div>);
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top LOB 2026</h3>
            <div className="space-y-2">
              {byLob26.filter(l=>l.lob&&l.lob!=='N/D').slice(0,6).map((l,i)=>{
                const max=byLob26[0]?.serv||1;
                return (<div key={i}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600 truncate max-w-[140px]">{l.lob}</span><span className="font-bold text-gray-800">{fmt(l.serv)}</span></div>
                  <div className="h-1 rounded-full bg-gray-100"><div className="h-1 rounded-full bg-orange-400" style={{width:`${l.serv/max*100}%`}}/></div>
                </div>);
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
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b-2 border-gray-100">
                {['Area','2024','2025','2026','Diff 26/25','Var %','Deal'].map((h,i)=>(
                  <th key={h} className={`pb-2 font-semibold ${i===0?'text-left':'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {AREAS.map(area => {
                  let s24=0,s25=0,s26=0,n24=0,n25=0,n26=0;
                  if (kpiData?.byArea) {
                    kpiData.byArea.filter(a=>a.area_rac===area).forEach(a=>{
                      s24+=(a.serv_2024||0); s25+=(a.serv_2025||0); s26+=(a.serv_2026||0);
                    });
                    filteredDeals.filter(d=>d.area_rac===area).forEach(d=>{
                      if(d.anno==='2024')n24++; else if(d.anno==='2025')n25++; else if(d.anno==='2026')n26++;
                    });
                  } else {
                    ['2024','2025','2026'].forEach(anno=>{
                      const a = aggregati?.[anno]?.byArea?.find(x=>x.area===area);
                      if(anno==='2024'){s24=a?.serv||0;n24=a?.n||0;}
                      else if(anno==='2025'){s25=a?.serv||0;n25=a?.n||0;}
                      else{s26=a?.serv||0;n26=a?.n||0;}
                    });
                  }
                  if(!s24&&!s25&&!s26) return null;
                  const diff=s26-s25;
                  const varPct=s25>0?(diff/s25*100):null;
                  return (
                    <tr key={area} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-2 pr-3"><span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-xs font-bold text-gray-700">{area}</span></td>
                      <td className="py-2 text-right text-gray-400 text-xs">{s24>0?fmt(s24):'—'}</td>
                      <td className="py-2 text-right text-xs text-gray-600">{s25>0?fmt(s25):'—'}</td>
                      <td className="py-2 text-right"><span className="text-sm font-bold text-gray-800">{s26>0?fmt(s26):'—'}</span></td>
                      <td className={`py-2 text-right text-sm font-semibold ${diff>=0?'text-green-600':'text-red-500'}`}>{fmt(diff)}</td>
                      <td className={`py-2 text-right text-xs font-bold ${varPct===null?'text-gray-300':varPct>=0?'text-green-600':'text-red-500'}`}>{varPct===null?'—':fmtPct(varPct)}</td>
                      <td className="py-2 text-right text-xs text-gray-400">{n24+n25+n26}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top clienti */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Top 20 Clienti 2026{kpiData?.source==='raw'&&<span className="text-purple-500 normal-case font-normal ml-1">(filtrati)</span>}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b border-gray-100">
                {['#','Cliente','Portafoglio','Canoni','Diff.','Area','Deal'].map((h,i)=>(
                  <th key={h} className={`pb-2 font-semibold ${i<=1?'text-left':'text-right'} ${i===5?'text-center':''}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {topClienti.slice(0,20).map((c,i)=>(
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
