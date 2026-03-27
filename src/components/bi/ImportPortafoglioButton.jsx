import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import { PORTAFOGLI } from './DealsFilters';

async function callFn(name, payload) {
  const fn = httpsCallable(functionsInstance, name, { timeout: 300000 });
  const res = await fn(payload);
  return res.data;
}

async function parsePortafoglioExcel(file) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const str = v => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

  return rows.map(r => ({
    cf:                 str(r['CF']),
    cf_capogruppo:      str(r['CF CAPOGRUPPO']),
    ragione_sociale:    str(r['RAG_SOC']) || str(r['Capogruppo']) || 'N/D',
    capogruppo:         str(r['Capogruppo']),
    vertical_gruppo:    str(r['VERTICAL Gruppo']),
    segmento_26:        str(r['SEGMENTO CLIENTE 2026']),
    area_rac:           str(r['AREA RAC']),
    rac:                str(r['RAC']),
    area_mng:           str(r['AREA MNG']),
    struttura_sales:    str(r['STRUTTURA SALES CORE']),
    area_rac_26:        str(r['AREA RAC 26']),
    rac_26:             str(r['RAC 26']),
    area_mng_26:        str(r['AREA MNG 26']),
    struttura_sales_26: str(r['STRUTTURA SALES CORE 26']),
  })).filter(r => r.ragione_sociale);
}

export default function ImportPortafoglioButton({ onImported }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [nome, setNome] = useState(PORTAFOGLI[0]);
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const handleImport = async () => {
    if (!file) return;
    setState('loading');
    try {
      setMsg('Parsing Excel...');
      const records = await parsePortafoglioExcel(file);

      if (records.length === 0) {
        setState('error');
        setMsg('Nessun record valido trovato nel file');
        return;
      }

      setMsg(`Importazione ${records.length} clienti...`);

      // Manda i record JSON direttamente — niente xlsx nella function
      const CHUNK = 200;
      let inserted = 0;

      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        const data = await callFn('importPortafoglioClienti', {
          records: chunk,
          portafoglio_nome: nome,
          isFirst: i === 0, // la function cancella i vecchi solo al primo chunk
        });
        inserted += data.inserted || 0;
        setMsg(`Importazione... ${inserted}/${records.length} clienti`);
      }

      setState('success');
      setMsg(`${inserted} clienti importati`);
      onImported && onImported();
      setTimeout(() => { setOpen(false); setState('idle'); setFile(null); }, 2500);
    } catch (e) {
      setState('error');
      setMsg(e.message || 'Errore import');
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors">
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
                <select value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  {PORTAFOGLI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">File Excel (.xlsx)</label>
                <input ref={fileRef} type="file" accept=".xlsx,.xls"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-purple-50 file:text-purple-700 file:font-medium hover:file:bg-purple-100" />
              </div>
            </div>

            {state === 'loading' && (
              <div className="flex items-center gap-2 text-blue-600 text-sm bg-blue-50 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {msg}
              </div>
            )}
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
              <button onClick={handleImport} disabled={!file || state === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
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
