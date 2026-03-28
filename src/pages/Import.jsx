import { useState, useEffect, useRef, useMemo } from 'react';
import { ref, uploadBytesResumable, listAll, getMetadata } from 'firebase/storage';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { storage, functionsInstance, db } from '@/api/firebaseClient';
import { useData } from '@/lib/DataContext.jsx';
import SpecialistTable from '../components/bi/SpecialistTable.jsx';
import {
  Cloud, Upload, Play, Trash2, RefreshCw, CheckCircle,
  AlertCircle, Loader2, FileSpreadsheet, Database,
  TrendingUp, BarChart2, Clock, HardDrive, Zap, X,
  Users, ChevronDown, Eye, Star
} from 'lucide-react';

const callFn = async (name, payload) => {
  const fn = httpsCallable(functionsInstance, name, { timeout: 600000 });
  const res = await fn(payload);
  return res.data;
};

const ANNI = ['2024', '2025', '2026'];
const ANNO_COLORS = {
  '2024': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', accent: 'bg-gray-500', light: 'bg-gray-50', bar: 'bg-gray-400' },
  '2025': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', accent: 'bg-amber-500', light: 'bg-amber-50', bar: 'bg-amber-400' },
  '2026': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', accent: 'bg-blue-600', light: 'bg-blue-50', bar: 'bg-blue-500' },
};

// Parsing naming convention
function parseFileName(name) {
  const base = name.split('/').pop().replace('.xlsx', '').toLowerCase();
  if (base.startsWith('dati')) {
    const rest = base.replace('dati', '');
    if (rest === '2024') return { type: 'consuntivo', anno: '2024', mese: null };
    if (rest === '2025') return { type: 'consuntivo', anno: '2025', mese: null };
    // es. 022026
    const m = rest.match(/^(\d{2})(\d{4})$/);
    if (m) return { type: 'consuntivo', anno: m[2], mese: parseInt(m[1]) };
  }
  if (base.startsWith('portafoglioclienti')) {
    const rest = base.replace('portafoglioclienti', '');
    const m = rest.match(/^(\d{2})(\d{4})$/);
    if (m) return { type: 'portafoglio', mese: parseInt(m[1]), anno: m[2] };
    return { type: 'portafoglio', mese: null, anno: null };
  }
  return { type: 'unknown' };
}

function formatSize(b) {
  if (!b) return '—';
  if (b >= 1_000_000) return `${(b/1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b/1_000).toFixed(0)} KB`;
  return `${b} B`;
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}
function mesiNome(m) { return ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][m] || m; }

function LogLine({ entry }) {
  const cfg = {
    success: { icon: <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />, text: 'text-green-300' },
    error:   { icon: <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />,   text: 'text-red-300' },
    warn:    { icon: <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />, text: 'text-amber-300' },
    info:    { icon: <Clock className="w-3 h-3 text-gray-500 flex-shrink-0" />,        text: 'text-gray-300' },
  }[entry.type] || { icon: <Clock className="w-3 h-3 text-gray-500 flex-shrink-0" />, text: 'text-gray-300' };
  return (
    <div className="flex items-start gap-2 font-mono text-[11px] leading-relaxed">
      {cfg.icon}
      <span className="text-gray-500 flex-shrink-0">{entry.time}</span>
      <span className={cfg.text}>{entry.msg}</span>
    </div>
  );
}

export default function Import() {
  const { aggregati, reload: reloadAggregati } = useData();
  const [tab, setTab] = useState('consuntivi');

  // Storage files
  const [consuntiviFiles, setConsuntiviFiles] = useState([]);
  const [portafoglioFiles, setPortafoglioFiles] = useState([]);
  const [activeConsuntivi, setActiveConsuntivi] = useState({}); // { anno: path }
  const [activePortafoglio, setActivePortafoglio] = useState(null);
  const [loadingStorage, setLoadingStorage] = useState(true);

  // Operations
  const [uploading, setUploading] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [importing, setImporting] = useState({});
  const [enriching, setEnriching] = useState({});
  const [aggregating, setAggregating] = useState(false);

  // Portafoglio data per SpecialistTable
  const [portafoglioData, setPortafoglioData] = useState([]);

  const [logs, setLogs] = useState([]);
  const logRef = useRef();

  useEffect(() => { loadStorage(); loadPortafoglioData(); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString('it-IT') }]);
  };

  const loadStorage = async () => {
    setLoadingStorage(true);
    try {
      // Consuntivi
      const cRef = ref(storage, 'consuntivi/');
      const cList = await listAll(cRef);
      const cFiles = await Promise.all(cList.items.map(async item => {
        const meta = await getMetadata(item);
        const parsed = parseFileName(item.name);
        return { name: item.name, path: item.fullPath, size: parseInt(meta.size||0), updated: meta.updated, basename: item.name.split('/').pop(), ...parsed };
      }));
      setConsuntiviFiles(cFiles.sort((a,b) => b.updated?.localeCompare(a.updated||'')));

      // Auto-seleziona il file più recente per ogni anno
      const autoActive = {};
      ANNI.forEach(anno => {
        const match = cFiles.filter(f => f.anno === anno).sort((a,b) => b.updated?.localeCompare(a.updated||''))[0];
        if (match) autoActive[anno] = match.path;
      });
      setActiveConsuntivi(autoActive);

      // Portafoglio
      try {
        const pRef = ref(storage, 'portafoglio/');
        const pList = await listAll(pRef);
        const pFiles = await Promise.all(pList.items.map(async item => {
          const meta = await getMetadata(item);
          const parsed = parseFileName(item.name);
          return { name: item.name, path: item.fullPath, size: parseInt(meta.size||0), updated: meta.updated, basename: item.name.split('/').pop(), ...parsed };
        }));
        const sorted = pFiles.sort((a,b) => b.updated?.localeCompare(a.updated||''));
        setPortafoglioFiles(sorted);
        if (sorted.length > 0 && !activePortafoglio) setActivePortafoglio(sorted[0].path);
      } catch (_) {}
    } catch (e) {
      addLog('Errore caricamento Storage: ' + e.message, 'error');
    }
    setLoadingStorage(false);
  };

  const loadPortafoglioData = async () => {
    try {
      const snap = await getDocs(collection(db, 'portafoglio_clienti'));
      setPortafoglioData(snap.docs.map(d => d.data()));
    } catch (e) { console.error(e); }
  };

  const handleUpload = (folder, file, anno) => {
    if (!file) return;
    const key = anno || 'portafoglio';
    setUploading(prev => ({ ...prev, [key]: true }));
    setUploadProgress(prev => ({ ...prev, [key]: 0 }));
    addLog(`▶ Upload ${file.name} su ${folder}...`);

    const storageRef = ref(storage, `${folder}/${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed',
      snap => setUploadProgress(prev => ({ ...prev, [key]: Math.round(snap.bytesTransferred/snap.totalBytes*100) })),
      err => { addLog(`✗ Upload fallito: ${err.message}`, 'error'); setUploading(prev => ({ ...prev, [key]: false })); },
      () => { addLog(`✓ File caricato: ${file.name}`, 'success'); setUploading(prev => ({ ...prev, [key]: false })); loadStorage(); }
    );
  };

  const handleImportConsuntivo = async (anno) => {
    const path = activeConsuntivi[anno];
    if (!path) return;
    setImporting(prev => ({ ...prev, [anno]: true }));
    addLog(`▶ Import consuntivo ${anno} da Storage...`);
    try {
      const data = await callFn('importFromStorage', { storagePath: path, anno });
      addLog(`✓ ${anno}: ${data.inserted?.toLocaleString('it-IT')} record importati`, 'success');
      addLog(`✓ Aggregati ${anno} ricalcolati`, 'success');
      await reloadAggregati();
    } catch (e) { addLog(`✗ Import ${anno} fallito: ${e.message}`, 'error'); }
    setImporting(prev => ({ ...prev, [anno]: false }));
  };

  const handleImportPortafoglio = async () => {
    if (!activePortafoglio) return;
    setImporting(prev => ({ ...prev, portafoglio: true }));
    addLog(`▶ Import portafoglio clienti da Storage...`);
    try {
      const data = await callFn('importPortafoglioFromStorage', { storagePath: activePortafoglio, portafoglio_nome: 'Base' });
      addLog(`✓ Portafoglio: ${data.inserted} clienti importati con campi specialist`, 'success');
      await loadPortafoglioData();
    } catch (e) { addLog(`✗ Import portafoglio fallito: ${e.message}`, 'error'); }
    setImporting(prev => ({ ...prev, portafoglio: false }));
  };

  const handleEnrich = async (anno) => {
    setEnriching(prev => ({ ...prev, [anno]: true }));
    addLog(`▶ Arricchimento specialist per anno ${anno}...`);
    try {
      const data = await callFn('enrichDealsWithSpecialist', { anno });
      addLog(`✓ ${anno}: ${data.updated?.toLocaleString('it-IT')} deal arricchiti con specialist`, 'success');
      await reloadAggregati();
    } catch (e) { addLog(`✗ Arricchimento ${anno} fallito: ${e.message}`, 'error'); }
    setEnriching(prev => ({ ...prev, [anno]: false }));
  };

  const handleDelete = async (anno) => {
    if (!confirm(`Cancellare tutti i dati ${anno}?`)) return;
    addLog(`▶ Cancellazione dati ${anno}...`);
    try {
      await callFn('deleteChunk', { anno });
      addLog(`✓ Dati ${anno} cancellati`, 'success');
      await reloadAggregati();
    } catch (e) { addLog(`✗ Errore: ${e.message}`, 'error'); }
  };

  const handleAggregateAll = async () => {
    setAggregating(true);
    addLog('▶ Ricalcolo aggregati tutti gli anni...');
    try {
      const data = await callFn('aggregateDeals', {});
      data.results?.forEach(r => addLog(`✓ ${r.anno}: ${r.n?.toLocaleString('it-IT')} record`, 'success'));
      await reloadAggregati();
    } catch (e) { addLog('✗ Errore aggregazione: ' + e.message, 'error'); }
    setAggregating(false);
  };

  // Statistiche
  const totDeals = ANNI.reduce((s, a) => s + (aggregati?.[a]?.kpi?.n || 0), 0);
  const totServ = ANNI.reduce((s, a) => s + (aggregati?.[a]?.kpi?.serv || 0), 0);

  return (
    <div className="min-h-full bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Gestione Dati & Storage</h1>
          <p className="text-sm text-gray-400 mt-0.5">Upload · Import · Arricchimento · Aggregazione</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadStorage} disabled={loadingStorage}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStorage ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
          <button onClick={handleAggregateAll} disabled={aggregating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40">
            {aggregating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {aggregating ? 'Aggregazione...' : 'Ricalcola aggregati'}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deal totali in DB', value: totDeals.toLocaleString('it-IT'), icon: Database, color: 'text-blue-600' },
          { label: 'Portafoglio totale', value: fmt(totServ), icon: TrendingUp, color: 'text-green-600' },
          { label: 'File consuntivi su Storage', value: `${consuntiviFiles.length}`, icon: Cloud, color: 'text-purple-600' },
          { label: 'Clienti in portafoglio', value: portafoglioData.length.toLocaleString('it-IT'), icon: Users, color: 'text-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'consuntivi', label: 'Consuntivi', icon: BarChart2 },
          { key: 'portafoglio', label: 'Portafoglio Clienti', icon: Users },
          { key: 'specialist', label: 'LOB → Specialist', icon: Star },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Consuntivi */}
      {tab === 'consuntivi' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ANNI.map(anno => {
              const c = ANNO_COLORS[anno];
              const ag = aggregati?.[anno];
              const hasData = ag?.kpi?.n > 0;
              const annoFiles = consuntiviFiles.filter(f => f.anno === anno).sort((a,b) => b.updated?.localeCompare(a.updated||''));
              const activeFile = annoFiles.find(f => f.path === activeConsuntivi[anno]);
              const isImporting = importing[anno];
              const isEnriching = enriching[anno];

              return (
                <div key={anno} className={`rounded-2xl border-2 ${activeFile ? c.border : 'border-gray-200'} bg-white overflow-hidden`}>
                  <div className={`px-5 py-4 ${activeFile ? c.light : 'bg-gray-50'} border-b ${activeFile ? c.border : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-2xl font-black ${c.text}`}>{anno}</span>
                      {hasData && <div className="text-right"><p className="text-sm font-black text-gray-800">{fmt(ag.kpi.serv)}</p><p className="text-[10px] text-gray-400">{ag.kpi.n.toLocaleString('it-IT')} deal</p></div>}
                    </div>
                  </div>

                  {/* Selezione versione file */}
                  {annoFiles.length > 0 ? (
                    <div className="px-5 py-3 border-b border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">File su Storage ({annoFiles.length} versioni)</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {annoFiles.map(f => (
                          <label key={f.path} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${activeConsuntivi[anno] === f.path ? `${c.bg} ${c.text}` : 'hover:bg-gray-50'}`}>
                            <input type="radio" name={`file-${anno}`} checked={activeConsuntivi[anno] === f.path}
                              onChange={() => setActiveConsuntivi(prev => ({ ...prev, [anno]: f.path }))} className="hidden" />
                            {activeConsuntivi[anno] === f.path ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <Eye className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate font-medium">{f.basename}</p>
                              <p className="text-[10px] text-gray-400">{formatSize(f.size)} · {formatDate(f.updated)}</p>
                            </div>
                            {f.mese && <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded font-bold">{mesiNome(f.mese)}</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-400">Nessun file su Storage</div>
                  )}

                  {/* KPI mini */}
                  {hasData && (
                    <div className="px-5 py-2 grid grid-cols-3 gap-1 border-b border-gray-100 bg-gray-50/50">
                      <div className="text-center"><p className="text-xs font-bold text-gray-700">{ag.kpi.ctr}</p><p className="text-[10px] text-gray-400">CTR</p></div>
                      <div className="text-center"><p className="text-xs font-bold text-gray-700">{fmt(ag.kpi.canoni)}</p><p className="text-[10px] text-gray-400">Canoni</p></div>
                      <div className="text-center"><p className={`text-xs font-bold ${(ag.kpi.diff||0)>=0?'text-green-600':'text-red-500'}`}>{fmt(ag.kpi.diff)}</p><p className="text-[10px] text-gray-400">Diff.</p></div>
                    </div>
                  )}

                  {/* Upload progress */}
                  {uploading[anno] && (
                    <div className="px-5 py-2 border-b border-gray-100">
                      <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Upload...</span><span className="text-blue-600 font-semibold">{uploadProgress[anno]||0}%</span></div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{width:`${uploadProgress[anno]||0}%`}} /></div>
                    </div>
                  )}

                  {/* Azioni */}
                  <div className="px-5 py-4 space-y-2">
                    <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl border-2 border-dashed text-xs font-medium cursor-pointer transition-all ${c.border} ${c.text} hover:${c.bg}`}>
                      <Upload className="w-3.5 h-3.5" />
                      Carica nuovo file ({anno})
                      <input type="file" accept=".xlsx" className="hidden"
                        onChange={e => handleUpload('consuntivi', e.target.files[0], anno)}
                        disabled={uploading[anno] || isImporting} />
                    </label>
                    {activeFile && (
                      <button onClick={() => handleImportConsuntivo(anno)} disabled={isImporting || uploading[anno]}
                        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${c.accent} hover:opacity-90`}>
                        {isImporting ? <><Loader2 className="w-4 h-4 animate-spin" />Import in corso...</> : <><Play className="w-4 h-4" />Importa {anno}</>}
                      </button>
                    )}
                    {hasData && portafoglioData.length > 0 && (
                      <button onClick={() => handleEnrich(anno)} disabled={isEnriching || isImporting}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50">
                        {isEnriching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Arricchimento...</> : <><Star className="w-3.5 h-3.5" />Arricchisci con Specialist</>}
                      </button>
                    )}
                    {hasData && !isImporting && (
                      <button onClick={() => handleDelete(anno)}
                        className="flex items-center justify-center gap-2 w-full py-1.5 rounded-xl text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Cancella dati {anno}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabella comparativa */}
          {ANNI.some(a => aggregati?.[a]?.kpi?.n > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Analisi Comparativa</h2>
              <div className="space-y-3 mb-5">
                {ANNI.map(anno => {
                  const ag = aggregati?.[anno];
                  const serv = ag?.kpi?.serv || 0;
                  const maxServ = Math.max(...ANNI.map(a => aggregati?.[a]?.kpi?.serv || 0), 1);
                  const c = ANNO_COLORS[anno];
                  return (
                    <div key={anno} className="flex items-center gap-3">
                      <span className={`text-xs font-black w-10 ${c.text}`}>{anno}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-6 rounded-full ${c.bar} flex items-center px-3 transition-all duration-700`}
                          style={{ width: `${serv/maxServ*100}%`, minWidth: serv > 0 ? '5rem' : 0 }}>
                          {serv > 0 && <span className="text-white text-xs font-bold">{fmt(serv)}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-20 text-right">{ag?.kpi?.n?.toLocaleString('it-IT') || 0} deal</span>
                    </div>
                  );
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b-2 border-gray-100 text-gray-400">
                    {['Anno','Deal','Portafoglio','Canoni','Diff.','CTR','TTV','Attacco','Difesa'].map(h => (
                      <th key={h} className={`pb-2 font-semibold ${h === 'Anno' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {ANNI.map(anno => {
                      const ag = aggregati?.[anno];
                      const c = ANNO_COLORS[anno];
                      return (
                        <tr key={anno} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2"><span className={`px-2 py-0.5 rounded-lg text-xs font-black ${c.bg} ${c.text}`}>{anno}</span></td>
                          <td className="py-2 text-right font-semibold">{ag?.kpi?.n?.toLocaleString('it-IT') || '—'}</td>
                          <td className="py-2 text-right font-semibold">{ag ? fmt(ag.kpi.serv) : '—'}</td>
                          <td className="py-2 text-right text-gray-600">{ag ? fmt(ag.kpi.canoni) : '—'}</td>
                          <td className={`py-2 text-right font-semibold ${ag ? (ag.kpi.diff>=0?'text-green-600':'text-red-500') : 'text-gray-300'}`}>{ag ? fmt(ag.kpi.diff) : '—'}</td>
                          <td className="py-2 text-right text-gray-600">{ag?.kpi?.ctr || '—'}</td>
                          <td className="py-2 text-right text-gray-600">{ag?.kpi?.ttv || '—'}</td>
                          <td className="py-2 text-right text-gray-600">{ag ? fmt(ag.kpi.att) : '—'}</td>
                          <td className="py-2 text-right text-gray-600">{ag ? fmt(ag.kpi.dif) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Portafoglio Clienti */}
      {tab === 'portafoglio' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <h2 className="text-sm font-bold text-gray-800">Portafoglio Clienti</h2>
                  {portafoglioData.length > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">{portafoglioData.length} clienti</span>}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Versioni file */}
              {portafoglioFiles.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versioni disponibili su Storage ({portafoglioFiles.length})</p>
                  <div className="space-y-2">
                    {portafoglioFiles.map(f => (
                      <label key={f.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${activePortafoglio === f.path ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-200 bg-gray-50'}`}>
                        <input type="radio" checked={activePortafoglio === f.path} onChange={() => setActivePortafoglio(f.path)} className="hidden" />
                        {activePortafoglio === f.path ? <Star className="w-4 h-4 text-purple-600 flex-shrink-0" /> : <Eye className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{f.basename}</p>
                          <p className="text-xs text-gray-400">{formatSize(f.size)} · {formatDate(f.updated)}</p>
                        </div>
                        {f.mese && f.anno && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">{mesiNome(f.mese)} {f.anno}</span>
                        )}
                        {activePortafoglio === f.path && <span className="text-xs text-purple-600 font-bold">✓ Attivo</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Cloud className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nessun file portafoglio su Storage</p>
                  <p className="text-xs mt-1">Usa la naming convention: <code className="bg-gray-100 px-1 rounded">portafoglioclienti032026.xlsx</code></p>
                </div>
              )}

              {/* Upload nuovo */}
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 font-medium text-sm cursor-pointer hover:bg-purple-50 transition-colors">
                <Upload className="w-4 h-4" />
                Carica nuovo file portafoglio
                <input type="file" accept=".xlsx" className="hidden"
                  onChange={e => handleUpload('portafoglio', e.target.files[0], null)}
                  disabled={uploading['portafoglio']} />
              </label>
              {uploading['portafoglio'] && (
                <div><div className="flex justify-between text-xs mb-1"><span>Upload...</span><span className="text-purple-600 font-bold">{uploadProgress['portafoglio']||0}%</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-1.5 bg-purple-500 rounded-full transition-all" style={{width:`${uploadProgress['portafoglio']||0}%`}} /></div></div>
              )}
              <p className="text-[10px] text-gray-400">Naming convention: <code>portafoglioclienti032026.xlsx</code> (mese + anno)</p>

              {/* Import */}
              {activePortafoglio && (
                <button onClick={handleImportPortafoglio} disabled={importing['portafoglio']}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                  {importing['portafoglio'] ? <><Loader2 className="w-4 h-4 animate-spin" />Import in corso...</> : <><Play className="w-4 h-4" />Importa versione selezionata</>}
                </button>
              )}
            </div>
          </div>

          {/* Dopo l'import, mostra riepilogo campi */}
          {portafoglioData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Campi Specialist disponibili</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { field: 'acc_specialist_cloud_iot_5g', label: 'Cloud/IoT/5G', lobs: 'Cloud, IoT', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { field: 'acc_specialist_sec', label: 'Security', lobs: 'Security', color: 'bg-red-50 border-red-200 text-red-700' },
                  { field: 'acc_specialist_lss', label: 'LSS (Licensing)', lobs: 'Licensing', color: 'bg-purple-50 border-purple-200 text-purple-700' },
                ].map(s => {
                  const count = portafoglioData.filter(c => c[s.field]).length;
                  return (
                    <div key={s.field} className={`rounded-xl border p-3 ${s.color}`}>
                      <p className="text-xs font-bold">{s.label}</p>
                      <p className="text-[10px] opacity-70">LOB: {s.lobs}</p>
                      <p className="text-lg font-black mt-1">{count}</p>
                      <p className="text-[10px] opacity-70">clienti con specialist</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { field: 'area_am_spec', label: 'Area AM Specialist' },
                  { field: 'area_mng_spec', label: 'Area MNG Specialist' },
                ].map(s => {
                  const count = portafoglioData.filter(c => c[s.field]).length;
                  return (
                    <div key={s.field} className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600">{s.label}</p>
                      <p className="text-lg font-black text-gray-700 mt-1">{count}</p>
                      <p className="text-[10px] text-gray-400">clienti con area compilata</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                ⚡ Dopo l'import del portafoglio, vai su ogni anno consuntivo e clicca <strong>"Arricchisci con Specialist"</strong> per associare gli specialist ai deal.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: LOB → Specialist */}
      {tab === 'specialist' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Tabella LOB → Specialist</h2>
              <p className="text-xs text-gray-400 mt-0.5">Associazione tra LOB e specialist per ogni cliente del portafoglio</p>
            </div>
            <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
              <span className="font-semibold">Regola:</span> Cloud/IoT → Cloud Spec · Security → Sec Spec · Licensing → LSS · Connettività/Other IT → vuoto
            </div>
          </div>
          <SpecialistTable portafoglio={portafoglioData} />
        </div>
      )}

      {/* Log */}
      {logs.length > 0 && (
        <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">Log operazioni</span>
            </div>
            <button onClick={() => setLogs([])} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
          <div ref={logRef} className="p-4 h-48 overflow-y-auto space-y-1">
            {logs.map((l, i) => <LogLine key={i} entry={l} />)}
          </div>
        </div>
      )}
    </div>
  );
}
