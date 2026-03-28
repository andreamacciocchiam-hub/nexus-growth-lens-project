import { useState, useMemo } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

export default function Clienti() {
  const { aggregati, loading } = useData();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('serv_2026');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);
  const [annoFilter, setAnnoFilter] = useState('tutti');

  // Costruisce mappa clienti da aggregati (istantaneo)
  const clients = useMemo(() => {
    if (!aggregati) return [];
    const map = {};
    ['2024', '2025', '2026'].forEach(anno => {
      const top = aggregati[anno]?.topClienti || [];
      top.forEach(c => {
        if (!map[c.nome]) map[c.nome] = { nome: c.nome, area: c.area, lobs: c.lobs, serv_2024: 0, serv_2025: 0, serv_2026: 0, canoni_2026: 0, diff_2026: 0, n_2024: 0, n_2025: 0, n_2026: 0 };
        map[c.nome][`serv_${anno}`] = c.serv;
        map[c.nome][`canoni_${anno}`] = c.canoni;
        map[c.nome][`diff_${anno}`] = c.diff;
        map[c.nome][`n_${anno}`] = c.n;
        if (!map[c.nome].area && c.area) map[c.nome].area = c.area;
      });
    });
    return Object.values(map);
  }, [aggregati]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
    : <ChevronDown className="w-3 h-3 text-gray-300" />;

  const filtered = useMemo(() => clients
    .filter(c => c.nome.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    }), [clients, search, sortBy, sortDir]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      <span className="text-sm">Caricamento...</span>
    </div>
  );

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clienti</h1>
          <p className="text-sm text-gray-500">{filtered.length} clienti · dati aggregati 2024 / 2025 / 2026</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cerca cliente..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('serv_2024')}>
                  <span className="flex items-center justify-end gap-1">2024 <SortIcon col="serv_2024" /></span>
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('serv_2025')}>
                  <span className="flex items-center justify-end gap-1">2025 <SortIcon col="serv_2025" /></span>
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('serv_2026')}>
                  <span className="flex items-center justify-end gap-1">2026 <SortIcon col="serv_2026" /></span>
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('diff_2026')}>
                  <span className="flex items-center justify-end gap-1">Diff. 26 <SortIcon col="diff_2026" /></span>
                </th>
                <th className="text-right px-3 py-3 font-medium">Canoni 26</th>
                <th className="text-center px-3 py-3 font-medium">Area</th>
                <th className="text-center px-3 py-3 font-medium">LOB</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((c) => (
                <tr key={c.nome} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{c.nome}</td>
                  <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{c.serv_2024 > 0 ? fmt(c.serv_2024) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{c.serv_2025 > 0 ? fmt(c.serv_2025) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{c.serv_2026 > 0 ? fmt(c.serv_2026) : '—'}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(c.diff_2026||0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <span className="flex items-center justify-end gap-1">
                      {(c.diff_2026||0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {fmt(c.diff_2026||0)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{c.canoni_2026 > 0 ? fmt(c.canoni_2026) : '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{c.area || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-400 text-[10px] max-w-[100px] truncate">{c.lobs || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nessun cliente trovato</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 300 && (
          <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
            Mostrati 300 su {filtered.length} clienti · affina la ricerca per vedere altri risultati
          </div>
        )}
      </div>
    </div>
  );
}
