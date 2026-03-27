import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/api/firebaseClient';
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

const ImportContext = createContext();

async function callFn(name, payload) {
  const fn = httpsCallable(functionsInstance, name);
  const res = await fn(payload);
  return res.data;
}

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
    id: header.indexOf('ID SDW'),
    capogruppo: findCol('Ragione Sociale Capogruppo'),
    rs: header.findIndex(h => h === 'Ragione Sociale'),
    desc: header.indexOf('Descrizione'),
    areaRac: findCol('NEW AREA RAC', 'AREA RAC'),
    rac: header.indexOf('RAC'),
    newAreaRac: findCol('NEW AREA RAC'),
    newArea: header.indexOf('NEW AREA'),
    areaMng: findCol('AREA MNG'),
    strutturaSales: findCol('STRUTTURA SALES'),
    strutturaSDW: findCol('STRUTTURA SDW'),
    ad: findCol('Attacco/Difesa', 'Attacco / Difesa', 'A/D'),
    ambito: findCol('NEW Ambito', 'Ambito'),
    newAmbito: findCol('NEW Ambito'),
    lob: findCol('LOB'),
    specialist: header.indexOf('SPECIALIST'),
    specialistNoDouble: findCol('SPECIALIST no Double'),
    mese: header.indexOf('Mese'),
    durata: header.indexOf('Durata'),
    newEntry: header.indexOf('New ENTRY'),
    codice: findCol('Codice Progetto', 'Codice'),
    fornitore: findCol('Fornitore'),
    totCtr: findCol('tot ctr'),
    ricIAnno: findCol('ric I anno'),
    serviziTot: findCol('Servizi Totali'),
    servIAnno: findCol('serv I anno'),
    canoni: findCol('Canoni', 'di cui Can'),
    ar: findCol('A/R'),
    ut: findCol('di cui UT'),
    diffServ: findCol('Differenziale Servizi'),
    vendita: header.indexOf('vendita'),
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
      portafoglio: 'Base', anno, tipo, data_riferimento: dataRiferimento || '',
      id_sdw: parseStr(arr[C.id]),
      ragione_sociale_capogruppo: parseStr(arr[C.capogruppo]),
      ragione_sociale: parseStr(arr[C.rs]),
      descrizione: parseStr(arr[C.desc]),
      area_rac: parseStr(arr[C.areaRac]),
      rac: parseStr(arr[C.rac]),
      new_area_rac: parseStr(arr[C.newAreaRac]),
      new_area: parseStr(arr[C.newArea]),
      area_mng: parseStr(arr[C.areaMng]),
      struttura_sales: parseStr(arr[C.strutturaSales]),
      struttura_sdw: parseStr(arr[C.strutturaSDW]),
      attacco_difesa: adRaw === 'attacco' ? 'Attacco' : adRaw === 'difesa' ? 'Difesa' : parseStr(arr[C.ad]),
      ambito: ambitoVal,
      new_ambito: parseStr(arr[C.newAmbito]),
      lob: lobVal, lob_originale: lobVal,
      specialist: parseStr(arr[C.specialist]),
      specialist_no_double: parseStr(arr[C.specialistNoDouble]),
      mese: parseNum(arr[C.mese]), durata: parseNum(arr[C.durata]),
      new_entry: !!arr[C.newEntry],
      codice_progetto: parseStr(arr[C.codice]),
      fornitore: parseStr(arr[C.fornitore]),
      tot_ctr: parseNum(arr[C.totCtr]), ric_i_anno: parseNum(arr[C.ricIAnno]),
      servizi_totali: parseNum(arr[C.serviziTot]), serv_i_anno: parseNum(arr[C.servIAnno]),
      canoni: parseNum(arr[C.canoni]), ar: parseNum(arr[C.ar]), ut: parseNum(arr[C.ut]),
      differenziale_servizi: parseNum(arr[C.diffServ]), vendita: parseNum(arr[C.vendita]),
    });
  }
  return deals;
}

// ─── Banner fisso in basso ─────────────────────────────────────────
function ImportBanner({ status }) {
  if (!status) return null;
  const { anno, state, inserted, total, lastLog } = status;
  const pct = total ? Math.round((inserted / total) * 100) : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center gap-3 shadow-2xl">
      {state === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />}
      {state === 'done'    && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
      {state === 'error'   && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}

      <span className="text-white text-xs font-semibold">
        {state === 'running' ? `Import Anno ${anno} in corso...`
          : state === 'done'  ? `Import Anno ${anno} completato`
          : `Import Anno ${anno} — errore`}
      </span>

      {pct !== null && (
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-xs">
            <div className="h-1.5 bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-400 tabular-nums">
            {inserted?.toLocaleString('it-IT')}/{total?.toLocaleString('it-IT')} ({pct}%)
          </span>
        </div>
      )}

      {lastLog && (
        <span className="text-xs text-gray-400 truncate max-w-sm hidden md:block">{lastLog}</span>
      )}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────
export function ImportProvider({ children, onImportDone }) {
  const [importStatus, setImportStatus] = useState(null); // { anno, state, inserted, total, lastLog }
  const cancelRef = useRef(false);

  const startImport = useCallback(async ({ anno, label, file, dataRiferimento }) => {
    cancelRef.current = false;
    setImportStatus({ anno, state: 'running', inserted: 0, total: null, lastLog: 'Avvio...' });

    try {
      // Warm-up
      setImportStatus(s => ({ ...s, lastLog: 'Warm-up connessione...' }));
      try { await callFn('ping', {}); } catch (_) {}

      // Parse Excel
      setImportStatus(s => ({ ...s, lastLog: 'Parsing Excel...' }));
      const deals = await parseExcel(file, anno, dataRiferimento);
      const totalRows = deals.length;
      setImportStatus(s => ({ ...s, total: totalRows, lastLog: `${totalRows.toLocaleString('it-IT')} righe trovate` }));

      if (totalRows === 0) {
        setImportStatus(s => ({ ...s, state: 'error', lastLog: 'Nessuna riga valida' }));
        return;
      }

      // Import a batch
      const CHUNK = 50;
      let totalInserted = 0;
      let batchNum = 0;
      const failedBatches = [];

      for (let i = 0; i < deals.length; i += CHUNK) {
        if (cancelRef.current) break;
        batchNum++;
        const chunk = deals.slice(i, i + CHUNK);

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
            if (attempts < 3) await new Promise(r => setTimeout(r, attempts * 2000));
          }
        }

        if (!success) {
          failedBatches.push({ batchNum, chunk });
        }

        setImportStatus(s => ({
          ...s,
          inserted: totalInserted,
          lastLog: `Batch #${batchNum} — ${totalInserted.toLocaleString('it-IT')}/${totalRows.toLocaleString('it-IT')} righe`
        }));

        await new Promise(r => setTimeout(r, 300));
      }

      // Retry falliti
      if (failedBatches.length > 0 && !cancelRef.current) {
        setImportStatus(s => ({ ...s, lastLog: `Retry ${failedBatches.length} batch falliti...` }));
        await new Promise(r => setTimeout(r, 3000));
        for (const { chunk } of failedBatches) {
          if (cancelRef.current) break;
          try {
            const data = await callFn('importDealsJSON', { deals: chunk });
            if (data?.success) totalInserted += data.inserted || 0;
          } catch (_) {}
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Enrich LOB
      setImportStatus(s => ({ ...s, inserted: totalInserted, lastLog: 'Normalizzazione LOB...' }));
      try {
        let offset = 0;
        while (true) {
          const data = await callFn('enrichLob', { anno, offset });
          offset += data.processed || 0;
          if (!data.hasMore) break;
        }
      } catch (_) {}

      setImportStatus(s => ({ ...s, state: 'done', lastLog: `Completato: ${totalInserted.toLocaleString('it-IT')} righe inserite` }));
      if (onImportDone) onImportDone({ anno, label, inserted: totalInserted, total: totalRows, fileName: file.name, fileSize: file.size, date: new Date().toISOString(), dataRiferimento });

    } catch (e) {
      setImportStatus(s => ({ ...s, state: 'error', lastLog: e.message }));
    }
  }, [onImportDone]);

  const clearStatus = useCallback(() => {
    cancelRef.current = true;
    setImportStatus(null);
  }, []);

  return (
    <ImportContext.Provider value={{ importStatus, startImport, clearStatus }}>
      {children}
      <ImportBanner status={importStatus} />
    </ImportContext.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error('useImport must be used within ImportProvider');
  return ctx;
}

