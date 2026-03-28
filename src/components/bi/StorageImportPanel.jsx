import { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functionsInstance } from '@/api/firebaseClient';
import { Cloud, Upload, RefreshCw, CheckCircle, Loader2, FileSpreadsheet, Play } from 'lucide-react';

const callFn = async (name, payload) => {
  const fn = httpsCallable(functionsInstance, name, { timeout: 540000 });
  const res = await fn(payload);
  return res.data;
};

const ANNI = ['2024', '2025', '2026'];

export default function StorageImportPanel({ onImported }) {
  const [files, setFiles] = useState({}); // { '2024': { path, name, size, updated } }
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [importing, setImporting] = useState({});
  const [results, setResults] = useState({});

  useEffect(() => { loadStorageFiles(); }, []);

  const loadStorageFiles = async () => {
    setLoading(true);
    try {
      const storageRef = ref(storage, 'consuntivi/');
      const list = await listAll(storageRef);
      const map = {};
      for (const item of list.items) {
        // Cerca l'anno nel nome del file
        const anno = ANNI.find(a => item.name.includes(a));
        if (anno) {
          map[anno] = { path: item.fullPath, name: item.name };
        }
      }
      setFiles(map);
    } catch (e) {
      console.error('Errore lista Storage:', e);
    }
    setLoading(false);
  };

  const handleUpload = async (anno, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [anno]: true }));
    try {
      const storageRef = ref(storage, `consuntivi/consuntivo_${anno}_${file.name}`);
      await uploadBytes(storageRef, file);
      await loadStorageFiles();
      setResults(prev => ({ ...prev, [anno]: { type: 'success', msg: `File caricato su Storage` } }));
    } catch (e) {
      setResults(prev => ({ ...prev, [anno]: { type: 'error', msg: e.message } }));
    }
    setUploading(prev => ({ ...prev, [anno]: false }));
  };

  const handleImport = async (anno) => {
    const file = files[anno];
    if (!file) return;
    setImporting(prev => ({ ...prev, [anno]: true }));
    setResults(prev => ({ ...prev, [anno]: { type: 'info', msg: 'Import in corso... (può richiedere qualche minuto)' } }));
    try {
      const data = await callFn('importFromStorage', { storagePath: file.path, anno });
      setResults(prev => ({ ...prev, [anno]: { type: 'success', msg: `✓ ${data.inserted} record importati e aggregati aggiornati` } }));
      if (onImported) onImported(anno);
    } catch (e) {
      setResults(prev => ({ ...prev, [anno]: { type: 'error', msg: e.message } }));
    }
    setImporting(prev => ({ ...prev, [anno]: false }));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-bold text-gray-800">Reimporta da Google Cloud Storage</h2>
        </div>
        <button onClick={loadStorageFiles} disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna lista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ANNI.map(anno => {
          const hasFile = !!files[anno];
          const isUploading = uploading[anno];
          const isImporting = importing[anno];
          const result = results[anno];

          return (
            <div key={anno} className={`rounded-xl border p-4 space-y-3 ${hasFile ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`w-4 h-4 ${hasFile ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className="text-sm font-bold text-gray-700">Anno {anno}</span>
                {hasFile && <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-auto" />}
              </div>

              {hasFile ? (
                <p className="text-xs text-gray-500 truncate">{files[anno].name}</p>
              ) : (
                <p className="text-xs text-gray-400">Nessun file su Storage</p>
              )}

              {/* Upload nuovo file */}
              <label className="flex items-center gap-1.5 text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                <Upload className="w-3.5 h-3.5" />
                {hasFile ? 'Sostituisci file' : 'Carica file Excel'}
                <input type="file" accept=".xlsx" className="hidden"
                  onChange={e => handleUpload(anno, e.target.files[0])}
                  disabled={isUploading || isImporting} />
              </label>
              {isUploading && <p className="text-xs text-blue-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Upload in corso...</p>}

              {/* Reimporta */}
              {hasFile && (
                <button onClick={() => handleImport(anno)} disabled={isImporting || isUploading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {isImporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Import in corso...</> : <><Play className="w-3.5 h-3.5" />Reimporta {anno}</>}
                </button>
              )}

              {result && (
                <div className={`text-xs px-2 py-1.5 rounded-lg ${
                  result.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
                  : result.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                  {result.msg}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        I file vengono letti direttamente da Storage senza ri-uppare. L'import cancella i dati esistenti e ricalcola gli aggregati automaticamente.
      </p>
    </div>
  );
}
