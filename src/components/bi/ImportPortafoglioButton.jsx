import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import { PORTAFOGLI } from './DealsFilters';

export default function ImportPortafoglioButton({ onImported }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [nome, setNome] = useState(PORTAFOGLI[0]);
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = useState('');
  const ref = useRef(null);

  const handleImport = async () => {
    if (!file) return;
    setState('loading');
    setMsg('Upload file in corso...');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setMsg('Importazione clienti...');
    const res = await base44.functions.invoke('importPortafoglioClienti', { file_url, portafoglio_nome: nome });
    if (res.data?.ok) {
      setState('success');
      setMsg(`${res.data.inserted} clienti importati`);
      onImported && onImported();
      setTimeout(() => { setOpen(false); setState('idle'); setFile(null); }, 2500);
    } else {
      setState('error');
      setMsg(res.data?.error || 'Errore import');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
      >
        <Upload className="w-3.5 h-3.5" /> Importa Anagrafica
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Importa Portafoglio Clienti</h3>
              <button onClick={() => { setOpen(false); setState('idle'); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Portafoglio</label>
                <select
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {PORTAFOGLI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">File Excel (.xlsx)</label>
                <input
                  ref={ref}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-purple-50 file:text-purple-700 file:font-medium hover:file:bg-purple-100"
                />
              </div>
            </div>

            {state === 'success' && (
              <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">
                <Check className="w-4 h-4" /> {msg}
              </div>
            )}
            {state === 'error' && (
              <div className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{msg}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annulla</button>
              <button
                onClick={handleImport}
                disabled={!file || state === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}