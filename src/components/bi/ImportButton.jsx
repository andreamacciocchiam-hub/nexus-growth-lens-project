import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle, AlertCircle, Loader2, X, FolderOpen } from 'lucide-react';

const ANNI = [
  { anno: '2024', label: '2024', color: 'gray', hint: 'storico' },
  { anno: '2025', label: '2025', color: 'amber', hint: 'consolidato' },
  { anno: '2026', label: '2026', color: 'blue', hint: 'corrente', requiresDate: true },
];

function AnnoImportRow({ anno, label, color, hint, requiresDate, onImported }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState(null);
  const [dataRiferimento, setDataRiferimento] = useState('');
  const fileRef = useRef();

  const colorMap = {
    gray: { badge: 'bg-gray-100 text-gray-600', btn: 'bg-gray-600 hover:bg-gray-700', border: 'border-gray-200', check: 'border-l-gray-400' },
    amber: { badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700', border: 'border-amber-200', check: 'border-l-amber-400' },
    blue: { badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700', border: 'border-blue-200', check: 'border-l-blue-500' },
  };
  const c = colorMap[color];

  const reset = () => {
    setState('idle');
    setMsg('');
    setFile(null);
    setDataRiferimento('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!file) return;
    if (requiresDate && !dataRiferimento) return;
    setState('loading');
    setMsg('Upload file...');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      let startRow = 0;
      let totalInserted = 0;
      while (true) {
        const res = await base44.functions.invoke('importDeals', {
          anno,
          startRow,
          portafoglio: 'Base',
          fileUrl: file_url,
          dataRiferimento: requiresDate ? dataRiferimento : '',
        });
        const data = res.data;
        if (!data?.success) throw new Error(data?.error || `Errore importazione ${anno}`);
        totalInserted += data.inserted || 0;
        setMsg(`${totalInserted}/${data.totalDataRows || '?'} righe...`);
        if (data.nextStartRow === null || data.nextStartRow === undefined) break;
        startRow = data.nextStartRow;
      }
      setMsg(`${totalInserted} righe importate${requiresDate ? ` · Rif. ${dataRiferimento}` : ''}`);
      setState('done');
      onImported && onImported();
    } catch (e) {
      setMsg(e.message);
      setState('error');
    }
  };

  return (
    <div className={`border rounded-xl p-3 border-l-4 ${c.border} ${c.check}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{label}</span>
          <span className="text-[10px] text-gray-400">{hint}</span>
        </div>
        {state !== 'idle' && (
          <button onClick={reset} className="text-gray-300 hover:text-gray-500">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {state === 'idle' && (
        <div className="space-y-2">
          {requiresDate && (
            <input
              type="date"
              value={dataRiferimento}
              onChange={e => setDataRiferimento(e.target.value)}
              placeholder="Data riferimento"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          )}
          <div
            onClick={() => fileRef.current.click()}
            className={`border-2 border-dashed rounded-lg px-3 py-2 text-center cursor-pointer transition-colors ${
              file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => setFile(e.target.files[0])} />
            <p className={`text-[11px] truncate ${file ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
              {file ? file.name : 'Seleziona file .xlsx'}
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={!file || (requiresDate && !dataRiferimento)}
            className={`w-full py-1.5 text-white text-xs font-medium rounded-lg disabled:opacity-40 transition-colors ${c.btn}`}
          >
            Importa {label}
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2 py-1">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
          <p className="text-[11px] text-gray-500">{msg}</p>
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-2 py-1">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-[11px] text-green-700 font-medium">{msg}</p>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-[11px] text-red-600 truncate">{msg}</p>
          </div>
          <button onClick={reset} className="text-[11px] text-blue-600 hover:underline">Riprova</button>
        </div>
      )}
    </div>
  );
}

export default function ImportButton({ onImported }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors"
      >
        <Upload className="w-4 h-4" /> Importa Consuntivi
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-5 w-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-500" /> Importa Consuntivi Excel
            </h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {ANNI.map(a => (
              <AnnoImportRow key={a.anno} {...a} onImported={onImported} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}