import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, X } from 'lucide-react';
import DealsFilters, { EMPTY_FILTERS, applyFilters } from '../components/bi/DealsFilters';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

export default function Contratti() {
  const [deals, setDeals] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    base44.entities.Deal.list('-serv_i_anno', 15000).then(d => {
      setDeals(d || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = applyFilters(deals, filters);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.ragione_sociale_capogruppo?.toLowerCase().includes(q) ||
        d.ragione_sociale?.toLowerCase().includes(q) ||
        d.descrizione?.toLowerCase().includes(q) ||
        d.id_sdw?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [deals, filters, search]);

  const totalFiltered = filtered.reduce((s, d) => s + (d.serv_i_anno || 0), 0);
  const pageDeals = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Contratti & Trattative</h1>
        <p className="text-sm text-gray-500">
          {filtered.length.toLocaleString('it-IT')} trattative · Totale: {fmt(totalFiltered)}
        </p>
      </div>

      {/* Filtri unificati */}
      <DealsFilters deals={deals} filters={filters} onChange={f => { setFilters(f); setPage(0); }} />

      {/* Ricerca libera */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Cerca cliente, descrizione, ID SDW..."
          className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Caricamento...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                  <th className="text-left px-3 py-3 font-medium">ID</th>
                  <th className="text-left px-3 py-3 font-medium">Cliente</th>
                  <th className="text-left px-3 py-3 font-medium max-w-[200px]">Descrizione</th>
                  <th className="text-center px-2 py-3 font-medium">Anno</th>
                  <th className="text-center px-2 py-3 font-medium">Portafoglio</th>
                  <th className="text-center px-2 py-3 font-medium">RAC</th>
                  <th className="text-center px-2 py-3 font-medium">LOB</th>
                  <th className="text-center px-2 py-3 font-medium">Tipo</th>
                  <th className="text-center px-2 py-3 font-medium">A/D</th>
                  <th className="text-right px-3 py-3 font-medium">Serv. I Anno</th>
                  <th className="text-right px-3 py-3 font-medium">Differenziale</th>
                </tr>
              </thead>
              <tbody>
                {pageDeals.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 font-mono text-gray-500">{d.id_sdw}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate">{d.ragione_sociale_capogruppo || d.ragione_sociale}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{d.descrizione}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.anno === '2026' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {d.anno}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500 text-[10px]">{d.portafoglio}</td>
                    <td className="px-2 py-2 text-center text-gray-600">{d.rac}</td>
                    <td className="px-2 py-2 text-center text-gray-500 max-w-[80px] truncate">{d.lob}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.tipo === 'CTR' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700'}`}>
                        {d.tipo || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.attacco_difesa === 'Attacco' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {d.attacco_difesa}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(d.serv_i_anno)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(d.differenziale_servizi || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmt(d.differenziale_servizi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Pagina {page + 1} / {totalPages || 1} · {filtered.length} risultati</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">← Prec</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">Succ →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}