import { useState, useEffect, useRef } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

const ANNI = ['2024', '2025', '2026'];

async function loadDealsForAnno(anno, onProgress) {
  const col = collection(db, 'deals');
  let all = [];
  let lastDoc = null;

  while (true) {
    const constraints = [col, where('anno', '==', anno), limit(100)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(...constraints));
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (onProgress) onProgress(all.length);
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    await new Promise(r => setTimeout(r, 50));
  }
  return all;
}

function buildClientMap(deals) {
  const clientMap = {};
  const dealMap = {};

  for (const d of deals) {
    const key = d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/D';
    if (!clientMap[key]) {
      clientMap[key] = {
        name: key,
        total_2024: 0, total_2025: 0, total_2026: 0,
        diff_2024: 0, diff_2025: 0, diff_2026: 0,
        canoni_2026: 0,
        areas: new Set(), lobs: new Set(),
        n_deals: 0
      };
    }
    const c = clientMap[key];
    const s = d.serv_i_anno || 0;
    if (d.anno === '2024') { c.total_2024 += s; c.diff_2024 += d.differenziale_servizi || 0; }
    if (d.anno === '2025') { c.total_2025 += s; c.diff_2025 += d.differenziale_servizi || 0; }
    if (d.anno === '2026') { c.total_2026 += s; c.diff_2026 += d.differenziale_servizi || 0; c.canoni_2026 += d.canoni || 0; }
    if (d.area_rac) c.areas.add(d.area_rac);
    if (d.lob) c.lobs.add(d.lob);
    c.n_deals += 1;
    if (!dealMap[key]) dealMap[key] = [];
    dealMap[key].push(d);
  }

  return {
    clients: Object.values(clientMap).map(c => ({
      ...c,
      areas: Array.from(c.areas).join(', '),
      lobs: Array.from(c.lobs).join(', ')
    })),
    dealMap
  };
}

export default function Clienti() {
  const [allDeals, setAllDeals] = useState([]);
  const [clients, setClients] = useState([]);
  const [dealMap, setDealMap] = useState({});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_2026');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [loadingAnno, setLoadingAnno] = useState('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [annoFilter, setAnnoFilter] = useState('tutti');
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

    for (const anno of ANNI) {
      if (cancelRef.current) break;
      setLoadingAnno(anno);
      const deals = await loadDealsForAnno(anno, (n) => setLoadedCount(all.length + n));
      all = [...all, ...deals];
      setLoadedCount(all.length);
    }

    setAllDeals(all);
    const { clients, dealMap } = buildClientMap(all);
    setClients(clients);
    setDealMap(dealMap);
    setLoading(false);
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
    : null;

  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clienti</h1>
          <p className="text-sm text-gray-500">
            {loading
              ? `Caricamento anno ${loadingAnno}... ${loadedCount.toLocaleString('it-IT')} record`
              : `${clients.length} clienti · ${allDeals.length.toLocaleString('it-IT')} deal totali`}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cerca cliente..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm">Caricamento anno {loadingAnno}...</p>
          <p className="text-xs">{loadedCount.toLocaleString('it-IT')} record caricati</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('total_2024')}>
                    <span className="flex items-center justify-end gap-1">2024 <SortIcon col="total_2024" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('total_2025')}>
                    <span className="flex items-center justify-end gap-1">2025 <SortIcon col="total_2025" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('total_2026')}>
                    <span className="flex items-center justify-end gap-1">2026 <SortIcon col="total_2026" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('diff_2026')}>
                    <span className="flex items-center justify-end gap-1">Diff. 26 <SortIcon col="diff_2026" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium">Canoni 26</th>
                  <th className="text-center px-3 py-3 font-medium">Area</th>
                  <th className="text-center px-3 py-3 font-medium">Deals</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((c) => {
                  const isExp = expanded === c.name;
                  return (
                    <>
                      <tr key={c.name}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => setExpanded(isExp ? null : c.name)}>
                        <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{c.name}</td>
                        <td className="px-3 py-2.5 text-right text-gray-400">{fmt(c.total_2024)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{fmt(c.total_2025)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmt(c.total_2026)}</td>
                        <td className={`px-3 py-2.5 text-right font-medium ${c.diff_2026 >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          <span className="flex items-center justify-end gap-1">
                            {c.diff_2026 >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {fmt(c.diff_2026)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmt(c.canoni_2026)}</td>
                        <td className="px-3 py-2.5 text-center text-gray-400 max-w-[80px] truncate">{c.areas}</td>
                        <td className="px-3 py-2.5 text-center text-gray-500">{c.n_deals}</td>
                      </tr>
                      {isExp && (
                        <tr key={`${c.name}-exp`} className="bg-blue-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="text-xs text-gray-600 mb-2 font-semibold">Dettaglio trattative — {c.name}</div>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {(dealMap[c.name] || []).sort((a, b) => (b.serv_i_anno || 0) - (a.serv_i_anno || 0)).map(d => (
                                <div key={`${d.id}-${d.id_sdw}`} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold mt-0.5 ${d.anno === '2026' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {d.anno}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold mt-0.5 ${d.attacco_difesa === 'Attacco' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {d.attacco_difesa}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-700 font-medium">{d.descrizione}</span>
                                    <span className="text-gray-400 ml-2">· {d.lob}</span>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="font-semibold text-gray-800">{fmt(d.serv_i_anno)}</div>
                                    <div className="text-gray-400">{d.area_rac}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
