import { useState, useRef } from 'react';
import { useImport } from '@/lib/ImportContext';
import {
  Upload, CheckCircle, AlertCircle, Loader2, X,
  Trash2, Clock, FileSpreadsheet, ChevronDown, ChevronUp
} from 'lucide-react';
import DeleteDataModal from '../components/bi/DeleteDataModal';
import ImportPortafoglioButton from '../components/bi/ImportPortafoglioButton';
import DataStatusPanel from '../components/bi/DataStatusPanel';

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

function ImportCard({ anno, label, color, hint, requiresDate, onStart, isRunning }) {
  const [file, setFile] = useState(null);
  const [dataRiferimento, setDataRiferimento] = useState('');
  const fileRef = useRef();
  const c = COLOR_MAP[color];

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${c.border} shadow-sm p-5 space-y-3 ${isRunning ? 'ring-2 ring-blue-200' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{label}</span>
        <span className="text-xs text-gray-400">{hint}</span>
        {isRunning && <Loader2 className="w-3 h-3 text-blue-500 animate-spin ml-auto" />}
      </div>

      {requiresDate && (
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Data riferimento *</label>
          <input type="date" value={dataRiferimento} onChange={e => setDataRiferimento(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      )}

      <div onClick={() => fileRef.current.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-4 text-center cursor-pointer transition-all ${
          file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => setFile(e.target.files[0])} />
        <FileSpreadsheet className={`w-5 h-5 mx-auto mb-1 ${file ? 'text-green-500' : 'text-gray-300'}`} />
        <p className={`text-xs font-medium truncate ${file ? 'text-green-700' : 'text-gray-400'}`}>
          {file ? file.name : 'Seleziona file .xlsx'}
        </p>
        {file && <p className="text-[10px] text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>}
      </div>

      <button
        onClick={() => { if (file && (!requiresDate || dataRiferimento)) onStart({ anno, label, file, dataRiferimento: requiresDate ? dataRiferimento : null }); }}
        disabled={!file || (requiresDate && !dataRiferimento) || isRunning}
        className={`w-full py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center gap-2 ${c.btn}`}
      >
        <Upload className="w-4 h-4" /> {isRunning ? 'Import in corso...' : `Importa ${label}`}
      </button>
    </div>
  );
}

function SessionHistory({ sessions, onClear }) {
  const [expanded, setExpanded] = useState(true);
  if (!sessions?.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-800">Storico Caricamenti</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sessions.length} import</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onClear(); }}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-50">Svuota</button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {sessions.map((s, i) => {
            const pct = s.total ? Math.round((s.inserted / s.total) * 100) : null;
            const isToday = new Date(s.date).toDateString() === new Date().toDateString();
            return (
              <div key={i} className="flex items-center justify-between py-3 px-4 rounded-xl border bg-gray-50 border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-green-500" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">Anno {s.anno}</p>
                      {s.dataRiferimento && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">Rif. {s.dataRiferimento}</span>}
                      {isToday && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md">oggi</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{s.fileName} · {(s.fileSize / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-bold text-gray-800">
                    {s.inserted?.toLocaleString('it-IT')}{s.total ? `/${s.total.toLocaleString('it-IT')}` : ''} righe
                  </p>
                  {pct !== null && (
                    <div className="mt-1">
                      <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
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
  const { importStatus, startImport, clearStatus } = useImport();
  const [sessions, setSessions] = useState(loadStoredSessions);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusRefresh, setStatusRefresh] = useState(0);

  const handleStart = (task) => startImport(task);

  const clearHistory = () => {
    setSessions([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Aggiorna storico quando un import finisce
  const isRunning = importStatus?.state === 'running';

  return (
    <div className="min-h-full bg-gray-50 p-6 space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestione Dati</h1>
          <p className="text-sm text-gray-400 mt-0.5">Importazione consuntivi Excel & portafoglio clienti</p>
        </div>
        <button onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100 hover:bg-red-100 transition-colors">
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

      {/* Status import globale (se in corso) */}
      {importStatus && (
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
          importStatus.state === 'running' ? 'bg-blue-50 border-blue-200' :
          importStatus.state === 'done'    ? 'bg-green-50 border-green-200' :
                                             'bg-red-50 border-red-200'}`}>
          {importStatus.state === 'running' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
          {importStatus.state === 'done'    && <CheckCircle className="w-5 h-5 text-green-500" />}
          {importStatus.state === 'error'   && <AlertCircle className="w-5 h-5 text-red-500" />}
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">
              Import Anno {importStatus.anno} — {importStatus.state === 'running' ? 'in corso' : importStatus.state === 'done' ? 'completato' : 'errore'}
            </p>
            <p className="text-xs text-gray-500">{importStatus.lastLog}</p>
          </div>
          {importStatus.state !== 'running' && (
            <button onClick={clearStatus}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-500" />
          Importa Consuntivi per Anno
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ANNI.map(a => (
            <ImportCard key={a.anno} {...a}
              isRunning={isRunning && importStatus?.anno === a.anno}
              onStart={handleStart} />
          ))}
        </div>
      </div>

      <SessionHistory sessions={sessions} onClear={clearHistory} />

      {showDeleteModal && (
        <DeleteDataModal isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => { setShowDeleteModal(false); setStatusRefresh(v => v + 1); }} />
      )}
    </div>
  );
}
