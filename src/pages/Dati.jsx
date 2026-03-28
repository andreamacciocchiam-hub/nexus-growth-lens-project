import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { Search, X, Loader2, CheckCircle, Filter, ChevronDown } from 'lucide-react';

function fmt(v) {
  if (!v && v !== 0) return '—';
  const val = (v || 0) * 1000;
  if (Math.abs(val) >= 1_000_000_000) return `€${(val/1_000_000_000).toFixed(2)}B`;
  if (Math.abs(val) >= 1_000_000) return `€${(val/1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `€${(val/1_000).toFixed(0)}K`;
  return `€${Math.round(val)}`;
}

const ANNI = ['2024','2025','2026'];
const PAGE_SIZE = 50;

export default function Dettaglio() {
  const [deals, setDeals] = useState([]);
  const [portafoglioMap, setPortafoglioMap] = useState({});
  const [anno, setAnno] = useState('2026');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedAll, setLoadedAll] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    lob: '', attacco_difesa: '', area_rac: '',
    rac_26: '', area_am_26: '', area_mng_26: '',
    struttura_sales_26: '', area_mng_spec_26: '',
    specialist_lss: '', specialist_sec: '', specialist_cloud: '', iot: ''
  });
  const cancelRef = useRef(false);

  useEffect(() => {
    loadPortafoglio();
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    setDeals([]);
    setPage(0);
    setLoadedAll(false);
    setLoadedCount(0);
    setLoading(true);
    loadDeals(anno);
    return () => { cancelRef.current = true; };
  }, [anno]);

  const loadPortafoglio = async () => {
    try {
      const snap = await getDocs(collection(db, 'portafoglio_clienti'));
      const map = {};
      snap.docs.forEach(d => {
        const c = d.data();
        // join su ragione_sociale
        if (c.ragione_sociale) map[c.ragione_sociale.toLowerCase().trim()] = c;
      });
      setPortafoglioMap(map);
    } catch (e) { console.error(e); }
  };

  const loadDeals = async (anno) => {
    const col = collection(db, 'deals');
    let all = [], lastDoc = null;
    while (true) {
      if (cancelRef.current) break;
      const constraints = [col, where('anno', '==', anno), limit(100)];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      const snap = await getDocs(query(...constraints));
      if (snap.empty) break;
      snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
      lastDoc = snap.docs[snap.docs.length - 1];
      setDeals([...all]);
      setLoadedCount(all.length);
      setLoading(false);
      if (snap.docs.length < 100) break;
      await new Promise(r => setTimeout(r, 30));
    }
    if (!cancelRef.current) setLoadedAll(true);
  };

  // Enrich deal con portafoglio
  const enriched = useMemo(() => deals.map(d => {
    const key = (d.ragione_sociale_capogruppo || d.ragione_sociale || '').toLowerCase().trim();
    const ptf = portafoglioMap[key] || {};
    return { ...d, ...Object.fromEntries(Object.entries(ptf).map(([k,v]) => [`_ptf_${k}`, v])) };
  }), [deals, portafoglioMap]);

  // Valori unici per i filtri
  const uniq = (field) => [...new Set(enriched.map(d => d[field] || d[`_ptf_${field}`]).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    let r = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(d =>
        d.id_sdw?.toLowerCase().includes(q) ||
        d.ragione_sociale_capogruppo?.toLowerCase().includes(q) ||
        d.ragione_sociale?.toLowerCase().includes(q) ||
        d.descrizione?.toLowerCase().includes(q)
      );
    }
    if (filters.lob) r = r.filter(d => d.lob === filters.lob);
    if (filters.attacco_difesa) r = r.filter(d => d.attacco_difesa === filters.attacco_difesa);
    if (filters.area_rac) r = r.filter(d => d.area_rac === filters.area_rac);
    if (filters.rac_26) r = r.filter(d => d._ptf_rac_26 === filters.rac_26);
    if (filters.area_am_26) r = r.filter(d => d._ptf_area_am_26 === filters.area_am_26);
    if (filters.area_mng_26) r = r.filter(d => d._ptf_area_mng_26 === filters.area_mng_26);
    if (filters.struttura_sales_26) r = r.filter(d => d._ptf_struttura_sales_26 === filters.struttura_sales_26);
    if (filters.area_mng_spec_26) r = r.filter(d => d._ptf_area_mng_spec_26 === filters.area_mng_spec_26);
    if (filters.specialist_lss) r = r.filter(d => d._ptf_acc_specialist_lss === filters.specialist_lss);
    if (filters.specialist_sec) r = r.filter(d => d._ptf_acc_specialist_sec === filters.specialist_sec);
    if (filters.specialist_cloud) r = r.filter(d => d._ptf_acc_specialist_cloud_iot_5g === filters.specialist_cloud);
    if (filters.iot) r = r.filter(d => d._ptf_iot === filters.iot);
    return r;
  }, [enriched, search, filters]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const totServ = filtered.reduce((s, d) => s + (d.serv_i_anno || 0), 0);

  const hasFilters = search || Object.values(filters).some(Boolean);
  const resetFilters = () => {
    setSearch('');
    setFilters({ lob:'', attacco_difesa:'', area_rac:'', rac_26:'', area_am_26:'', area_mng_26:'', struttura_sales_26:'', area_mng_spec_26:'', specialist_lss:'', specialist_sec:'', specialist_cloud:'', iot:'' });
    setPage(0);
  };

  const sel = (key, val) => <select value={filters[key]||''} onChange={e=>{setFilters(p=>({...p,[key]:e.target.value}));setPage(0);}} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
    <option value="">{val}</option>
    {uniq(key).map(v=><option key={v} value={v}>{v}</option>)}
  </select>;

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dettaglio Deal</h1>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            {loading ? <><Loader2 className="w-3 h-3 animate-spin text-blue-400" />Caricamento...</>
              : <>{filtered.length.toLocaleString('it-IT')} deal · {fmt(totServ)}
                {!loadedAll && <><Loader2 className="w-3 h-3 animate-spin text-blue-300 ml-1" />{loadedCount.toLocaleString('it-IT')} caricati</>}
                {loadedAll && <><CheckCircle className="w-3 h-3 text-green-400 ml-1" />{loadedCount.toLocaleString('it-IT')} totali</>}
              </>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ANNI.map(a => (
            <button key={a} onClick={() => setAnno(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${anno===a?'bg-blue-600 text-white border-blue-600 shadow':'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
              placeholder="ID SDW, Ragione Sociale Capogruppo, Descrizione..."
              className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
          </div>
          <button onClick={()=>setShowFilters(v=>!v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${showFilters?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            <Filter className="w-3.5 h-3.5" />
            Filtri avanzati
            {Object.values(filters).filter(Boolean).length > 0 && <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{Object.values(filters).filter(Boolean).length}</span>}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters?'rotate-180':''}`} />
          </button>
          {hasFilters && <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">Rimuovi filtri</button>}
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {sel('lob', 'LOB')}
            {sel('attacco_difesa', 'A/D')}
            {sel('area_rac', 'Area RAC')}
            {sel('rac_26', 'RAC 26')}
            {sel('area_am_26', 'Area AM 26')}
            {sel('area_mng_26', 'Area MNG 26')}
            {sel('struttura_sales_26', 'Struttura Sales')}
            {sel('area_mng_spec_26', 'Area MNG Spec')}
            {sel('specialist_lss', 'Specialist LSS')}
            {sel('specialist_sec', 'Specialist SEC')}
            {sel('specialist_cloud', 'Specialist Cloud/IoT')}
            {sel('iot', 'IoT Specialist')}
          </div>
        )}
      </div>

      {/* Tabella */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-sm">Caricamento dati {anno}...</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">ID SDW</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Rag. Soc. Capogruppo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Ragione Sociale</th>
                  <th className="text-left px-3 py-2.5 font-semibold max-w-[180px]">Descrizione</th>
                  <th className="text-center px-2 py-2.5 font-semibold">NEW AREA RAC</th>
                  <th className="text-center px-2 py-2.5 font-semibold">LOB</th>
                  <th className="text-center px-2 py-2.5 font-semibold">A/D</th>
                  <th className="text-center px-2 py-2.5 font-semibold">Tipo</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Serv. I Anno</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Canoni</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Differenziale</th>
                  <th className="text-left px-3 py-2.5 font-semibold border-l border-blue-100 bg-blue-50/50 text-blue-600">RAC 26</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">Area AM 26</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">Area MNG 26</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">Struttura Sales</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">Spec. LSS</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">Spec. SEC</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">Spec. Cloud/IoT</th>
                  <th className="text-left px-3 py-2.5 font-semibold bg-blue-50/50 text-blue-600">IoT</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((d, i) => (
                  <tr key={d.id} className={`border-b border-gray-50 hover:bg-blue-50/20 transition-colors ${i%2===0?'bg-white':'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{d.id_sdw}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate">{d.ragione_sociale_capogruppo || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{d.ragione_sociale || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{d.descrizione || '—'}</td>
                    <td className="px-2 py-2 text-center"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{d.new_area_rac || d.area_rac || '—'}</span></td>
                    <td className="px-2 py-2 text-center text-gray-500">{d.lob || '—'}</td>
                    <td className="px-2 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.attacco_difesa==='Attacco'?'bg-orange-100 text-orange-700':'bg-indigo-100 text-indigo-700'}`}>{d.attacco_difesa||'—'}</span></td>
                    <td className="px-2 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.tipo==='CTR'?'bg-teal-100 text-teal-700':'bg-violet-100 text-violet-700'}`}>{d.tipo||'—'}</span></td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(d.serv_i_anno)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(d.canoni)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(d.differenziale_servizi||0)>=0?'text-green-600':'text-red-500'}`}>{fmt(d.differenziale_servizi)}</td>
                    {/* Campi da portafoglio */}
                    <td className="px-3 py-2 text-gray-700 border-l border-blue-100 bg-blue-50/20">{d._ptf_rac_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-500 bg-blue-50/20">{d._ptf_area_am_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-500 bg-blue-50/20">{d._ptf_area_mng_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-500 bg-blue-50/20">{d._ptf_struttura_sales_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf_acc_specialist_lss||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf_acc_specialist_sec||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf_acc_specialist_cloud_iot_5g||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf_iot||'—'}</td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={19} className="text-center py-8 text-gray-400">Nessun risultato</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Pagina {page+1}/{totalPages||1} · {filtered.length.toLocaleString('it-IT')} deal · {fmt(totServ)}</span>
            <div className="flex gap-2">
              <button disabled={page===0} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">← Prec</button>
              <button disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">Succ →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
