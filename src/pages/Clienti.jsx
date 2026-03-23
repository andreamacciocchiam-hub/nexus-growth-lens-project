import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import PortafoglioFilter from '../components/bi/PortafoglioFilter';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

export default function Clienti() {
  const [allDeals, setAllDeals] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_2026');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [dealMap, setDealMap] = useState({});
  const [portafoglio, setPortafoglio] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const buildClients = (deals, pf) => {
    const filtered = pf ? deals.filter(d => d.portafoglio === pf) : deals;
    const clientMap = {};
    const dm = {};
    for (const d of filtered) {
      const key = d.ragione_sociale_capogruppo || 'N/D';
      if (!clientMap[key]) {
        clientMap[key] = { name: key, total_2025: 0, total_2026: 0, canoni_2025: 0, canoni_2026: 0, diff_2025: 0, diff_2026: 0, areas: new Set(), lobs: new Set(), attacco: 0, difesa: 0, n_deals: 0 };
      }
      const c = clientMap[key];
      const s = d.serv_i_anno || 0;
      if (d.anno === '2025') { c.total_2025 += s; c.canoni_2025 += d.canoni || 0; c.diff_2025 += d.differenziale_servizi || 0; }
      if (d.anno === '2026') { c.total_2026 += s; c.canoni_2026 += d.canoni || 0; c.diff_2026 += d.differenziale_servizi || 0; }
      if (d.area_rac) c.areas.add(d.area_rac);
      if (d.lob) c.lobs.add(d.lob);
      if (d.attacco_difesa === 'Attacco') c.attacco += s;
      if (d.attacco_difesa === 'Difesa') c.difesa += s;
      c.n_deals += 1;
      if (!dm[key]) dm[key] = [];
      dm[key].push(d);
    }
    setClients(Object.values(clientMap).map(c => ({ ...c, areas: Array.from(c.areas).join(', '), lobs: Array.from(c.lobs).join(', ') })));
    setDealMap(dm);
  };

  const loadClients = async () => {
    setLoading(true);
    const deals = await base44.entities.Deal.list('-serv_i_anno', 15000);
    setAllDeals(deals || []);
    buildClients(deals || [], '');
    setLoading(false);
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
    : null;

  const handlePortafoglioChange = (pf) => {
    setPortafoglio(pf);
    buildClients(allDeals, pf);
    setExpanded(null);
  };

  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clienti</h1>
          <p className="text-sm text-gray-500">Analisi portafoglio per cliente · {clients.length} clienti</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
        <PortafoglioFilter value={portafoglio} onChange={handlePortafoglioChange} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca cliente..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Caricamento...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('total_2025')}>
                    <span className="flex items-center justify-end gap-1">2025 <SortIcon col="total_2025" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('total_2026')}>
                    <span className="flex items-center justify-end gap-1">2026 <SortIcon col="total_2026" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium cursor-pointer" onClick={() => toggleSort('diff_2026')}>
                    <span className="flex items-center justify-end gap-1">Diff. <SortIcon col="diff_2026" /></span>
                  </th>
                  <th className="text-right px-3 py-3 font-medium">Canoni 26</th>
                  <th className="text-center px-3 py-3 font-medium">Area</th>
                  <th className="text-center px-3 py-3 font-medium">Deals</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((c, i) => {
                  const isExp = expanded === c.name;
                  const varPct = c.total_2025 > 0 ? ((c.total_2026 - c.total_2025) / c.total_2025 * 100) : null;
                  return (
                    <>
                      <tr
                        key={c.name}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => setExpanded(isExp ? null : c.name)}
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{c.name}</td>
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
                          <td colSpan={7} className="px-4 py-3">
                            <div className="text-xs text-gray-600 mb-2 font-semibold">Dettaglio trattative — {c.name}</div>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {(dealMap[c.name] || []).sort((a, b) => (b.serv_i_anno || 0) - (a.serv_i_anno || 0)).map(d => (
                                <div key={`${d.id}-${d.id_sdw}`} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold mt-0.5 ${d.attacco_difesa === 'Attacco' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {d.attacco_difesa}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-700 font-medium">{d.descrizione}</span>
                                    <span className="text-gray-400 ml-2">{d.ragione_sociale}</span>
                                    <span className="text-gray-400 ml-2">· {d.ambito} · {d.lob}</span>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="font-semibold text-gray-800">{fmt(d.serv_i_anno)}</div>
                                    <div className="text-gray-400">{d.anno} · {d.area_rac}</div>
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