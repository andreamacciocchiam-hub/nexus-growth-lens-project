import { useState, useMemo } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import {
  Search, X, Loader2, CheckCircle, Pencil, Trash2, Save,
  Filter, ChevronDown, SlidersHorizontal
} from 'lucide-react';

const callFn = async (name, payload) => {
  const fn = httpsCallable(functionsInstance, name, { timeout: 300000 });
  const res = await fn(payload);
  return res.data;
};

const VALID_LOB = ['Cloud','Connettività','IoT','Other IT','Licensing','Security'];
const AREAS = ['MNO','SNO','LNO','MNE','SNE','LNE','MCS','SLCE','SLCS','IC'];
const ANNI = ['2024','2025','2026'];
const PAGE_SIZE = 100;

function fmt(v) {
  if (!v && v !== 0) return '—';
  const val = (v||0)*1000;
  if (Math.abs(val) >= 1_000_000_000) return `€${(val/1_000_000_000).toFixed(2)}B`;
  if (Math.abs(val) >= 1_000_000) return `€${(val/1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `€${(val/1_000).toFixed(1)}K`;
  return `€${Math.round(val)}`;
}

// ─── Modal Modifica ────────────────────────────────────────────────
function EditModal({ deal, onSave, onClose }) {
  const [form, setForm] = useState({ ...deal });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const fields = {
        lob: form.lob, area_rac: form.area_rac, rac: form.rac,
        attacco_difesa: form.attacco_difesa, tipo: form.tipo,
        serv_i_anno: Number(form.serv_i_anno)||0,
        canoni: Number(form.canoni)||0,
        differenziale_servizi: Number(form.differenziale_servizi)||0,
        ar: Number(form.ar)||0,
        ut: Number(form.ut)||0,
        descrizione: form.descrizione,
        ragione_sociale_capogruppo: form.ragione_sociale_capogruppo,
        ragione_sociale: form.ragione_sociale,
        portafoglio: form.portafoglio,
      };
      await callFn('updateDeal', { dealId: deal.id, fields, anno: deal.anno });
      onSave({ ...deal, ...fields });
    } catch(e) { setError(e.message); }
    setSaving(false);
  };

  const inp = (label, key, type='text') => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
    </div>
  );
  const sel = (label, key, opts) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">—</option>
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Modifica Deal — {deal.id_sdw}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {inp('ID SDW','id_sdw')}
          {inp('Cliente Capogruppo','ragione_sociale_capogruppo')}
          {inp('Ragione Sociale','ragione_sociale')}
          {inp('Descrizione','descrizione')}
          {sel('LOB','lob',VALID_LOB)}
          {sel('Area RAC','area_rac',AREAS)}
          {inp('RAC','rac')}
          {sel('Attacco/Difesa','attacco_difesa',['Attacco','Difesa'])}
          {sel('Tipo','tipo',['CTR','TTV'])}
          {inp('Portafoglio','portafoglio')}
          <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Valori (in K€)</p>
          </div>
          {inp('Serv. I Anno (K€)','serv_i_anno','number')}
          {inp('Canoni (K€)','canoni','number')}
          {inp('Differenziale (K€)','differenziale_servizi','number')}
          {inp('A/R (K€)','ar','number')}
          {inp('UT (K€)','ut','number')}
        </div>
        {error && <div className="mx-6 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}
            {saving?'Salvataggio...':'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function Dati() {
  const { deals, dealsLoading, dealsReady, dealsProgress, portafoglioMap, reload } = useData();
  const [anno, setAnno] = useState('2026');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [editDeal, setEditDeal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [localOverrides, setLocalOverrides] = useState({});
  const [filters, setFilters] = useState({
    lob:'', attacco_difesa:'', tipo:'', area_rac:'',
    rac_26:'', specialist_lss:'', specialist_sec:'', specialist_cloud:''
  });

  const sourceDeals = (deals[anno] || []).map(d => {
    const override = localOverrides[d.id];
    return override ? { ...d, ...override } : d;
  });

  const isLoading = dealsLoading[anno] && !dealsReady[anno];

  // Enrich con portafoglio
  const enriched = useMemo(() => sourceDeals.map(d => {
    const key = (d.ragione_sociale_capogruppo||d.ragione_sociale||'').toLowerCase().trim();
    return { ...d, _ptf: portafoglioMap[key] || {} };
  }), [sourceDeals, portafoglioMap]);

  // Valori unici per filtri
  const uniq = (field, ptf=false) => {
    const vals = enriched.map(d => ptf ? d._ptf[field] : d[field]).filter(Boolean);
    return [...new Set(vals)].sort();
  };

  // Totali per KPI bar
  const totals = useMemo(() => ({
    serv: enriched.reduce((s,d)=>s+(d.serv_i_anno||0),0),
    canoni: enriched.reduce((s,d)=>s+(d.canoni||0),0),
    diff: enriched.reduce((s,d)=>s+(d.differenziale_servizi||0),0),
    n: enriched.length,
  }), [enriched]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(d =>
        d.id_sdw?.toLowerCase().includes(q) ||
        d.ragione_sociale_capogruppo?.toLowerCase().includes(q) ||
        d.ragione_sociale?.toLowerCase().includes(q) ||
        d.descrizione?.toLowerCase().includes(q)
      );
    }
    if (filters.lob) r = r.filter(d=>d.lob===filters.lob);
    if (filters.attacco_difesa) r = r.filter(d=>d.attacco_difesa===filters.attacco_difesa);
    if (filters.tipo) r = r.filter(d=>d.tipo===filters.tipo);
    if (filters.area_rac) r = r.filter(d=>d.area_rac===filters.area_rac);
    if (filters.rac_26) r = r.filter(d=>d._ptf.rac_26===filters.rac_26);
    if (filters.specialist_lss) r = r.filter(d=>d._ptf.acc_specialist_lss===filters.specialist_lss);
    if (filters.specialist_sec) r = r.filter(d=>d._ptf.acc_specialist_sec===filters.specialist_sec);
    if (filters.specialist_cloud) r = r.filter(d=>d._ptf.acc_specialist_cloud_iot_5g===filters.specialist_cloud);
    return r;
  }, [enriched, search, filters]);

  // Totali filtrati
  const filtTotals = useMemo(() => ({
    serv: filtered.reduce((s,d)=>s+(d.serv_i_anno||0),0),
    canoni: filtered.reduce((s,d)=>s+(d.canoni||0),0),
    diff: filtered.reduce((s,d)=>s+(d.differenziale_servizi||0),0),
    ar: filtered.reduce((s,d)=>s+(d.ar||0),0),
    n: filtered.length,
  }), [filtered]);

  const paged = filtered.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const hasFilters = search || Object.values(filters).some(Boolean);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const resetFilters = () => {
    setSearch('');
    setFilters({ lob:'', attacco_difesa:'', tipo:'', area_rac:'', rac_26:'', specialist_lss:'', specialist_sec:'', specialist_cloud:'' });
    setPage(0);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectPage = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(d=>d.id)));
  };

  const handleDelete = async () => {
    if (!selected.size || !confirm(`Eliminare ${selected.size} deal?`)) return;
    setDeleting(true);
    try {
      await callFn('deleteDeal', { dealIds: [...selected], anno });
      setLocalOverrides(prev => {
        const next = { ...prev };
        selected.forEach(id => { next[id] = { _deleted: true }; });
        return next;
      });
      setSelected(new Set());
      reload();
    } catch(e) { alert('Errore: '+e.message); }
    setDeleting(false);
  };

  const handleEditSave = (updated) => {
    setLocalOverrides(prev => ({ ...prev, [updated.id]: updated }));
    setEditDeal(null);
    reload();
  };

  const handleAnnoChange = (a) => {
    setAnno(a); setPage(0); setSearch('');
    setSelected(new Set()); setLocalOverrides({});
  };

  const sel = (key, label, vals) => (
    <select value={filters[key]||''} onChange={e=>{setFilters(p=>({...p,[key]:e.target.value}));setPage(0);}}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
      <option value="">{label}</option>
      {vals.map(v=><option key={v} value={v}>{v}</option>)}
    </select>
  );

  return (
    <div className="p-6 space-y-4 min-h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dati di Dettaglio</h1>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            {isLoading
              ? <><Loader2 className="w-3 h-3 animate-spin text-blue-400"/>Caricamento {anno}... {(dealsProgress[anno]||0).toLocaleString('it-IT')} record</>
              : <>{filtered.length.toLocaleString('it-IT')} deal
                  {hasFilters && ` su ${enriched.length.toLocaleString('it-IT')} totali`}
                  <CheckCircle className="w-3 h-3 text-green-400"/>
                </>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ANNI.map(a => (
            <button key={a} onClick={()=>handleAnnoChange(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${anno===a?'bg-blue-600 text-white border-blue-600 shadow':'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* KPI bar */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Portafoglio', value: fmt(filtTotals.serv), sub: hasFilters ? `su ${fmt(totals.serv)} totali` : null, color: 'text-blue-600' },
            { label: 'Canoni', value: fmt(filtTotals.canoni), color: 'text-purple-600' },
            { label: 'Differenziale', value: fmt(filtTotals.diff), color: filtTotals.diff>=0?'text-green-600':'text-red-500' },
            { label: 'A/R', value: fmt(filtTotals.ar), color: 'text-orange-500' },
            { label: 'Deal', value: filtTotals.n.toLocaleString('it-IT'), sub: hasFilters?`su ${totals.n.toLocaleString('it-IT')} totali`:null, color: 'text-gray-700' },
          ].map((k,i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
              <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
              {k.sub && <p className="text-[10px] text-gray-400">{k.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Filtri */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
              placeholder="ID SDW, Ragione Sociale, Descrizione..."
              className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400"/></button>}
          </div>
          <button onClick={()=>setShowFilters(v=>!v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${showFilters?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            <SlidersHorizontal className="w-3.5 h-3.5"/>
            Filtri
            {activeCount>0&&<span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{activeCount}</span>}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters?'rotate-180':''}`}/>
          </button>
          {selected.size>0 && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50">
              {deleting?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}
              {deleting?'Eliminazione...':`Elimina ${selected.size}`}
            </button>
          )}
          {hasFilters&&<button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">Rimuovi filtri</button>}
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {sel('lob','LOB',uniq('lob'))}
              {sel('attacco_difesa','Attacco/Difesa',['Attacco','Difesa'])}
              {sel('tipo','Tipo (CTR/TTV)',['CTR','TTV'])}
              {sel('area_rac','Area RAC',uniq('area_rac'))}
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Da Anagrafica</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {sel('rac_26','RAC 26',uniq('rac_26',true))}
                {sel('specialist_lss','Specialist LSS',uniq('acc_specialist_lss',true))}
                {sel('specialist_sec','Specialist SEC',uniq('acc_specialist_sec',true))}
                {sel('specialist_cloud','Specialist Cloud/IoT',uniq('acc_specialist_cloud_iot_5g',true))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabella */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400"/>
          <span className="text-sm">Caricamento {anno}... {(dealsProgress[anno]||0).toLocaleString('it-IT')} record</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={selected.size===paged.length&&paged.length>0} onChange={selectPage} className="rounded"/>
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">✏️</th>
                  <th className="px-3 py-2.5 text-left font-semibold">ID SDW</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Capogruppo</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Ragione Sociale</th>
                  <th className="px-3 py-2.5 text-left font-semibold max-w-[160px]">Descrizione</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Area RAC</th>
                  <th className="px-2 py-2.5 text-center font-semibold">LOB</th>
                  <th className="px-2 py-2.5 text-center font-semibold">A/D</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Serv. I Anno</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Canoni</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Differenziale</th>
                  <th className="px-3 py-2.5 text-right font-semibold">A/R</th>
                  <th className="px-3 py-2.5 text-right font-semibold">UT</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Servizi Tot.</th>
                  {/* Campi anagrafica */}
                  <th className="px-3 py-2.5 text-left font-semibold border-l border-blue-100 bg-blue-50/50 text-blue-600">RAC 26</th>
                  <th className="px-3 py-2.5 text-left font-semibold bg-blue-50/50 text-blue-600">Area MNG 26</th>
                  <th className="px-3 py-2.5 text-left font-semibold bg-blue-50/50 text-blue-600">Struttura Sales</th>
                  <th className="px-3 py-2.5 text-left font-semibold bg-blue-50/50 text-blue-600">Spec. LSS</th>
                  <th className="px-3 py-2.5 text-left font-semibold bg-blue-50/50 text-blue-600">Spec. SEC</th>
                  <th className="px-3 py-2.5 text-left font-semibold bg-blue-50/50 text-blue-600">Spec. Cloud/IoT</th>
                  <th className="px-3 py-2.5 text-left font-semibold bg-blue-50/50 text-blue-600">IoT</th>
                </tr>
              </thead>
              <tbody>
                {paged.filter(d=>!d._deleted).map((d,i) => (
                  <tr key={d.id} className={`border-b border-gray-50 hover:bg-blue-50/20 transition-colors ${selected.has(d.id)?'bg-red-50':i%2===0?'bg-white':'bg-gray-50/30'}`}>
                    <td className="w-10 px-3 py-2"><input type="checkbox" checked={selected.has(d.id)} onChange={()=>toggleSelect(d.id)} className="rounded"/></td>
                    <td className="px-3 py-2">
                      <button onClick={()=>setEditDeal(d)} className="p-1 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700">
                        <Pencil className="w-3.5 h-3.5"/>
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{d.id_sdw}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate" title={d.ragione_sociale_capogruppo}>{d.ragione_sociale_capogruppo||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={d.ragione_sociale}>{d.ragione_sociale||'—'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate" title={d.descrizione}>{d.descrizione||'—'}</td>
                    <td className="px-2 py-2 text-center"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{d.area_rac||'—'}</span></td>
                    <td className="px-2 py-2 text-center text-gray-500 max-w-[80px] truncate">{d.lob||'—'}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.attacco_difesa==='Attacco'?'bg-orange-100 text-orange-700':'bg-indigo-100 text-indigo-700'}`}>{d.attacco_difesa||'—'}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.tipo==='CTR'?'bg-teal-100 text-teal-700':'bg-violet-100 text-violet-700'}`}>{d.tipo||'—'}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(d.serv_i_anno)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(d.canoni)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(d.differenziale_servizi||0)>=0?'text-green-600':'text-red-500'}`}>{fmt(d.differenziale_servizi)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(d.ar)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(d.ut)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(d.servizi_totali)}</td>
                    {/* Anagrafica */}
                    <td className="px-3 py-2 text-gray-700 border-l border-blue-100 bg-blue-50/20">{d._ptf.rac_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-500 bg-blue-50/20">{d._ptf.area_mng_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-500 bg-blue-50/20">{d._ptf.struttura_sales_26||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf.acc_specialist_lss||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf.acc_specialist_sec||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf.acc_specialist_cloud_iot_5g||'—'}</td>
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/20">{d._ptf.iot||'—'}</td>
                  </tr>
                ))}
                {paged.length===0&&<tr><td colSpan={23} className="text-center py-8 text-gray-400">Nessun risultato</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Pagina {page+1}/{totalPages||1} · {filtered.length.toLocaleString('it-IT')} deal</span>
            <div className="flex gap-2">
              <button disabled={page===0} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">← Prec</button>
              <button disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100">Succ →</button>
            </div>
          </div>
        </div>
      )}

      {editDeal && <EditModal deal={editDeal} onSave={handleEditSave} onClose={()=>setEditDeal(null)}/>}
    </div>
  );
}
