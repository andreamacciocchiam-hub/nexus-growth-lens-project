import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import { Search, X, Loader2, CheckCircle, Pencil, Trash2, Plus, Save, RefreshCw } from 'lucide-react';
import { useData } from '@/lib/DataContext.jsx';

const callFn = async (name, payload) => {
  const fn = httpsCallable(functionsInstance, name);
  const res = await fn(payload);
  return res.data;
};

const VALID_LOB = ['Cloud', 'Connettività', 'IoT', 'Other IT', 'Licensing', 'Security'];
const AREAS = ['MNO','SNO','LNO','MNE','SNE','LNE','MCS','SLCE','SLCS','IC'];
const ANNI = ['2024', '2025', '2026'];

function fmt(v) {
  if (!v && v !== 0) return '—';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(1)}K`;
  return `€${Number(v).toFixed(0)}`;
}

// ─── Modal Modifica Deal ───────────────────────────────────────────
function EditDealModal({ deal, onSave, onClose }) {
  const [form, setForm] = useState({ ...deal });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const fields = {
        lob: form.lob, area_rac: form.area_rac, rac: form.rac,
        attacco_difesa: form.attacco_difesa, tipo: form.tipo,
        serv_i_anno: Number(form.serv_i_anno) || 0,
        canoni: Number(form.canoni) || 0,
        differenziale_servizi: Number(form.differenziale_servizi) || 0,
        descrizione: form.descrizione, portafoglio: form.portafoglio,
        ragione_sociale_capogruppo: form.ragione_sociale_capogruppo,
      };
      await callFn('updateDeal', { dealId: deal.id, fields, anno: deal.anno });
      onSave({ ...deal, ...fields });
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const input = (label, key, type = 'text') => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  const select = (label, key, opts) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Modifica Deal — {deal.id_sdw}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {input('Cliente (Capogruppo)', 'ragione_sociale_capogruppo')}
          {input('Descrizione', 'descrizione')}
          {select('LOB', 'lob', VALID_LOB)}
          {select('Area RAC', 'area_rac', AREAS)}
          {input('RAC', 'rac')}
          {select('Attacco/Difesa', 'attacco_difesa', ['Attacco', 'Difesa'])}
          {select('Tipo', 'tipo', ['CTR', 'TTV'])}
          {input('Portafoglio', 'portafoglio')}
          {input('Serv. I Anno (€)', 'serv_i_anno', 'number')}
          {input('Canoni (€)', 'canoni', 'number')}
          {input('Differenziale (€)', 'differenziale_servizi', 'number')}
        </div>
        {error && <div className="mx-6 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nuovo Deal ──────────────────────────────────────────────
function NewDealModal({ anno, onSave, onClose }) {
  const [form, setForm] = useState({ anno, tipo: 'CTR', attacco_difesa: 'Attacco', mese: 0, portafoglio: 'Base' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.id_sdw || !form.ragione_sociale_capogruppo) { setError('ID SDW e Cliente sono obbligatori'); return; }
    setSaving(true);
    setError('');
    try {
      await callFn('createDeal', { deal: { ...form, serv_i_anno: Number(form.serv_i_anno)||0, canoni: Number(form.canoni)||0, differenziale_servizi: Number(form.differenziale_servizi)||0, mese: Number(form.mese)||0 } });
      onSave();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const input = (label, key, type = 'text', required = false) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  const select = (label, key, opts, required = false) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <select value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Nuovo Deal — Anno {anno}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {input('ID SDW', 'id_sdw', 'text', true)}
          {input('Cliente (Capogruppo)', 'ragione_sociale_capogruppo', 'text', true)}
          {input('Ragione Sociale', 'ragione_sociale')}
          {input('Descrizione', 'descrizione')}
          {select('LOB', 'lob', VALID_LOB)}
          {select('Area RAC', 'area_rac', AREAS)}
          {input('RAC', 'rac')}
          {select('Attacco/Difesa', 'attacco_difesa', ['Attacco', 'Difesa'])}
          {select('Tipo', 'tipo', ['CTR', 'TTV'])}
          {input('Portafoglio', 'portafoglio')}
          {input('Mese', 'mese', 'number')}
          {input('Serv. I Anno (€)', 'serv_i_anno', 'number')}
          {input('Canoni (€)', 'canoni', 'number')}
          {input('Differenziale (€)', 'differenziale_servizi', 'number')}
        </div>
        {error && <div className="mx-6 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Salvataggio...' : 'Crea Deal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagina Dati ───────────────────────────────────────────────────
export default function Dati() {
  const { reload: reloadAggregati } = useData();
  const [deals, setDeals] = useState([]);
  const [anno, setAnno] = useState('2026');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedAll, setLoadedAll] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [editDeal, setEditDeal] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cancelRef = useRef(false);
  const PAGE_SIZE = 50;

  useEffect(() => {
    cancelRef.current = false;
    setDeals([]);
    setPage(0);
    setLoadedAll(false);
    setLoadedCount(0);
    setSelected(new Set());
    setLoading(true);
    loadProgressively(anno);
    return () => { cancelRef.current = true; };
  }, [anno]);

  const loadProgressively = async (anno) => {
    const col = collection(db, 'deals');
    let all = [];
    let lastDoc = null;
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

  const filtered = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter(d =>
      d.ragione_sociale_capogruppo?.toLowerCase().includes(q) ||
      d.ragione_sociale?.toLowerCase().includes(q) ||
      d.id_sdw?.toLowerCase().includes(q) ||
      d.descrizione?.toLowerCase().includes(q)
    );
  }, [deals, search]);

  const pageDeals = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === pageDeals.length) setSelected(new Set());
    else setSelected(new Set(pageDeals.map(d => d.id)));
  };

  const handleDelete = async () => {
    if (!selected.size || !confirm(`Eliminare ${selected.size} deal? Questa operazione aggiornerà anche gli aggregati.`)) return;
    setDeleting(true);
    try {
      await callFn('deleteDeal', { dealIds: [...selected], anno });
      setDeals(prev => prev.filter(d => !selected.has(d.id)));
      setSelected(new Set());
      await reloadAggregati();
    } catch (e) { alert('Errore: ' + e.message); }
    setDeleting(false);
  };

  const handleEditSave = (updated) => {
    setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));
    setEditDeal(null);
    reloadAggregati();
  };

  const handleNewSave = () => {
    setShowNew(false);
    loadProgressively(anno);
    reloadAggregati();
  };

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dati di Dettaglio</h1>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            {loading ? <><Loader2 className="w-3 h-3 animate-spin text-blue-400" />Caricamento...</>
              : <>{filtered.length.toLocaleString('it-IT')} deal
                {!loadedAll && <><Loader2 className="w-3 h-3 animate-spin text-blue-300 ml-1" />{loadedCount.toLocaleString('it-IT')} caricati</>}
                {loadedAll && <><CheckCircle className="w-3 h-3 text-green-400 ml-1" />{loadedCount.toLocaleString('it-IT')} totali</>}
              </>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ANNI.map(a => (
            <button key={a} onClick={() => setAnno(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${anno === a ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {a}
            </button>
          ))}
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700">
            <Plus className="w-4 h-4" /> Nuovo deal
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Cerca cliente, ID SDW, descrizione..."
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
        </div>
        {selected.size > 0 && (
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Eliminazione...' : `Elimina ${selected.size}`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-sm">Caricamento dati {anno}...</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selected.size === pageDeals.length && pageDeals.length > 0} onChange={selectAll} className="rounded" />
                  </th>
                  <th className="text-left px-3 py-3 font-medium">Azioni</th>
                  <th className="text-left px-3 py-3 font-medium">ID SDW</th>
                  <th className="text-left px-3 py-3 font-medium">Cliente</th>
                  <th className="text-left px-3 py-3 font-medium">Descrizione</th>
                  <th className="text-center px-2 py-3 font-medium">LOB</th>
                  <th className="text-center px-2 py-3 font-medium">Area</th>
                  <th className="text-center px-2 py-3 font-medium">A/D</th>
                  <th className="text-center px-2 py-3 font-medium">Tipo</th>
                  <th className="text-right px-3 py-3 font-medium">Serv. I Anno</th>
                  <th className="text-right px-3 py-3 font-medium">Differenziale</th>
                </tr>
              </thead>
              <tbody>
                {pageDeals.map(d => (
                  <tr key={d.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${selected.has(d.id) ? 'bg-red-50' : ''}`}>
                    <td className="w-10 px-3 py-2"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} className="rounded" /></td>
                    <td className="px-3 py-2">
                      <button onClick={() => setEditDeal(d)} className="p-1 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">{d.id_sdw}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate">{d.ragione_sociale_capogruppo || d.ragione_sociale}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">{d.descrizione}</td>
                    <td className="px-2 py-2 text-center text-gray-500">{d.lob || '—'}</td>
                    <td className="px-2 py-2 text-center"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{d.area_rac}</span></td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.attacco_difesa === 'Attacco' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>{d.attacco_difesa}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.tipo === 'CTR' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700'}`}>{d.tipo || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(d.serv_i_anno)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(d.differenziale_servizi||0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(d.differenziale_servizi)}</td>
                  </tr>
                ))}
                {pageDeals.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-gray-400">Nessun risultato</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Pagina {page+1}/{totalPages||1} · {filtered.length.toLocaleString('it-IT')} deal</span>
            <div className="flex gap-2">
              <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">← Prec</button>
              <button disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">Succ →</button>
            </div>
          </div>
        </div>
      )}

      {editDeal && <EditDealModal deal={editDeal} onSave={handleEditSave} onClose={() => setEditDeal(null)} />}
      {showNew && <NewDealModal anno={anno} onSave={handleNewSave} onClose={() => setShowNew(false)} />}
    </div>
  );
}
