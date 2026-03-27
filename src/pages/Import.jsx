import { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import {
  Upload, CheckCircle, AlertCircle, Loader2, X,
  Trash2, Clock, FileSpreadsheet, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import DeleteDataModal from '../components/bi/DeleteDataModal';
import ImportPortafoglioButton from '../components/bi/ImportPortafoglioButton';
import DataStatusPanel from '../components/bi/DataStatusPanel';

// ─── Helper: chiama una Firebase Cloud Function ───────────────────
async function callFn(name, payload) {
  const fn = httpsCallable(functionsInstance, name);
  const res = await fn(payload);
  return res.data;
}

const ANNI = [
  { anno: '2024', label: '2024', color: 'gray', hint: 'storico' },
  { anno: '2025', label: '2025', color: 'amber', hint: 'consolidato' },
  { anno: '2026', label: '2026', color: 'blue', hint: 'corrente', requiresDate: true },
];

const COLOR_MAP = {
  gray:  { badge: 'bg-gray-100 text-gray-700', btn: 'bg-gray-600 hover:bg-gray-700', border: 'border-l-gray-400', dot: 'bg-gray-400' },
  amber: { badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-500 hover:bg-amber-600', border: 'border-l-amber-400', dot: 'bg-amber-400' },
  blue:  { badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700', border: 'border-l-blue-500', dot: 'bg-blue-500' },
};

function ts() { return new Date().toLocaleTimeString('it-IT'); }

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function parseStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

async function parseExcel(file, anno, dataRiferimento) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheetName = wb.SheetNames.find(n => n.includes(anno)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const headerIdx = rawRows.findIndex(row => row.some(c => String(c ?? '').trim() === 'ID SDW'));
  if (headerIdx === -1) throw new Error('Header "ID SDW" non trovato nel foglio');

  const header = rawRows[headerIdx].map(h => String(h ?? '').trim());
  const dataRows = rawRows.slice(headerIdx + 1);

  const findCol = (...names) => header.findIndex(h => h && names.some(n => h.toLowerCase().includes(n.toLowerCase())));
  const C = {
    id:             header.indexOf('ID SDW'),
    capogruppo:     findCol('Ragione Sociale Capogruppo'),
    rs:             header.findIndex(h => h === 'Ragione Sociale'),
    desc:           header.indexOf('Descrizione'),
    areaRac:        findCol('NEW AREA RAC', 'AREA RAC'),
    rac:            header.indexOf('RAC'),
    newAreaRac:     findCol('NEW AREA RAC'),
    newArea:        header.indexOf('NEW AREA'),
    areaMng:        findCol('AREA MNG'),
    strutturaSales: findCol('STRUTTURA SALES'),
    strutturaSDW:   findCol('STRUTTURA SDW'),
    ad:             findCol('Attacco/Difesa', 'Attacco / Difesa', 'A/D'),
    ambito:         findCol('NEW Ambito', 'Ambito'),
    newAmbito:      findCol('NEW Ambito'),
    lob:            findCol('LOB'),
    specialist:     header.indexOf('SPECIALIST'),
    specialistNoDouble: findCol('SPECIALIST no Double'),
    mese:           header.indexOf('Mese'),
    durata:         header.indexOf('Durata'),
    newEntry:       header.indexOf('New ENTRY'),
    codice:         findCol('Codice Progetto', 'Codice'),
    fornitore:      findCol('Fornitore'),
    totCtr:         findCol('tot ctr'),
    ricIAnno:       findCol('ric I anno'),
    serviziTot:     findCol('Servizi Totali'),
    servIAnno:      findCol('serv I anno'),
    canoni:         findCol('Canoni', 'di cui Can'),
    ar:             findCol('A/R'),
    ut:             findCol('di cui UT'),
    diffServ:       findCol('Differenziale Servizi'),
    vendita:        header.indexOf('vendita'),
  };

  const deals = [];
  for (const arr of dataRows) {
    const id = arr[C.id];
    if (!id || !String(id).startsWith('OP-')) continue;

    const mese = parseNum(arr[C.mese]);
    const tipo = mese === 0 ? 'TTV' : 'CTR';
    const lobRaw = parseStr(arr[C.lob]);
    const lobVal = lobRaw && !isNaN(Number(lobRaw)) ? '' : lobRaw;
    const ambitoRaw = parseStr(arr[C.ambito]);
    const ambitoVal = ambitoRaw && !isNaN(Number(ambitoRaw)) ? '' : ambitoRaw;
    const adRaw = parseStr(arr[C.ad]).toLowerCase();

    deals.push({
      portafoglio: 'Base',
      anno,
      tipo,
      data_riferimento: dataRiferimento || '',
      id_sdw:                     parseStr(arr[C.id]),
      ragione_sociale_capogruppo: parseStr(arr[C.capogruppo]),
      ragione_sociale:            parseStr(arr[C.rs]),
      descrizione:                parseStr(arr[C.desc]),
      area_rac:                   parseStr(arr[C.areaRac]),
      rac:                        parseStr(arr[C.rac]),
      new_area_rac:               parseStr(arr[C.newAreaRac]),
      new_area:                   parseStr(arr[C.newArea]),
      area_mng:                   parseStr(arr[C.areaMng]),
      struttura_sales:            parseStr(arr[C.strutturaSales]),
      struttura_sdw:              parseStr(arr[C.strutturaSDW]),
      attacco_difesa:             adRaw === 'attacco' ? 'Attacco' : adRaw === 'difesa' ? 'Difesa' : parseStr(arr[C.ad]),
      ambito:                     ambitoVal,
      new_ambito:                 parseStr(arr[C.newAmbito]),
      lob:                        lobVal,
      lob_originale:              lobVal,
      specialist:                 parseStr(arr[C.specialist]),
      specialist_no_double:       parseStr(arr[C.specialistNoDouble]),
      mese:                       parseNum(arr[C.mese]),
      durata:                     parseNum(arr[C.durata]),
      new_entry:                  !!arr[C.newEntry],
      codice_progetto:            parseStr(arr[C.codice]),
      fornitore:                  parseStr(arr[C.fornitore]),
      tot_ctr:                    parseNum(arr[C.totCtr]),
      ric_i_anno:                 parseNum(arr[C.ricIAnno]),
      servizi_totali:             parseNum(arr[C.serviziTot]),
      serv_i_anno:                parseNum(arr[C.servIAnno]),
      canoni:                     parseNum(arr[C.canoni]),
      ar:                         parseNum(arr[C.ar]),
      ut:                         parseNum(arr[C.ut]),
      differenziale_servizi:      parseNum(arr[C.diffServ]),
      vendita:                    parseNum(arr[C.vendita]),
    });
  }

  return deals;
}

function LogLine({ entry }) {
  const configs = {
    error:   { icon: <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />,     text: 'text-red-300' },
    success: { icon: <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />,   text: 'text-green-300' },
    warn:    { icon: <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />, text: 'text-yellow-300' },
    info:    { icon: <Clock className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />,          text: 'text-gray-300' },
  };
  const cfg = configs[entry.type] || configs.info;
  return (
    <div className="flex items-start gap-2 font-mono text-[11px] leading-relaxed">
      {cfg.icon}
      <span className="text-gray-500 flex-shrink-0 tabular-nums">{entry.time}</span>
      <span className={cfg.text}>{entry.msg}</span>
    </div>
  );
}

function ImportCard({ anno, label, color, hint, requiresDate, onStart, isActive }) {
  const [file, setFile] = useState(null);
  const [dataRiferimento, setDataRiferimento] = useState('');
  const fileRef = useRef();
  const c = COLOR_MAP[color];

  const handleImport = () => {
    if (!file) return;
    if (requiresDate && !dataRiferimento) return;
    onStart({ anno, label, file, dataRiferimento: requiresDate ? dataRiferimento : null });
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${c.border} shadow-sm p-5 space-y-3 ${isActive ? 'ring-2 ring-blue-200' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{label}</span>
        <span className="text-xs text-gray-400">{hint}</span>
      </div>

      {requiresDate && (
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Data riferimento *</label>
          <input
            type="date"
            value={dataRiferimento}
            onChange={e => setDataRiferimento(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      )}

      <div
        onClick={() => fileRef.current.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-4 text-center cursor-pointer transition-all ${
          file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => setFile(e.target.files[0])} />
        <FileSpreadsheet className={`w-5 h-5 mx-auto mb-1 ${file ? 'text-green-500' : 'text-gray-300'}`} />
        <p className={`text-xs font-medium truncate ${file ? 'text-green-700' : 'text-gray-400'}`}>
          {file ? file.name : 'Seleziona file .xlsx'}
        </p>
        {file && <p className="text-[10px] text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>}
      </div>

      <button
        onClick={handleImport}
        disabled={!file || (requiresDate && !dataRiferimento)}
        className={`w-full py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center gap-2 ${c.btn}`}
      >
        <Upload className="w-4 h-4" /> Importa {label}
      </button>
    </div>
  );
}

function ActiveImportPanel({ task, onDone, onEnrichLob }) {
  const [state, setState] = useState('loading');
  const [progress, setProgress] = useState({ inserted: 0, total: null, batch: 0 });
  const [logs, setLogs] = useState([]);
  const logRef = useRef();

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: ts() }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { anno, label, file, dataRiferimento } = task;
      setLogs([]);
      setState('loading');
      setProgress({ inserted: 0, total: null, batch: 0 });

      addLog(`▶ Avvio importazione Anno ${label}`);
      addLog(`  File: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      if (dataRiferimento) addLog(`  Data riferimento: ${dataRiferimento}`);

      try {
        // ── 1. Warm-up ping ──
        addLog('⟳ Warm-up connessione...');
        try {
          await callFn('ping', {});
          await new Promise(r => setTimeout(r, 500));
          addLog('✓ Connessione pronta', 'success');
        } catch (_) {
          addLog('  (ping non disponibile, continuo)', 'warn');
        }

        // ── 2. Parse Excel nel browser ──
        addLog('⟳ Parsing Excel nel browser...');
        const deals = await parseExcel(file, anno, dataRiferimento);
        const totalRows = deals.length;
        addLog(`✓ Parsed ${totalRows.toLocaleString('it-IT')} righe valide`, 'success');

        if (totalRows === 0) {
          addLog('⚠ Nessuna riga valida trovata nel file', 'warn');
          setState('error');
          return;
        }

        // ── 3. Loop di import ──
        const CHUNK = 50;
        let totalInserted = 0;
        let batchNum = 0;
        const failedBatches = [];

        for (let i = 0; i < deals.length; i += CHUNK) {
          if (cancelled) break;
          batchNum++;
          const chunk = deals.slice(i, i + CHUNK);
          addLog(`⟳ Batch #${batchNum} — righe ${i + 1}–${i + chunk.length}...`);

          let attempts = 0;
          let success = false;
          let lastError = '';

          while (attempts < 3) {
            attempts++;
            try {
              const data = await callFn('importDealsJSON', { deals: chunk });
              if (!data?.success) throw new Error(data?.error || 'risposta non valida');
              totalInserted += data.inserted || 0;
              success = true;
              break;
            } catch (e) {
              lastError = e.message;
              if (attempts < 3) {
                addLog(`⚠ Tentativo ${attempts} fallito — riprovo in ${attempts * 2}s...`, 'warn');
                await new Promise(r => setTimeout(r, attempts * 2000));
              }
            }
          }

          if (!success) {
            addLog(`✗ Batch #${batchNum} saltato (3 tentativi): ${lastError}`, 'error');
            failedBatches.push({ batchNum, startIdx: i, chunk });
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          setProgress({ inserted: totalInserted, total: totalRows, batch: batchNum });
          addLog(`✓ Batch #${batchNum}: ${totalInserted.toLocaleString('it-IT')}/${totalRows.toLocaleString('it-IT')}`, 'success');
          await new Promise(r => setTimeout(r, 300));
        }

        // ── 4. Retry batch falliti ──
        if (failedBatches.length > 0 && !cancelled) {
          addLog(`⟳ Retry di ${failedBatches.length} batch saltati...`, 'warn');
          await new Promise(r => setTimeout(r, 3000));

          for (const { batchNum: bn, chunk } of failedBatches) {
            if (cancelled) break;
            addLog(`⟳ Retry batch #${bn}...`);
            try {
              const data = await callFn('importDealsJSON', { deals: chunk });
              if (!data?.success) throw new Error(data?.error || 'risposta non valida');
              totalInserted += data.inserted || 0;
              setProgress({ inserted: totalInserted, total: totalRows, batch: batchNum });
              addLog(`✓ Retry batch #${bn} OK`, 'success');
            } catch (e) {
              addLog(`✗ Retry batch #${bn} definitivamente fallito: ${e.message}`, 'error');
            }
            await new Promise(r => setTimeout(r, 500));
          }
        }

        addLog(`━━ Import completato: ${totalInserted.toLocaleString('it-IT')} righe inserite ━━`, 'success');
        if (!cancelled) await onEnrichLob(anno, addLog);

        setState('done');
        if (!cancelled) onDone({
          anno, label,
          fileName: file.name,
          fileSize: file.size,
          inserted: totalInserted,
          total: totalRows,
          date: new Date().toISOString(),
          dataRiferimento,
        });

      } catch (e) {
        addLog(`✗ ERRORE FATALE: ${e.message}`, 'error');
        setState('error');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [task]);

  const pct = progress.total ? Math.round((progress.inserted / progress.total) * 100) : null;

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3">
          {state === 'loading' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          {state === 'done'    && <CheckCircle className="w-4 h-4 text-green-400" />}
          {state === 'error'   && <AlertCircle className="w-4 h-4 text-red-400" />}
          <span className="text-sm font-semibold text-white">
            {state === 'loading' ? `Importazione Anno ${task.label} in corso...`
              : state === 'done'  ? `Anno ${task.label} — Completato`
              : `Anno ${task.label} — Errore`}
          </span>
          <span className="text-xs text-gray-500 font-mono">{task.file.name}</span>
        </div>
        <div className="flex items-center gap-4">
          {progress.total && (
            <span className="text-xs font-mono text-gray-300 tabular-nums">
              {progress.inserted.toLocaleString('it-IT')} / {progress.total.toLocaleString('it-IT')} righe
              {pct !== null && <span className="text-blue-400 ml-2">{pct}%</span>}
            </span>
          )}
        </div>
      </div>

      {state === 'loading' && (
        <div className="h-1 bg-gray-800">
          <div className="h-1 bg-blue-500 transition-all duration-500" style={{ width: pct ? `${pct}%` : '5%' }} />
        </div>
      )}
      {state === 'done'  && <div className="h-1 bg-green-500" />}
      {state === 'error' && <div className="h-1 bg-red-500" />}

      <div ref={logRef} className="p-4 h-64 overflow-y-auto space-y-1">
        {logs.map((l, i) => <LogLine key={i} entry={l} />)}
        {state === 'loading' && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>elaborazione...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionHistory({ sessions, onClear }) {
  const [expanded, setExpanded] = useState(true);
  if (sessions.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-800">Storico Caricamenti</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sessions.length} import</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Svuota
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {sessions.map((s, i) => {
            const pct = s.total ? Math.round((s.inserted / s.total) * 100) : null;
            const isToday = new Date(s.date).toDateString() === new Date().toDateString();
            return (
              <div key={i} className={`flex items-center justify-between py-3 px-4 rounded-xl border ${s.error ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.error ? 'bg-red-500' : 'bg-green-500'}`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">Anno {s.anno}</p>
                      {s.dataRiferimento && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">Rif. {s.dataRiferimento}</span>}
                      {isToday && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md">oggi</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{s.fileName} · {(s.fileSize / 1024).toFixed(0)} KB</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(s.date).toLocaleDateString('it-IT')} {new Date(s.date).toLocaleTimeString('it-IT')}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  {s.error ? (
                    <p className="text-sm font-bold text-red-600">Errore</p>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-gray-800">
                        {s.inserted.toLocaleString('it-IT')}{s.total ? `/${s.total.toLocaleString('it-IT')}` : ''} righe
                      </p>
                      {pct !== null && (
                        <div className="mt-1">
                          <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5 text-right">{pct}%</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = 'import_sessions_log';
function loadStoredSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export default function Import() {
  const [activeTask, setActiveTask] = useState(null);
  const [sessions, setSessions] = useState(loadStoredSessions);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusRefresh, setStatusRefresh] = useState(0);

  const handleStart = (task) => setActiveTask({ ...task, key: Date.now() });

  const handleDone = (session) => {
    setSessions(prev => {
      const next = [session, ...prev].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setStatusRefresh(v => v + 1);
  };

  const runEnrichLob = async (anno, addLog) => {
    addLog(`⟳ Normalizzazione LOB anno ${anno}...`);
    try {
      let offset = 0;
      let totalProcessed = 0;
      let round = 0;

      while (true) {
        round++;
        const data = await callFn('enrichLob', { anno, offset });
        totalProcessed += data.processed || 0;
        offset = totalProcessed;

        if (round % 5 === 0 || !data.hasMore) {
          addLog(`  LOB: ${totalProcessed.toLocaleString('it-IT')} record processati...`);
        }
        if (!data.hasMore) break;
      }

      addLog(`✓ LOB normalizzati su ${totalProcessed.toLocaleString('it-IT')} record`, 'success');
    } catch (e) {
      addLog(`⚠ Normalizzazione LOB fallita: ${e.message} — puoi rieseguirla manualmente`, 'warn');
    }
  };

  const clearHistory = () => {
    setSessions([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="min-h-full bg-gray-50 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestione Dati</h1>
          <p className="text-sm text-gray-400 mt-0.5">Importazione consuntivi Excel & portafoglio clienti</p>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Cancella Dati
        </button>
      </div>

      <DataStatusPanel refreshTrigger={statusRefresh} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Portafoglio Clienti</h2>
          <p className="text-xs text-gray-400 mt-0.5">Anagrafica clienti per arricchimento deals</p>
        </div>
        <ImportPortafoglioButton onImported={() => {}} />
      </div>

      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-500" />
          Importa Consuntivi per Anno
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ANNI.map(a => (
            <ImportCard
              key={a.anno}
              {...a}
              isActive={activeTask?.anno === a.anno}
              onStart={handleStart}
            />
          ))}
        </div>
      </div>

      {activeTask && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              Log Importazione in Corso
            </h2>
            <button
              onClick={() => setActiveTask(null)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-3 h-3" /> Chiudi log
            </button>
          </div>
          <ActiveImportPanel key={activeTask.key} task={activeTask} onDone={handleDone} onEnrichLob={runEnrichLob} />
        </div>
      )}

      <SessionHistory sessions={sessions} onClear={clearHistory} />

      {showDeleteModal && (
        <DeleteDataModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => { setShowDeleteModal(false); setStatusRefresh(v => v + 1); }}
        />
      )}
    </div>
  );
}
