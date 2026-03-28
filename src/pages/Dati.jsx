import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { Search, ChevronDown, ChevronUp, X, Trash2, Loader2 } from 'lucide-react';
import DealsFilters, { EMPTY_FILTERS, applyFilters } from '../components/bi/DealsFilters';
import PortafoglioFilters, { EMPTY_PTF_FILTERS, applyPortafoglioFilters } from '../components/bi/PortafoglioFilters';
import { enrichDealsWithPortfolio } from '../components/bi/enrichDeals';
import { deleteDoc, doc } from 'firebase/firestore';

const MESI = ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function fmt(v) {
  if (!v && v !== 0) return '—';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(1)}K`;
  return `€${Number(v).toFixed(0)}`;
}

// Carica tutti i record di una collection con un filtro, paginando a 100
async function loadAll(collectionName, filters = {}) {
  const col = collection(db, collectionName);
  let all = [];
  let lastDoc = null;

  while (true) {
    const constraints = [col];
    for (const [k, v] of Object.entries(filters)) {
      constraints.push(where(k, '==', v));
    }
    constraints.push(limit(100));
    if (lastDoc) constraints.push(startAfter(lastDoc));

    const q = query(...constraints);
    const snap = await getDocs(q);
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    await new Promise(r => setTimeout(r, 50));
  }
  return all;
}

function SortIcon({ dir }) {
  if (!dir) return <ChevronDown className="w-3 h-3 text-gray-300" />;
  return dir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
}

function DataTable({ rows, columns, searchKeys, onDelete }) {
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
    if (!confirm(`Eliminare ${selected.size} righe?`)) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await deleteDoc(doc(db, 'deals', id));
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
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Cerca..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>}
          </div>
          <span className="text-xs text-gray-400">{total.toLocaleString('it-IT')} record</span>
        </div>
        {selected.size > 0 && (
          <button onClick={handleDeleteSelected} disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> {deleting ? 'Eliminando...' : `Elimina ${selected.size}`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox"
                  checked={selected.size === paged.length && paged.length > 0}
                  onChange={() => {
                    const newSel = new Set();
                    if (selected.size !== paged.length) paged.forEach(r => newSel.add(r.id));
                    setSelected(newSel);
                  }} className="rounded" />
              </th>
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px] ${col.sortable !== false ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}`}>
                  <div className="flex items-center gap-1">{col.label}{col.sortable !== false && <SortIcon dir={sort.key === col.key ? sort.dir : null} />}</div>
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
            {paged.length === 0 && <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Nessun dato</td></tr>}
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
  { key: 'rac', label: 'RAC' },
  { key: 'area_mng', label: 'Area MNG' },
  { key: 'struttura_sales', label: 'Struttura Sales' },
  { key: 'attacco_difesa', label: 'Att/Dif' },
  { key: 'lob', label: 'LOB' },
  { key: 'lob_originale', label: 'LOB originale' },
  { key: 'specialist', label: 'Specialist' },
  { key: 'mese', label: 'Mese', render: v => MESI[v] || v },
  { key: 'durata', label: 'Durata', align: 'right' },
  { key: 'serv_i_anno', label: 'Serv. I Anno', align: 'right', render: v => fmt(v) },
  { key: 'differenziale_servizi', label: 'Diff. Serv.', align: 'right', render: v => fmt(v) },
];

const PTF_COLS = [
  { key: 'portafoglio_nome', label: 'Portafoglio' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'capogruppo', label: 'Capogruppo' },
  { key: 'cf', label: 'CF' },
  { key: 'segmento_26', label: 'Segmento 2026' },
  { key: 'area_rac', label: 'Area RAC' },
  { key: 'rac', label: 'RAC' },
  { key: 'area_rac_26', label: 'Area RAC 2026' },
  { key: 'rac_26', label: 'RAC 2026' },
];

export default function Dati() {
  const [tab, setTab] = useState('consuntivi');
  const [deals, setDeals] = useState([]);
  const [ptfClienti, setPtfClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [ptfFilters, setPtfFilters] = useState(EMPTY_PTF_FILTERS);
  const [selectedAnno, setSelectedAnno] = useState('2026');

  const loadData = async (anno) => {
    setLoading(true);
    setDeals([]);
    setLoadedCount(0);

    try {
      // Carica deals con paginazione reale Firestore (startAfter)
      const col = collection(db, 'deals');
      let allDeals = [];
      let lastDoc = null;

      while (true) {
        const { startAfter } = await import('firebase/firestore');
        const constraints = [
          col,
          where('anno', '==', anno),
          limit(100)
        ];
        if (lastDoc) constraints.push(startAfter(lastDoc));
        const snap = await getDocs(query(...constraints));
        if (snap.empty) break;
        snap.docs.forEach(d => allDeals.push({ id: d.id, ...d.data() }));
        setLoadedCount(allDeals.length);
        if (snap.docs.length < 100) break;
        lastDoc = snap.docs[snap.docs.length - 1];
        await new Promise(r => setTimeout(r, 50));
      }

      // Carica portafoglio
      const ptfCol = collection(db, 'portafoglio_clienti');
      let allPtf = [];
      let lastPtfDoc = null;

      while (true) {
        const { startAfter } = await import('firebase/firestore');
        const constraints = [ptfCol, limit(100)];
        if (lastPtfDoc) constraints.push(startAfter(lastPtfDoc));
        const snap = await getDocs(query(...constraints));
        if (snap.empty) break;
        snap.docs.forEach(d => allPtf.push({ id: d.id, ...d.data() }));
        if (snap.docs.length < 100) break;
        lastPtfDoc = snap.docs[snap.docs.length - 1];
        await new Promise(r => setTimeout(r, 50));
      }

      const enriched = enrichDealsWithPortfolio(allDeals, allPtf);
      setDeals(enriched);
      setPtfClienti(allPtf);
    } catch (e) {
      console.error('Errore caricamento dati:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(selectedAnno); }, [selectedAnno]);

  const filteredDeals = useMemo(() => applyFilters(deals, filters), [deals, filters]);
  const filteredPtf = useMemo(() => applyPortafoglioFilters(ptfClienti, ptfFilters), [ptfClienti, ptfFilters]);

  return (
    <div className="p-6 space-y-5 min-h-full bg-gray-50">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Dati di Dettaglio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? `Caricamento anno ${selectedAnno}... ${loadedCount.toLocaleString('it-IT')} record` : 'Visualizza e gestisci i dati caricati'}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['2024', '2025', '2026'].map(a => (
            <button key={a} onClick={() => setSelectedAnno(a)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedAnno === a ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'consuntivi', label: `Consuntivi (${filteredDeals.length.toLocaleString('it-IT')})` },
          { key: 'portafoglio', label: `Portafoglio Clienti (${filteredPtf.length.toLocaleString('it-IT')})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'consuntivi' && !loading && <DealsFilters deals={deals} filters={filters} onChange={setFilters} />}
      {tab === 'portafoglio' && !loading && <PortafoglioFilters rows={ptfClienti} filters={ptfFilters} onChange={setPtfFilters} />}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm">Caricamento anno {selectedAnno}...</p>
          <p className="text-xs">{loadedCount.toLocaleString('it-IT')} record caricati</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          {tab === 'consuntivi' && (
            <DataTable rows={filteredDeals} columns={DEAL_COLS}
              searchKeys={['ragione_sociale', 'ragione_sociale_capogruppo', 'id_sdw', 'area_rac', 'rac', 'lob']}
              onDelete={() => loadData(selectedAnno)} />
          )}
          {tab === 'portafoglio' && (
            <DataTable rows={filteredPtf} columns={PTF_COLS}
              searchKeys={['ragione_sociale', 'capogruppo', 'cf', 'rac', 'area_rac', 'portafoglio_nome']}
              onDelete={() => loadData(selectedAnno)} />
          )}
        </div>
      )}
    </div>
  );
}
