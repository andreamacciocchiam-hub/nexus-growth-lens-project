import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react';
import DealsFilters, { EMPTY_FILTERS, applyFilters } from '../components/bi/DealsFilters';
import PortafoglioFilters, { EMPTY_PTF_FILTERS, applyPortafoglioFilters } from '../components/bi/PortafoglioFilters';
import { enrichDealsWithPortfolio } from '../components/bi/enrichDeals';
import { AlertCircle } from 'lucide-react';

const MESI = ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
function fmt(v) {
  if (!v && v !== 0) return '—';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(1)}K`;
  return `€${Number(v).toFixed(0)}`;
}

function SortIcon({ dir }) {
  if (!dir) return <ChevronDown className="w-3 h-3 text-gray-300" />;
  return dir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
}

function DataTable({ rows, columns, searchKeys, entityType, onDelete }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: null });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(row => searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(q)));
    }
    if (sort.key) {
      r = [...r].sort((a, b) => {
        const av = a[sort.key] ?? '';
        const bv = b[sort.key] ?? '';
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, search, sort, searchKeys]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  };

  const toggleRow = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const confirmed = confirm(`Eliminare ${selected.size} righe?`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await base44.entities[entityType].delete(id);
      }
      onDelete();
      setSelected(new Set());
    } catch (e) {
      alert('Errore durante eliminazione: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Cerca..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>}
          </div>
          <span className="text-xs text-gray-400">{total.toLocaleString('it-IT')} record</span>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Elimina {selected.size}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.size === paged.length && paged.length > 0}
                  onChange={() => {
                    const newSel = new Set();
                    if (selected.size !== paged.length) paged.forEach(r => newSel.add(r.id));
                    setSelected(newSel);
                  }}
                  className="rounded"
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px] ${col.sortable !== false ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && <SortIcon dir={sort.key === col.key ? sort.dir : null} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={row.id || i} className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} ${selected.has(row.id) ? 'bg-red-50' : ''}`}>
                <td className="w-10 px-3 py-2"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} className="rounded" /></td>
                {columns.map(col => (
                  <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right font-medium' : 'text-gray-700'}`}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Nessun dato</td></tr>
            )}
          </tbody>
        </table>
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
    </div>
  );
}

const DEAL_COLS = [
  { key: 'anno', label: 'Anno' },
  { key: 'portafoglio', label: 'Portafoglio' },
  { key: 'tipo', label: 'Tipo', render: v => v ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v === 'CTR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{v}</span> : '—' },
  { key: 'mese', label: 'Mese', render: v => MESI[v] || v },
  { key: 'id_sdw', label: 'ID SDW' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'ragione_sociale_capogruppo', label: 'Capogruppo' },
  { key: 'area_rac', label: 'Area RAC' },
  { key: 'new_area_rac', label: 'New Area RAC' },
  { key: 'rac', label: 'RAC (attuale)', render: (v, row) => row._rac_originale && row._rac_originale !== v ? <span title={`Originale: ${row._rac_originale}`} className="text-blue-700 font-medium">{v}</span> : (v ?? '—') },
  { key: 'area_mng', label: 'Area MNG' },
  { key: 'struttura_sales', label: 'Struttura Sales' },
  { key: 'struttura_sdw', label: 'Struttura SDW' },
  { key: 'attacco_difesa', label: 'Att/Dif' },
  { key: 'ambito', label: 'Ambito' },
  { key: 'new_ambito', label: 'New Ambito' },
  { key: 'lob', label: 'LOB' },
  { key: 'lob_originale', label: 'LOB originale', render: (v, row) => v && v !== row.lob ? <span className="text-gray-400 italic">{v}</span> : '—' },
  { key: 'specialist', label: 'Specialist' },
  { key: 'specialist_no_double', label: 'Specialist No Double' },
  { key: 'durata', label: 'Durata (mesi)', align: 'right' },
  { key: 'new_entry', label: 'New Entry', render: v => v ? 'Si' : 'No' },
  { key: 'fornitore', label: 'Fornitore' },
  { key: 'descrizione', label: 'Descrizione' },
  { key: 'codice_progetto', label: 'Codice Progetto' },
  { key: 'serv_i_anno', label: 'Serv. I Anno', align: 'right', render: v => fmt(v) },
  { key: 'servizi_totali', label: 'Servizi Totali', align: 'right', render: v => fmt(v) },
  { key: 'canoni', label: 'Canoni', align: 'right', render: v => fmt(v) },
  { key: 'ar', label: 'A/R', align: 'right', render: v => fmt(v) },
  { key: 'ut', label: 'UT', align: 'right', render: v => fmt(v) },
  { key: 'tot_ctr', label: 'Tot Ctr', align: 'right', render: v => fmt(v) },
  { key: 'ric_i_anno', label: 'Ric. I Anno', align: 'right', render: v => fmt(v) },
  { key: 'differenziale_servizi', label: 'Diff. Serv.', align: 'right', render: v => fmt(v) },
  { key: 'vendita', label: 'Vendita', align: 'right', render: v => fmt(v) },
];

const PTF_COLS = [
  { key: 'portafoglio_nome', label: 'Portafoglio' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'capogruppo', label: 'Capogruppo' },
  { key: 'cf', label: 'CF' },
  { key: 'cf_capogruppo', label: 'CF Capogruppo' },
  { key: 'vertical_gruppo', label: 'Vertical' },
  { key: 'segmento_26', label: 'Segmento 2026' },
  { key: 'area_rac', label: 'Area RAC AS-IS' },
  { key: 'rac', label: 'RAC AS-IS' },
  { key: 'area_mng', label: 'Area MNG AS-IS' },
  { key: 'struttura_sales', label: 'Struttura Sales AS-IS' },
  { key: 'area_rac_26', label: 'Area RAC 2026' },
  { key: 'rac_26', label: 'RAC 2026' },
  { key: 'area_mng_26', label: 'Area MNG 2026' },
  { key: 'struttura_sales_26', label: 'Struttura Sales 2026' },
];

export default function Dati() {
  const [tab, setTab] = useState('consuntivi');
  const [deals, setDeals] = useState([]);
  const [ptfClienti, setPtfClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [ptfFilters, setPtfFilters] = useState(EMPTY_PTF_FILTERS);
  const [selectedAnno, setSelectedAnno] = useState('2026');

  const loadDeals = async (anno) => {
  const BATCH = 1000;
  let allDeals = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.Deal.filter({ anno }, '-created_date', BATCH, skip);
    if (!batch || batch.length === 0) break;
    allDeals = allDeals.concat(batch);
    if (batch.length < BATCH) break;
    skip += BATCH;
    }
  return allDeals;
  };

  const loadPtf = async () => {
    const BATCH = 1000;
    let allPtf = [];
    let skip = 0;
    while (true) {
      const batch = await base44.entities.PortafoglioCliente.list('-created_date', BATCH, skip);
      if (!batch || batch.length === 0) break;
      allPtf = allPtf.concat(batch);
      if (batch.length < BATCH) break;
      skip += BATCH;
    }
    return allPtf;
  };

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setDeals([]);
      try {
        const [allDeals, allPtf] = await Promise.all([loadDeals(selectedAnno), loadPtf()]);
        const enrichedDeals = enrichDealsWithPortfolio(allDeals, allPtf);
        setDeals(enrichedDeals);
        setPtfClienti(allPtf);
      } catch (e) {
        console.error('Errore caricamento dati:', e);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [selectedAnno]);

  const reloadData = async () => {
    setLoading(true);
    try {
      const [allDeals, allPtf] = await Promise.all([loadDeals(selectedAnno), loadPtf()]);
      const enrichedDeals = enrichDealsWithPortfolio(allDeals, allPtf);
      setDeals(enrichedDeals);
      setPtfClienti(allPtf);
    } catch (e) {
      console.error('Errore reload:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = useMemo(() => applyFilters(deals, filters), [deals, filters]);
  const filteredPtf = useMemo(() => applyPortafoglioFilters(ptfClienti, ptfFilters), [ptfClienti, ptfFilters]);

  return (
    <div className="p-6 space-y-5 min-h-full bg-gray-50">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Dati di Dettaglio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visualizza esattamente i dati caricati — Consuntivi e Portafoglio Clienti</p>
        </div>
        {/* Anno selector */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['2024', '2025', '2026'].map(a => (
            <button
              key={a}
              onClick={() => setSelectedAnno(a)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedAnno === a ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'consuntivi', label: `Consuntivi (${filteredDeals.length.toLocaleString('it-IT')})` },
          { key: 'portafoglio', label: `Portafoglio Clienti (${filteredPtf.length.toLocaleString('it-IT')})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'consuntivi' && !loading && (
        <DealsFilters deals={deals} filters={filters} onChange={setFilters} />
      )}
      {tab === 'portafoglio' && !loading && (
        <PortafoglioFilters rows={ptfClienti} filters={ptfFilters} onChange={setPtfFilters} />
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          Caricamento anno {selectedAnno} in corso...
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          {tab === 'consuntivi' && (
            <DataTable
              rows={filteredDeals}
              columns={DEAL_COLS}
              searchKeys={['ragione_sociale', 'ragione_sociale_capogruppo', 'id_sdw', 'area_rac', 'rac', 'lob', 'portafoglio']}
              entityType="Deal"
              onDelete={reloadData}
            />
          )}
          {tab === 'portafoglio' && (
            <DataTable
              rows={filteredPtf}
              columns={PTF_COLS}
              searchKeys={['ragione_sociale', 'capogruppo', 'cf', 'rac', 'area_rac', 'portafoglio_nome']}
              entityType="PortafoglioCliente"
              onDelete={reloadData}
            />
          )}
        </div>
      )}
    </div>
  );
}