import { useState, useEffect, useRef } from 'react';
import { ref, uploadBytesResumable, listAll, getMetadata, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functionsInstance } from '@/api/firebaseClient';
import { useData } from '@/lib/DataContext.jsx';
import {
  Cloud, Upload, Play, Trash2, RefreshCw, CheckCircle,
  AlertCircle, Loader2, FileSpreadsheet, Database,
  TrendingUp, BarChart2, Clock, HardDrive, Zap, X
} from 'lucide-react';

const callFn = async (name, payload) => {
  const fn = httpsCallable(functionsInstance, name, { timeout: 600000 });
  const res = await fn(payload);
  return res.data;
};

const ANNI = ['2024', '2025', '2026'];

const ANNO_COLORS = {
  '2024': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', accent: 'bg-gray-500', light: 'bg-gray-50' },
  '2025': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', accent: 'bg-amber-500', light: 'bg-amber-50' },
  '2026': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', accent: 'bg-blue-600', light: 'bg-blue-50' },
};

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
}

// ─── Log line component ────────────────────────────────────────────
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

// ─── Anno Card ────────────────────────────────────────────────────
function AnnoCard({ anno, fileInfo, aggInfo, onUpload, onImport, onDelete, importing, uploading, uploadProgress }) {
  const c = ANNO_COLORS[anno];
  const fileRef = useRef();
  const hasFile = !!fileInfo;
  const hasData = aggInfo?.kpi?.n > 0;

  return (
    <div className={`rounded-2xl border-2 ${hasFile ? c.border : 'border-gray-200'} bg-white overflow-hidden transition-all duration-300`}>

      {/* Header */}
      <div className={`px-5 py-4 ${hasFile ? c.light : 'bg-gray-50'} border-b ${hasFile ? c.border : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-black ${c.text}`}>{anno}</span>
            <div className="flex flex-col">
              {hasFile ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                  <CheckCircle className="w-3 h-3" /> File su Storage
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                  <Cloud className="w-3 h-3" /> Nessun file
                </span>
              )}
              {hasData && <span className="text-[10px] text-gray-400">{aggInfo.kpi.n.toLocaleString('it-IT')} deal in DB</span>}
            </div>
          </div>
          {hasData && (
            <div className="text-right">
              <p className="text-sm font-black text-gray-800">{fmt(aggInfo.kpi.serv)}</p>
              <p className="text-[10px] text-gray-400">portafoglio</p>
            </div>
          )}
        </div>
      </div>

      {/* File info */}
      {hasFile && (
        <div className="px-5 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate flex-1">{fileInfo.name.replace(`consuntivi/`, '')}</span>
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1"><HardDrive className="w-2.5 h-2.5" />{formatSize(fileInfo.size)}</span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDate(fileInfo.updated)}</span>
          </div>
        </div>
      )}

      {/* KPI aggregati */}
      {hasData && (
        <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-gray-100">
          <div className="text-center">
            <p className="text-xs font-bold text-gray-800">{aggInfo.kpi.ctr}</p>
            <p className="text-[10px] text-gray-400">CTR</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-gray-800">{fmt(aggInfo.kpi.canoni)}</p>
            <p className="text-[10px] text-gray-400">Canoni</p>
          </div>
          <div className="text-center">
            <p className={`text-xs font-bold ${(aggInfo.kpi.diff||0)>=0?'text-green-600':'text-red-500'}`}>{fmt(aggInfo.kpi.diff)}</p>
            <p className="text-[10px] text-gray-400">Diff.</p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Upload in corso...</span>
            <span className="font-semibold text-blue-600">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-1.5 bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Azioni */}
      <div className="px-5 py-4 space-y-2">
        {/* Upload */}
        <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl border-2 border-dashed text-sm font-medium cursor-pointer transition-all ${
          uploading ? 'opacity-50 cursor-not-allowed' : `${c.border} ${c.text} hover:${c.bg}`
        }`}>
          <Upload className="w-4 h-4" />
          {hasFile ? 'Sostituisci file Excel' : 'Carica file Excel su Storage'}
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={e => onUpload(anno, e.target.files[0])}
            disabled={uploading || importing} />
        </label>

        {/* Import da Storage */}
        {hasFile && (
          <button onClick={() => onImport(anno)} disabled={importing || uploading}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
              importing ? 'bg-gray-400' : `${c.accent} hover:opacity-90`
            } disabled:opacity-50`}>
            {importing
              ? <><Loader2 className="w-4 h-4 animate-spin" />Import in corso...</>
              : <><Play className="w-4 h-4" />Reimporta {anno} da Storage</>}
          </button>
        )}

        {/* Cancella dati */}
        {hasData && !importing && (
          <button onClick={() => onDelete(anno)}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Cancella dati {anno}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function Import() {
  const { aggregati, reload: reloadAggregati } = useData();
  const [storageFiles, setStorageFiles] = useState({});
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [uploading, setUploading] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [importing, setImporting] = useState({});
  const [aggregating, setAggregating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef();

  useEffect(() => { loadStorage(); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('it-IT');
    setLogs(prev => [...prev, { msg, type, time }]);
    setShowLog(true);
  };

  const loadStorage = async () => {
    setLoadingStorage(true);
    try {
      const storageRef = ref(storage, 'consuntivi/');
      const list = await listAll(storageRef);
      const map = {};
      for (const item of list.items) {
        const anno = ANNI.find(a => item.name.includes(a));
        if (anno) {
          const meta = await getMetadata(item);
          map[anno] = { name: item.fullPath, path: item.fullPath, size: meta.size, updated: meta.updated };
        }
      }
      setStorageFiles(map);
    } catch (e) {
      addLog('Errore caricamento lista Storage: ' + e.message, 'error');
    }
    setLoadingStorage(false);
  };

  const handleUpload = (anno, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [anno]: true }));
    setUploadProgress(prev => ({ ...prev, [anno]: 0 }));
    addLog(`▶ Upload ${anno}: ${file.name} (${(file.size/1024).toFixed(0)} KB)`);

    const storageRef = ref(storage, `consuntivi/consuntivo_${anno}.xlsx`);
    const task = uploadBytesResumable(storageRef, file);

    task.on('state_changed',
      (snap) => {
        const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
        setUploadProgress(prev => ({ ...prev, [anno]: pct }));
      },
      (err) => {
        addLog(`✗ Upload fallito: ${err.message}`, 'error');
        setUploading(prev => ({ ...prev, [anno]: false }));
      },
      () => {
        addLog(`✓ File ${anno} caricato su Storage`, 'success');
        setUploading(prev => ({ ...prev, [anno]: false }));
        loadStorage();
      }
    );
  };

  const handleImport = async (anno) => {
    const file = storageFiles[anno];
    if (!file) return;
    setImporting(prev => ({ ...prev, [anno]: true }));
    addLog(`▶ Avvio import ${anno} da Storage...`);
    addLog(`  File: ${file.name}`);
    addLog(`  Cancellazione dati esistenti...`);

    try {
      const data = await callFn('importFromStorage', { storagePath: file.path, anno });
      addLog(`✓ Import ${anno} completato: ${data.inserted?.toLocaleString('it-IT')} record`, 'success');
      addLog(`✓ Aggregati ${anno} ricalcolati`, 'success');
      await reloadAggregati();
    } catch (e) {
      addLog(`✗ Import ${anno} fallito: ${e.message}`, 'error');
    }
    setImporting(prev => ({ ...prev, [anno]: false }));
  };

  const handleDelete = async (anno) => {
    if (!confirm(`Cancellare tutti i dati ${anno}? Questa operazione non è reversibile.`)) return;
    addLog(`▶ Cancellazione dati ${anno}...`);
    try {
      await callFn('deleteChunk', { anno });
      addLog(`✓ Dati ${anno} cancellati`, 'success');
      await reloadAggregati();
    } catch (e) {
      addLog(`✗ Errore cancellazione: ${e.message}`, 'error');
    }
  };

  const handleAggregateAll = async () => {
    setAggregating(true);
    addLog('▶ Ricalcolo aggregati per tutti gli anni...');
    try {
      const data = await callFn('aggregateDeals', {});
      data.results?.forEach(r => addLog(`✓ Aggregati ${r.anno}: ${r.n?.toLocaleString('it-IT')} record`, 'success'));
      await reloadAggregati();
    } catch (e) {
      addLog('✗ Errore aggregazione: ' + e.message, 'error');
    }
    setAggregating(false);
  };

  // Statistiche globali
  const totDeals = ANNI.reduce((s, a) => s + (aggregati?.[a]?.kpi?.n || 0), 0);
  const totServ = ANNI.reduce((s, a) => s + (aggregati?.[a]?.kpi?.serv || 0), 0);
  const lastUpdate = ANNI.map(a => aggregati?.[a]?.updatedAt?.toDate?.() || null).filter(Boolean).sort().pop();

  return (
    <div className="min-h-full bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestione Dati</h1>
          <p className="text-sm text-gray-400 mt-0.5">Storage · Import · Analisi · Aggregazione</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadStorage} disabled={loadingStorage}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStorage ? 'animate-spin' : ''}`} />
            Aggiorna Storage
          </button>
          <button onClick={handleAggregateAll} disabled={aggregating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40">
            {aggregating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {aggregating ? 'Aggregazione...' : 'Ricalcola tutti aggregati'}
          </button>
        </div>
      </div>

      {/* Stats globali */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deal totali in DB', value: totDeals.toLocaleString('it-IT'), icon: Database, color: 'text-blue-600' },
          { label: 'Portafoglio totale', value: fmt(totServ), icon: TrendingUp, color: 'text-green-600' },
          { label: 'File su Storage', value: `${Object.keys(storageFiles).length} / 3`, icon: Cloud, color: 'text-purple-600' },
          { label: 'Ultimo aggiornamento', value: lastUpdate ? lastUpdate.toLocaleDateString('it-IT') : '—', icon: Clock, color: 'text-gray-500' },
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

      {/* Anno cards */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          Storage & Dati per Anno
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ANNI.map(anno => (
            <AnnoCard
              key={anno}
              anno={anno}
              fileInfo={storageFiles[anno]}
              aggInfo={aggregati?.[anno]}
              onUpload={handleUpload}
              onImport={handleImport}
              onDelete={handleDelete}
              importing={importing[anno]}
              uploading={uploading[anno]}
              uploadProgress={uploadProgress[anno] || 0}
            />
          ))}
        </div>
      </div>

      {/* Tabella comparativa */}
      {ANNI.some(a => aggregati?.[a]?.kpi?.n > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            Analisi Comparativa Dati Caricati
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-400">
                  <th className="text-left pb-3 font-semibold">Anno</th>
                  <th className="text-right pb-3 font-semibold">Deal totali</th>
                  <th className="text-right pb-3 font-semibold">Portafoglio</th>
                  <th className="text-right pb-3 font-semibold">Canoni</th>
                  <th className="text-right pb-3 font-semibold">Differenziale</th>
                  <th className="text-right pb-3 font-semibold">CTR</th>
                  <th className="text-right pb-3 font-semibold">TTV</th>
                  <th className="text-right pb-3 font-semibold">Attacco</th>
                  <th className="text-right pb-3 font-semibold">Difesa</th>
                  <th className="text-center pb-3 font-semibold">Storage</th>
                  <th className="text-center pb-3 font-semibold">Aggregati</th>
                </tr>
              </thead>
              <tbody>
                {ANNI.map(anno => {
                  const ag = aggregati?.[anno];
                  const c = ANNO_COLORS[anno];
                  const hasAg = ag?.kpi?.n > 0;
                  const hasFile = !!storageFiles[anno];
                  return (
                    <tr key={anno} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${c.bg} ${c.text}`}>{anno}</span>
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-800">{hasAg ? ag.kpi.n.toLocaleString('it-IT') : '—'}</td>
                      <td className="py-3 text-right font-semibold text-gray-800">{hasAg ? fmt(ag.kpi.serv) : '—'}</td>
                      <td className="py-3 text-right text-gray-600">{hasAg ? fmt(ag.kpi.canoni) : '—'}</td>
                      <td className={`py-3 text-right font-semibold ${hasAg ? (ag.kpi.diff >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                        {hasAg ? fmt(ag.kpi.diff) : '—'}
                      </td>
                      <td className="py-3 text-right text-gray-600">{hasAg ? ag.kpi.ctr : '—'}</td>
                      <td className="py-3 text-right text-gray-600">{hasAg ? ag.kpi.ttv : '—'}</td>
                      <td className="py-3 text-right text-gray-600">{hasAg ? fmt(ag.kpi.att) : '—'}</td>
                      <td className="py-3 text-right text-gray-600">{hasAg ? fmt(ag.kpi.dif) : '—'}</td>
                      <td className="py-3 text-center">
                        {hasFile
                          ? <span className="flex items-center justify-center gap-1 text-green-600 text-[10px] font-semibold"><CheckCircle className="w-3 h-3" />OK</span>
                          : <span className="text-gray-300 text-[10px]">—</span>}
                      </td>
                      <td className="py-3 text-center">
                        {hasAg
                          ? <span className="flex items-center justify-center gap-1 text-green-600 text-[10px] font-semibold"><CheckCircle className="w-3 h-3" />OK</span>
                          : <span className="text-amber-500 text-[10px] font-semibold">Mancanti</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Barre visuali */}
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Portafoglio per anno</p>
            {ANNI.map(anno => {
              const ag = aggregati?.[anno];
              const serv = ag?.kpi?.serv || 0;
              const maxServ = Math.max(...ANNI.map(a => aggregati?.[a]?.kpi?.serv || 0), 1);
              const c = ANNO_COLORS[anno];
              return (
                <div key={anno} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-10 ${c.text}`}>{anno}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-5 rounded-full ${c.accent} flex items-center px-2 transition-all duration-700`}
                      style={{ width: `${serv/maxServ*100}%`, minWidth: serv > 0 ? '3rem' : 0 }}>
                      {serv > 0 && <span className="text-white text-[10px] font-bold">{fmt(serv)}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right">{ag?.kpi?.n?.toLocaleString('it-IT') || 0} deal</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">Log operazioni</span>
            </div>
            <button onClick={() => setLogs([])} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div ref={logRef} className="p-4 h-48 overflow-y-auto space-y-1">
            {logs.map((l, i) => <LogLine key={i} entry={l} />)}
          </div>
        </div>
      )}
    </div>
  );
}
