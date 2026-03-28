import { useState, useMemo, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { Search, ChevronDown, ChevronUp, Users, Filter, X } from 'lucide-react';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

const COLS_ANAGRAFICA = [
  { key: 'capogruppo',         label: 'Capogruppo' },
  { key: 'ragione_sociale',    label: 'Ragione Sociale' },
  { key: 'vertical_gruppo',    label: 'Vertical' },
  { key: 'funzione',           label: 'Funzione' },
  { key: 'segmento_26',        label: 'Segmento 2026' },
  { key: 'area_sales',         label: 'Area Sales' },
  { key: 'area_rac_26',        label: 'Area RAC 26' },
  { key: 'rac_26',             label: 'RAC 26' },
  { key: 'area_am_26',         label: 'Area AM 26' },
  { key: 'area_mng_26',        label: 'Area MNG 26' },
  { key: 'struttura_sales_26', label: 'Struttura Sales Core 26' },
  { key: 'area_mng_spec_26',   label: 'Area MNG Spec' },
  { key: 'acc_specialist_lss', label: 'Specialist LSS' },
  { key: 'acc_specialist_sec', label: 'Specialist SEC' },
  { key: 'acc_specialist_cloud_iot_5g', label: 'Specialist Cloud/IoT/5G' },
  { key: 'iot',                label: 'IoT' },
  { key: 'cf',                 label: 'CF' },
  { key: 'cf_capogruppo',      label: 'CF Capogruppo' },
  { key: 'comune',             label: 'Comune' },
  { key: 'regione',            label: 'Regione' },
];

const TABS = [
  { key: 'anagrafica', label: 'Anagrafica Clienti' },
  { key: 'rac',        label: 'Vista per RAC' },
  { key: 'specialist', label: 'Vista Specialist' },
];

export default function Clienti() {
  const [clienti, setClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('anagrafica');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ area_rac: '', vertical: '', segmento: '', rac: '' });
  const [sortBy, setSortBy] = useState('capogruppo');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadClienti();
  }, []);

  const loadClienti = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'portafoglio_clienti'));
      setClienti(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <ChevronDown className="w-3 h-3 text-gray-300" />;

  // Valori unici per i filtri
  const uniqueVals = (key) => [...new Set(clienti.map(c => c[key]).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    let r = clienti;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c =>
        c.capogruppo?.toLowerCase().includes(q) ||
        c.ragione_sociale?.toLowerCase().includes(q) ||
        c.rac_26?.toLowerCase().includes(q) ||
        c.acc_specialist_lss?.toLowerCase().includes(q) ||
        c.acc_specialist_sec?.toLowerCase().includes(q) ||
        c.acc_specialist_cloud_iot_5g?.toLowerCase().includes(q) ||
        c.cf?.toLowerCase().includes(q)
      );
    }
    if (filters.area_rac) r = r.filter(c => c.area_rac_26 === filters.area_rac);
    if (filters.vertical) r = r.filter(c => c.vertical_gruppo === filters.vertical);
    if (filters.segmento) r = r.filter(c => c.segmento_26 === filters.segmento);
    if (filters.rac) r = r.filter(c => c.rac_26 === filters.rac);

    return [...r].sort((a, b) => {
      const av = a[sortBy] || '', bv = b[sortBy] || '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [clienti, search, filters, sortBy, sortDir]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Vista per RAC
  const byRac = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      const rac = c.rac_26 || 'N/D';
      if (!map[rac]) map[rac] = { rac, area: c.area_rac_26 || '', area_mng: c.area_mng_26 || '', clienti: [] };
      map[rac].clienti.push(c);
    });
    return Object.values(map).sort((a, b) => b.clienti.length - a.clienti.length);
  }, [filtered]);

  // Vista per Specialist
  const bySpecialist = useMemo(() => {
    const map = {};
    const addSpec = (nome, tipo, cliente) => {
      if (!nome) return;
      if (!map[nome]) map[nome] = { nome, tipo, clienti: [] };
      map[nome].clienti.push({ ...cliente, lob_spec: tipo });
    };
    filtered.forEach(c => {
      addSpec(c.acc_specialist_lss, 'LSS', c);
      addSpec(c.acc_specialist_sec, 'SEC', c);
      addSpec(c.acc_specialist_cloud_iot_5g, 'Cloud/IoT/5G', c);
    });
    return Object.values(map).sort((a, b) => b.clienti.length - a.clienti.length);
  }, [filtered]);

  const hasFilters = search || Object.values(filters).some(Boolean);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
      <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm">Caricamento anagrafica...</span>
    </div>
  );

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Anagrafica Clienti</h1>
          <p className="text-sm text-gray-500">
            {filtered.length.toLocaleString('it-IT')} clienti
            {clienti.length !== filtered.length && ` su ${clienti.length.toLocaleString('it-IT')} totali`}
          </p>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Cerca cliente, RAC, specialist..."
              className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-gray-400" /></button>}
          </div>
          {[
            { key: 'area_rac', label: 'Area RAC', vals: uniqueVals('area_rac_26') },
            { key: 'rac', label: 'RAC', vals: uniqueVals('rac_26') },
            { key: 'vertical', label: 'Vertical', vals: uniqueVals('vertical_gruppo') },
            { key: 'segmento', label: 'Segmento', vals: uniqueVals('segmento_26') },
          ].map(f => (
            <select key={f.key} value={filters[f.key]}
              onChange={e => { setFilters(prev => ({ ...prev, [f.key]: e.target.value })); setPage(0); }}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Tutti {f.label}</option>
              {f.vals.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilters({ area_rac: '', vertical: '', segmento: '', rac: '' }); setPage(0); }}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">
              Rimuovi filtri
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Anagrafica */}
      {tab === 'anagrafica' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {COLS_ANAGRAFICA.slice(0, 12).map(col => (
                    <th key={col.key} onClick={() => toggleSort(col.key)}
                      className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px] cursor-pointer hover:bg-gray-100 select-none">
                      <span className="flex items-center gap-1">{col.label} <SortIcon col={col.key} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => (
                  <tr key={c.id || i} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i%2===0?'bg-white':'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate" title={c.capogruppo}>{c.capogruppo || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={c.ragione_sociale}>{c.ragione_sociale || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.vertical_gruppo || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.funzione || '—'}</td>
                    <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">{c.segmento_26 || '—'}</span></td>
                    <td className="px-3 py-2 text-gray-500">{c.area_sales || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.area_rac_26 || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-700">{c.rac_26 || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.area_am_26 || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.area_mng_26 || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.struttura_sales_26 || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.area_mng_spec_26 || '—'}</td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-gray-400">Nessun cliente trovato</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Pagina {page+1}/{totalPages||1} · {filtered.length.toLocaleString('it-IT')} clienti</span>
            <div className="flex gap-2">
              <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">← Prec</button>
              <button disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">Succ →</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Per RAC */}
      {tab === 'rac' && (
        <div className="space-y-3">
          {byRac.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div>
                  <span className="font-bold text-gray-800">{r.rac}</span>
                  <span className="text-xs text-gray-400 ml-3">{r.area} · {r.area_mng}</span>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{r.clienti.length} clienti</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">Capogruppo</th>
                    <th className="text-left px-4 py-2 font-medium">Ragione Sociale</th>
                    <th className="text-left px-4 py-2 font-medium">Segmento</th>
                    <th className="text-left px-4 py-2 font-medium">Vertical</th>
                    <th className="text-left px-4 py-2 font-medium">Specialist LSS</th>
                    <th className="text-left px-4 py-2 font-medium">Specialist SEC</th>
                    <th className="text-left px-4 py-2 font-medium">Specialist Cloud/IoT</th>
                  </tr></thead>
                  <tbody>
                    {r.clienti.slice(0, 20).map((c, j) => (
                      <tr key={j} className="border-b border-gray-50 hover:bg-blue-50/20">
                        <td className="px-4 py-2 font-medium text-gray-800 max-w-[160px] truncate">{c.capogruppo || '—'}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-[160px] truncate">{c.ragione_sociale || '—'}</td>
                        <td className="px-4 py-2"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">{c.segmento_26 || '—'}</span></td>
                        <td className="px-4 py-2 text-gray-500">{c.vertical_gruppo || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{c.acc_specialist_lss || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{c.acc_specialist_sec || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{c.acc_specialist_cloud_iot_5g || '—'}</td>
                      </tr>
                    ))}
                    {r.clienti.length > 20 && (
                      <tr><td colSpan={7} className="px-4 py-2 text-xs text-gray-400 italic">+{r.clienti.length - 20} altri clienti...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {byRac.length === 0 && <div className="text-center py-12 text-gray-400">Nessun dato</div>}
        </div>
      )}

      {/* TAB: Specialist */}
      {tab === 'specialist' && (
        <div className="space-y-3">
          {bySpecialist.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-800">{s.nome}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    s.tipo === 'LSS' ? 'bg-purple-100 text-purple-700' :
                    s.tipo === 'SEC' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'}`}>{s.tipo}</span>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{s.clienti.length} clienti</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">Capogruppo</th>
                    <th className="text-left px-4 py-2 font-medium">Ragione Sociale</th>
                    <th className="text-left px-4 py-2 font-medium">RAC</th>
                    <th className="text-left px-4 py-2 font-medium">Area RAC</th>
                    <th className="text-left px-4 py-2 font-medium">Segmento</th>
                    <th className="text-left px-4 py-2 font-medium">Vertical</th>
                  </tr></thead>
                  <tbody>
                    {s.clienti.slice(0, 15).map((c, j) => (
                      <tr key={j} className="border-b border-gray-50 hover:bg-blue-50/20">
                        <td className="px-4 py-2 font-medium text-gray-800 max-w-[160px] truncate">{c.capogruppo || '—'}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-[160px] truncate">{c.ragione_sociale || '—'}</td>
                        <td className="px-4 py-2 text-gray-700">{c.rac_26 || '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{c.area_rac_26 || '—'}</td>
                        <td className="px-4 py-2"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">{c.segmento_26 || '—'}</span></td>
                        <td className="px-4 py-2 text-gray-500">{c.vertical_gruppo || '—'}</td>
                      </tr>
                    ))}
                    {s.clienti.length > 15 && (
                      <tr><td colSpan={6} className="px-4 py-2 text-xs text-gray-400 italic">+{s.clienti.length - 15} altri clienti...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {bySpecialist.length === 0 && <div className="text-center py-12 text-gray-400">Nessun specialist trovato</div>}
        </div>
      )}
    </div>
  );
}
