import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { Search, Filter, ArrowUpDown, Loader2 } from 'lucide-react';

function fmt(v) {
  if (!v && v !== 0) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

async function loadDealsForAnno(anno) {
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

const ANNI = ['2024', '2025', '2026'];
const AREAS = ['Tutti', 'MNO', 'SNO', 'LNO', 'MNE', 'SNE', 'LNE', 'MCS', 'SLCE', 'SLCS', 'IC'];
const TYPES = ['Tutti', 'Attacco', 'Difesa'];
const LOBS = ['Tutti', 'Cloud', 'Connettività', 'IoT', 'Other IT', 'Licensing', 'Security'];

export default function Deals() {
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnno, setLoadingAnno] = useState('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [search, setSearch] = useState('');
  const [anno, setAnno] = useState('2026');
  const [area, setArea] = useState('Tutti');
  const [tipo, setTipo] = useState('Tutti');
  const [lob, setLob] = useState('Tutti');
  const [sort, setSort] = useState({ key: 'serv_i_anno', dir: 'desc' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    loadAll();
    return () => { cancelRef.current = true; };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setAllDeals([]);
    setLoadedCount(0);
    let all = [];
    for (const a of ANNI) {
      if (cancelRef.current) break;
      setLoadingAnno(a);
      const deals = await loadDealsForAnno(a);
      all = [...all, ...deals];
      setLoadedCount(all.length);
    }
    setAllDeals(all);
    setLoading(false);
  };

  const toggleSort = (key) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const filtered = useMemo(() => {
    let data = allDeals.filter(d => {
      if (anno !== 'Tutti' && d.anno !== anno) return false;
      if (area !== 'Tutti' && d.area_rac !== area) return false;
      if (tipo !== 'Tutti' && d.attacco_difesa !== tipo) return false;
      if (lob !== 'Tutti' && d.lob !== lob) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.ragione_sociale_capogruppo?.toLowerCase().includes(q) ||
          d.ragione_sociale?.toLowerCase().includes(q) ||
          d.descrizione?.toLowerCase().includes(q) ||
          d.id_sdw?.toLowerCase().includes(q)
        );
      }
      return true;
    });
    data.sort((a, b) => {
      const va = a[sort.key] ?? 0;
      const vb = b[sort.key] ?? 0;
      return sort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return data;
  }, [allDeals, search, anno, area, tipo, lob, sort]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5 min-h-full bg-gray-50">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Trattative & Contratti</h2>
        <p className="text-gray-500 text-sm mt-1">
          {loading
            ? `Caricamento anno ${loadingAnno}... ${loadedCount.toLocaleString('it-IT')} record`
            : `${filtered.length.toLocaleString('it-IT')} risultati su ${allDeals.length.toLocaleString('it-IT')} totali`}
        </p>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cerca cliente, descrizione, ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {[
          { label: 'Anno', val: anno, set: v => { setAnno(v); setPage(1); }, opts: ['Tutti', ...ANNI] },
          { label: 'Area', val: area, set: v => { setArea(v); setPage(1); }, opts: AREAS },
          { label: 'Tipo', val: tipo, set: v => { setTipo(v); setPage(1); }, opts: TYPES },
          { label: 'LOB',  val: lob,  set: v => { setLob(v);  setPage(1); }, opts: LOBS },
        ].map(f => (
          <div key={f.label} className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select value={f.val} onChange={e => f.set(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm">Caricamento anno {loadingAnno}...</p>
          <p className="text-xs">{loadedCount.toLocaleString('it-IT')} record caricati</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Anno</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">ID SDW</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Cliente</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Descrizione</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Area</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">LOB</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Tipo</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px] cursor-pointer select-none" onClick={() => toggleSort('serv_i_anno')}>
                      <span className="flex items-center gap-1">Serv. I Anno <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px] cursor-pointer select-none" onClick={() => toggleSort('differenziale_servizi')}>
                      <span className="flex items-center gap-1">Differenziale <ArrowUpDown size={10} /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d, i) => (
                    <tr key={d.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.anno === '2026' ? 'bg-green-100 text-green-700' : d.anno === '2025' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{d.anno}</span>
                      </td>
                      <td className="px-3 py-2 text-blue-600 font-mono">{d.id_sdw}</td>
                      <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">{d.ragione_sociale_capogruppo || d.ragione_sociale}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{d.descrizione}</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{d.area_rac}</span></td>
                      <td className="px-3 py-2 text-gray-600">{d.lob}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.attacco_difesa === 'Attacco' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>{d.attacco_difesa}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{fmt(d.serv_i_anno)}</td>
                      <td className={`px-3 py-2 font-medium ${(d.differenziale_servizi || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(d.differenziale_servizi)}</td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">Nessun risultato</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Pagina {page} di {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return <button key={pg} onClick={() => setPage(pg)} className={`px-2.5 py-1 rounded border ${pg === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>{pg}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
