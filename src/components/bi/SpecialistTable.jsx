import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Info } from 'lucide-react';

const LOB_SPECIALIST_MAP = {
  'Cloud':        { col: 'acc_specialist_cloud_iot_5g', label: 'Specialist Cloud/IoT/5G', color: 'bg-blue-100 text-blue-700' },
  'IoT':          { col: 'acc_specialist_cloud_iot_5g', label: 'Specialist Cloud/IoT/5G', color: 'bg-cyan-100 text-cyan-700' },
  'Security':     { col: 'acc_specialist_sec',          label: 'Specialist Security',      color: 'bg-red-100 text-red-700' },
  'Licensing':    { col: 'acc_specialist_lss',          label: 'Specialist LSS',           color: 'bg-purple-100 text-purple-700' },
  'Connettività': { col: null,                          label: 'Nessuno specialist',       color: 'bg-gray-100 text-gray-400' },
  'Other IT':     { col: null,                          label: 'Nessuno specialist',       color: 'bg-gray-100 text-gray-400' },
};

export default function SpecialistTable({ portafoglio }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('ragione_sociale');
  const [sortDir, setSortDir] = useState('asc');
  const [lobFilter, setLobFilter] = useState('tutti');

  // Costruisce righe LOB x Cliente
  const rows = useMemo(() => {
    if (!portafoglio?.length) return [];
    const result = [];
    portafoglio.forEach(cliente => {
      Object.entries(LOB_SPECIALIST_MAP).forEach(([lob, cfg]) => {
        const specialist = cfg.col ? (cliente[cfg.col] || null) : null;
        result.push({
          ragione_sociale: cliente.ragione_sociale || cliente.capogruppo || 'N/D',
          capogruppo: cliente.capogruppo,
          lob,
          lob_cfg: cfg,
          specialist,
          area_am_spec: cliente.area_am_spec || null,
          area_mng_spec: cliente.area_mng_spec || null,
          area_rac: cliente.area_rac,
          rac: cliente.rac,
        });
      });
    });
    return result;
  }, [portafoglio]);

  const filtered = useMemo(() => {
    let r = rows;
    if (lobFilter !== 'tutti') r = r.filter(x => x.lob === lobFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.ragione_sociale?.toLowerCase().includes(q) ||
        x.specialist?.toLowerCase().includes(q)
      );
    }
    r = [...r].sort((a, b) => {
      const av = a[sortBy] || '', bv = b[sortBy] || '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return r;
  }, [rows, search, lobFilter, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <ChevronDown className="w-3 h-3 text-gray-300" />;

  if (!portafoglio?.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">
      <Info className="w-6 h-6 mx-auto mb-2 text-gray-300" />
      Importa un file portafoglio per vedere la tabella LOB → Specialist
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca cliente o specialist..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['tutti', ...Object.keys(LOB_SPECIALIST_MAP)].map(lob => (
            <button key={lob} onClick={() => setLobFilter(lob)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                lobFilter === lob ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
              }`}>
              {lob === 'tutti' ? 'Tutti i LOB' : lob}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{filtered.length} associazioni</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 cursor-pointer" onClick={() => toggleSort('ragione_sociale')}>
                <span className="flex items-center gap-1">Cliente <SortIcon col="ragione_sociale" /></span>
              </th>
              <th className="text-center px-3 py-2.5 font-semibold text-gray-500 cursor-pointer" onClick={() => toggleSort('lob')}>
                <span className="flex items-center justify-center gap-1">LOB <SortIcon col="lob" /></span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 cursor-pointer" onClick={() => toggleSort('specialist')}>
                <span className="flex items-center gap-1">Specialist assegnato <SortIcon col="specialist" /></span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Area AM Spec</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Area MNG Spec</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500">RAC</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((row, i) => (
              <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">{row.ragione_sociale}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.lob_cfg.color}`}>{row.lob}</span>
                </td>
                <td className="px-3 py-2">
                  {row.specialist
                    ? <span className="font-medium text-gray-800">{row.specialist}</span>
                    : <span className="text-gray-300 italic">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-500">{row.area_am_spec || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{row.area_mng_spec || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{row.rac || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun risultato</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 200 && (
        <p className="text-xs text-gray-400 text-center">Mostrati 200 su {filtered.length} — affina la ricerca</p>
      )}
    </div>
  );
}
