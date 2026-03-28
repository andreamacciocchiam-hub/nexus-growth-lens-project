const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
admin.initializeApp();
const db = admin.firestore();

const FN_CONFIG = {
  region: 'europe-west1',
  cors: true,
  invoker: 'public',
};

const VALID_LOB = ['Cloud', 'Connettività', 'IoT', 'Other IT', 'Licensing', 'Security'];

function normalizeLob(lob, specialist, descrizione, tipo) {
  if (tipo === 'TTV' && !specialist && !lob) return '';
  const raw = (lob || specialist || descrizione || '').toLowerCase().trim();
  if (!raw) return '';
  if (VALID_LOB.some(v => v.toLowerCase() === raw))
    return VALID_LOB.find(v => v.toLowerCase() === raw);
  if (raw.includes('cloud') || raw.includes('aws') || raw.includes('azure') ||
      raw.includes('saas') || raw.includes('iaas') || raw.includes('paas')) return 'Cloud';
  if (raw.includes('connett') || raw.includes('connect') || raw.includes('rete') ||
      raw.includes('network') || raw.includes('fibra') || raw.includes('mpls') ||
      raw.includes('sd-wan') || raw.includes('wan')) return 'Connettività';
  if (raw.includes('iot') || raw.includes('m2m') || raw.includes('sensori') ||
      raw.includes('telemetria')) return 'IoT';
  if (raw.includes('security') || raw.includes('sicurezza') || raw.includes('firewall') ||
      raw.includes('soc') || raw.includes('cyber') || raw.includes('antivirus') ||
      raw.includes('endpoint')) return 'Security';
  if (raw.includes('licens') || raw.includes('license') || raw.includes('microsoft') ||
      raw.includes('office') || raw.includes('software') ||
      raw.includes('abbonamento')) return 'Licensing';
  return 'Other IT';
}

// ─── Aggregazione ──────────────────────────────────────────────────
async function computeAndSaveAggregates(anno) {
const deals = [];
let lastDoc = null;
while (true) {
  let q = db.collection('deals').where('anno', '==', String(anno)).limit(500);
  if (lastDoc) q = q.startAfter(lastDoc);
  const snap = await q.get();
  if (snap.empty) break;
  snap.docs.forEach(d => deals.push(d.data()));
  if (snap.docs.length < 500) break;
  lastDoc = snap.docs[snap.docs.length - 1];
}
  const sum = (arr, f) => arr.reduce((s, d) => s + (d[f] || 0), 0);

  const kpi = {
    n: deals.length,
    serv: sum(deals, 'serv_i_anno'),
    canoni: sum(deals, 'canoni'),
    diff: sum(deals, 'differenziale_servizi'),
    att: deals.filter(d => d.attacco_difesa === 'Attacco').reduce((s, d) => s + (d.serv_i_anno || 0), 0),
    dif: deals.filter(d => d.attacco_difesa === 'Difesa').reduce((s, d) => s + (d.serv_i_anno || 0), 0),
    ctr: deals.filter(d => d.tipo === 'CTR').length,
    ttv: deals.filter(d => d.tipo === 'TTV').length,
  };

  const byArea = {}, byLob = {}, byRac = {}, byMese = {}, clientMap = {};

  deals.forEach(d => {
    const area = d.area_rac || 'N/D';
    if (!byArea[area]) byArea[area] = { area, serv: 0, canoni: 0, diff: 0, att: 0, dif: 0, n: 0 };
    byArea[area].serv += d.serv_i_anno || 0;
    byArea[area].canoni += d.canoni || 0;
    byArea[area].diff += d.differenziale_servizi || 0;
    if (d.attacco_difesa === 'Attacco') byArea[area].att += d.serv_i_anno || 0;
    else byArea[area].dif += d.serv_i_anno || 0;
    byArea[area].n++;

    const lob = d.lob || 'N/D';
    if (!byLob[lob]) byLob[lob] = { lob, serv: 0, canoni: 0, n: 0 };
    byLob[lob].serv += d.serv_i_anno || 0;
    byLob[lob].canoni += d.canoni || 0;
    byLob[lob].n++;

    const rac = d.rac || 'N/D';
    if (!byRac[rac]) byRac[rac] = { rac, area: d.area_rac || '', serv: 0, n: 0 };
    byRac[rac].serv += d.serv_i_anno || 0;
    byRac[rac].n++;

    if (d.mese && d.mese > 0) {
      const k = String(d.mese);
      if (!byMese[k]) byMese[k] = { mese: d.mese, serv: 0, canoni: 0, diff: 0, n: 0 };
      byMese[k].serv += d.serv_i_anno || 0;
      byMese[k].canoni += d.canoni || 0;
      byMese[k].diff += d.differenziale_servizi || 0;
      byMese[k].n++;
    }

    const nome = d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/D';
    if (!clientMap[nome]) clientMap[nome] = { nome, area: d.area_rac || '', rac: d.rac || '', serv: 0, canoni: 0, diff: 0, att: 0, n: 0, lobs: {} };
    clientMap[nome].serv += d.serv_i_anno || 0;
    clientMap[nome].canoni += d.canoni || 0;
    clientMap[nome].diff += d.differenziale_servizi || 0;
    if (d.attacco_difesa === 'Attacco') clientMap[nome].att += d.serv_i_anno || 0;
    clientMap[nome].n++;
    if (d.lob) clientMap[nome].lobs[d.lob] = (clientMap[nome].lobs[d.lob] || 0) + 1;
  });

  const topClienti = Object.values(clientMap)
    .sort((a, b) => b.serv - a.serv)
    .slice(0, 100)
    .map(c => ({ ...c, lobs: Object.keys(c.lobs).join(', ') }));

  await db.collection('aggregati').doc(String(anno)).set({
    anno: String(anno), kpi,
    byArea: Object.values(byArea),
    byLob: Object.values(byLob),
    byRac: Object.values(byRac).sort((a, b) => b.serv - a.serv).slice(0, 50),
    byMese: Object.values(byMese).sort((a, b) => a.mese - b.mese),
    topClienti,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { anno, n: deals.length };
}

// ─── importDealsJSON ───────────────────────────────────────────────
exports.importDealsJSON = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { deals, isLast, anno } = request.data;
    if (!Array.isArray(deals)) throw new Error('deals deve essere un array');

    const normalizedDeals = deals.map(d => ({
      ...d,
      lob: normalizeLob(d.lob_originale || d.lob || '', d.specialist || '', d.descrizione || '', d.tipo || 'CTR'),
    }));

    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < normalizedDeals.length; i += CHUNK) {
      const batch = db.batch();
      normalizedDeals.slice(i, i + CHUNK).forEach(deal => {
        const ref = db.collection('deals').doc();
        batch.set(ref, { ...deal, created_date: admin.firestore.FieldValue.serverTimestamp() });
        inserted++;
      });
      await batch.commit();
      await new Promise(r => setTimeout(r, 200));
    }

    if (isLast && anno) await computeAndSaveAggregates(anno);
    return { success: true, inserted };
  }
);

// ─── importFromStorage ─────────────────────────────────────────────
// Legge un file Excel da Firebase Storage e reimporta l'anno
exports.importFromStorage = onCall(
  { ...FN_CONFIG, timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { storagePath, anno } = request.data;
    if (!storagePath || !anno) throw new Error('storagePath e anno obbligatori');

    // Scarica il file da Storage
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();

    // Parse Excel con xlsx
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(n => n.includes(anno)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const headerIdx = rawRows.findIndex(row => row.some(c => String(c ?? '').trim() === 'ID SDW'));
    if (headerIdx === -1) throw new Error('Header "ID SDW" non trovato');

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
      ad: findCol('Attacco/Difesa', 'Attacco / Difesa', 'A/D'),
      lob: findCol('LOB'),
      specialist: header.indexOf('SPECIALIST'),
      mese: header.indexOf('Mese'),
      durata: header.indexOf('Durata'),
      servIAnno: findCol('serv I anno'),
      canoni: findCol('Canoni', 'di cui Can'),
      diffServ: findCol('Differenziale Servizi'),
    };

    const parseNum = (val) => { if (!val && val !== 0) return 0; const n = parseFloat(String(val).replace(',', '.')); return isNaN(n) ? 0 : n; };
    const parseStr = (val) => val == null ? '' : String(val).trim();

    const deals = [];
    for (const arr of dataRows) {
      const id = arr[C.id];
      if (!id || !String(id).startsWith('OP-')) continue;
      const mese = parseNum(arr[C.mese]);
      const tipo = mese === 0 ? 'TTV' : 'CTR';
      const lobRaw = parseStr(arr[C.lob]);
      const lobVal = lobRaw && !isNaN(Number(lobRaw)) ? '' : lobRaw;
      const adRaw = parseStr(arr[C.ad]).toLowerCase();

      deals.push({
        portafoglio: 'Base', anno, tipo,
        id_sdw: parseStr(arr[C.id]),
        ragione_sociale_capogruppo: parseStr(arr[C.capogruppo]),
        ragione_sociale: parseStr(arr[C.rs]),
        descrizione: parseStr(arr[C.desc]),
        area_rac: parseStr(arr[C.areaRac]),
        rac: parseStr(arr[C.rac]),
        attacco_difesa: adRaw === 'attacco' ? 'Attacco' : adRaw === 'difesa' ? 'Difesa' : parseStr(arr[C.ad]),
        lob: normalizeLob(lobVal, parseStr(arr[C.specialist]), parseStr(arr[C.desc]), tipo),
        lob_originale: lobVal,
        specialist: parseStr(arr[C.specialist]),
        mese, durata: parseNum(arr[C.durata]),
        serv_i_anno: parseNum(arr[C.servIAnno]),
        canoni: parseNum(arr[C.canoni]),
        differenziale_servizi: parseNum(arr[C.diffServ]),
      });
    }

    // Cancella vecchi record per quell'anno
    let snap;
    do {
      snap = await db.collection('deals').where('anno', '==', String(anno)).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      await new Promise(r => setTimeout(r, 100));
    } while (!snap.empty);

    // Inserisci nuovi record
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < deals.length; i += CHUNK) {
      const batch = db.batch();
      deals.slice(i, i + CHUNK).forEach(deal => {
        const ref = db.collection('deals').doc();
        batch.set(ref, { ...deal, created_date: admin.firestore.FieldValue.serverTimestamp() });
        inserted++;
      });
      await batch.commit();
      await new Promise(r => setTimeout(r, 200));
    }

    await computeAndSaveAggregates(anno);
    return { success: true, inserted, total: deals.length };
  }
);

// ─── aggregateDeals ────────────────────────────────────────────────
exports.aggregateDeals = onCall(
  { ...FN_CONFIG, timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno } = request.data;
    const anni = anno ? [anno] : ['2024', '2025', '2026'];
    const results = [];
    for (const a of anni) {
      const r = await computeAndSaveAggregates(a);
      results.push(r);
    }
    return { success: true, results };
  }
);

// ─── updateDeal ────────────────────────────────────────────────────
exports.updateDeal = onCall(
  { ...FN_CONFIG, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { dealId, fields, anno } = request.data;
    if (!dealId || !fields) throw new Error('dealId e fields obbligatori');

    await db.collection('deals').doc(dealId).update({
      ...fields,
      updated_date: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Ricalcola aggregati per quell'anno
    if (anno) await computeAndSaveAggregates(anno);
    return { success: true };
  }
);

// ─── deleteDeal ────────────────────────────────────────────────────
exports.deleteDeal = onCall(
  { ...FN_CONFIG, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { dealIds, anno } = request.data;
    if (!dealIds?.length) throw new Error('dealIds obbligatorio');

    const CHUNK = 400;
    for (let i = 0; i < dealIds.length; i += CHUNK) {
      const batch = db.batch();
      dealIds.slice(i, i + CHUNK).forEach(id => batch.delete(db.collection('deals').doc(id)));
      await batch.commit();
    }

    if (anno) await computeAndSaveAggregates(anno);
    return { success: true, deleted: dealIds.length };
  }
);

// ─── createDeal ────────────────────────────────────────────────────
exports.createDeal = onCall(
  { ...FN_CONFIG, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { deal } = request.data;
    if (!deal) throw new Error('deal obbligatorio');

    const ref = db.collection('deals').doc();
    await ref.set({
      ...deal,
      lob: normalizeLob(deal.lob || '', deal.specialist || '', deal.descrizione || '', deal.tipo || 'CTR'),
      created_date: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (deal.anno) await computeAndSaveAggregates(deal.anno);
    return { success: true, id: ref.id };
  }
);

// ─── listStorageFiles ──────────────────────────────────────────────
exports.listStorageFiles = onCall(
  { ...FN_CONFIG, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'consuntivi/' });
    const result = files.map(f => ({
      name: f.name,
      size: f.metadata.size,
      updated: f.metadata.updated,
    }));
    return { files: result };
  }
);

// ─── deleteChunk ───────────────────────────────────────────────────
exports.deleteChunk = onCall(
  { ...FN_CONFIG, timeoutSeconds: 540, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno } = request.data;
    if (!anno) throw new Error('anno richiesto');
    let deleted = 0, snap;
    do {
      snap = await db.collection('deals').where('anno', '==', String(anno)).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.docs.length;
      await new Promise(r => setTimeout(r, 100));
    } while (!snap.empty);
    await db.collection('aggregati').doc(String(anno)).delete();
    return { success: true, deleted };
  }
);

// ─── enrichLob ────────────────────────────────────────────────────
exports.enrichLob = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno, offset = 0 } = request.data;
    const snap = await db.collection('deals').where('anno', '==', String(anno)).limit(500).offset(offset).get();
    const batch = db.batch();
    snap.docs.forEach(d => {
      const data = d.data();
      batch.update(d.ref, { lob: normalizeLob(data.lob_originale || data.lob || '', data.specialist || '', data.descrizione || '', data.tipo || 'CTR') });
    });
    await batch.commit();
    return { processed: snap.docs.length, hasMore: snap.docs.length === 500, nextOffset: offset + snap.docs.length };
  }
);

// ─── importPortafoglioClienti ──────────────────────────────────────
exports.importPortafoglioClienti = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { records, portafoglio_nome, isFirst } = request.data;
    if (!Array.isArray(records)) throw new Error('records deve essere un array');
    const portafoglioNome = portafoglio_nome || 'Base';
    if (isFirst) {
      let snap;
      do {
        snap = await db.collection('portafoglio_clienti').where('portafoglio_nome', '==', portafoglioNome).limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await new Promise(r => setTimeout(r, 100));
      } while (!snap.empty);
    }
    let inserted = 0;
    for (let i = 0; i < records.length; i += 400) {
      const batch = db.batch();
      records.slice(i, i + 400).forEach(record => {
        const ref = db.collection('portafoglio_clienti').doc();
        batch.set(ref, { ...record, portafoglio_nome: portafoglioNome, created_date: admin.firestore.FieldValue.serverTimestamp() });
        inserted++;
      });
      await batch.commit();
      await new Promise(r => setTimeout(r, 200));
    }
    return { ok: true, inserted };
  }
);

// ─── ping ─────────────────────────────────────────────────────────
exports.ping = onCall({ ...FN_CONFIG }, async () => ({ ok: true, ts: Date.now() }));

// ─── Mapping LOB → colonna specialist nel portafoglio ─────────────
const LOB_SPECIALIST_MAP = {
  'Cloud':       'acc_specialist_cloud_iot_5g',
  'IoT':         'acc_specialist_cloud_iot_5g',
  'Security':    'acc_specialist_sec',
  'Licensing':   'acc_specialist_lss',
  'Connettività': null,
  'Other IT':    null,
};

// ─── importPortafoglioFromStorage ─────────────────────────────────
// Legge file portafoglio da Storage, salva clienti con campi specialist
exports.importPortafoglioFromStorage = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { storagePath, portafoglio_nome } = request.data;
    if (!storagePath) throw new Error('storagePath obbligatorio');

    const bucket = getStorage().bucket();
    const [buffer] = await bucket.file(storagePath).download();
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    const str = v => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

    const records = rows.map(r => ({
      cf:                        str(r['CF']),
      cf_capogruppo:             str(r['CF CAPOGRUPPO']),
      ragione_sociale:           str(r['RAG_SOC']) || str(r['Capogruppo']) || 'N/D',
      capogruppo:                str(r['Capogruppo']),
      vertical_gruppo:           str(r['VERTICAL Gruppo']),
      segmento_26:               str(r['SEGMENTO CLIENTE 2026']),
      area_rac:                  str(r['AREA RAC']),
      rac:                       str(r['RAC']),
      area_mng:                  str(r['AREA MNG']),
      struttura_sales:           str(r['STRUTTURA SALES CORE']),
      area_rac_26:               str(r['AREA RAC 26']),
      rac_26:                    str(r['RAC 26']),
      area_mng_26:               str(r['AREA MNG 26']),
      struttura_sales_26:        str(r['STRUTTURA SALES CORE 26']),
      // Campi specialist
      area_am_spec:              str(r['AREA AM SPEC']),
      area_mng_spec:             str(r['AREA MNG SPEC']),
      acc_specialist_lss:        str(r['ACC SPECIALIST LSS']),
      acc_specialist_sec:        str(r['ACC SPECIALIST SEC']),
      acc_specialist_cloud_iot_5g: str(r['ACC SPECIALIST CLOUD/IoT/5G']),
      portafoglio_nome:          portafoglio_nome || 'Base',
    })).filter(r => r.ragione_sociale);

    // Cancella e reinserisci
    const pNome = portafoglio_nome || 'Base';
    let snap;
    do {
      snap = await db.collection('portafoglio_clienti')
        .where('portafoglio_nome', '==', pNome).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      await new Promise(r => setTimeout(r, 100));
    } while (!snap.empty);

    let inserted = 0;
    for (let i = 0; i < records.length; i += 400) {
      const batch = db.batch();
      records.slice(i, i + 400).forEach(rec => {
        const ref = db.collection('portafoglio_clienti').doc();
        batch.set(ref, { ...rec, created_date: admin.firestore.FieldValue.serverTimestamp() });
        inserted++;
      });
      await batch.commit();
      await new Promise(r => setTimeout(r, 200));
    }

    return { ok: true, inserted };
  }
);

// ─── enrichDealsWithSpecialist ─────────────────────────────────────
// Arricchisce i deal con i dati specialist dal portafoglio per LOB
exports.enrichDealsWithSpecialist = onCall(
  { ...FN_CONFIG, timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno } = request.data;
    if (!anno) throw new Error('anno obbligatorio');

    // Carica portafoglio clienti in memoria
    const ptfSnap = await db.collection('portafoglio_clienti').get();
    const ptfMap = {};
    ptfSnap.docs.forEach(d => {
      const data = d.data();
      const key = (data.ragione_sociale || '').toLowerCase().trim();
      const keyCap = (data.capogruppo || '').toLowerCase().trim();
      const keyCf = data.cf || '';
      if (key) ptfMap[key] = data;
      if (keyCap && !ptfMap[keyCap]) ptfMap[keyCap] = data;
      if (keyCf) ptfMap[`cf:${keyCf}`] = data;
    });

    // Processa i deal a pagine
    let offset = 0;
    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
      const snap = await db.collection('deals')
        .where('anno', '==', String(anno))
        .limit(400).offset(offset).get();

      if (snap.empty) break;
      hasMore = snap.docs.length === 400;
      offset += snap.docs.length;

      const batch = db.batch();
      snap.docs.forEach(d => {
        const deal = d.data();
        const lob = deal.lob || '';
        const specialistCol = LOB_SPECIALIST_MAP[lob]; // null se nessuno specialist

        // Trova cliente in portafoglio
        const nameKey = (deal.ragione_sociale_capogruppo || deal.ragione_sociale || '').toLowerCase().trim();
        const cfKey = deal.cf_capogruppo || deal.cf || '';
        const ptf = ptfMap[`cf:${cfKey}`] || ptfMap[nameKey] || null;

        const update = {
          area_am_spec: ptf?.area_am_spec || null,
          area_mng_spec: ptf?.area_mng_spec || null,
          specialist_lob: specialistCol && ptf ? (ptf[specialistCol] || null) : null,
          specialist_col: specialistCol || null, // quale colonna è stata usata
        };

        batch.update(d.ref, update);
        totalUpdated++;
      });

      await batch.commit();
      await new Promise(r => setTimeout(r, 100));
    }

    // Ricalcola aggregati
    await computeAndSaveAggregates(anno);

    return { success: true, updated: totalUpdated };
  }
);

// ─── listStorageVersions ───────────────────────────────────────────
// Lista tutti i file in una cartella Storage con metadati
exports.listStorageVersions = onCall(
  { ...FN_CONFIG, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { prefix } = request.data;
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: prefix || 'portafoglio/' });
    const result = await Promise.all(files.map(async f => ({
      name: f.name,
      path: f.name,
      size: parseInt(f.metadata.size || 0),
      updated: f.metadata.updated,
      basename: f.name.split('/').pop(),
    })));
    return { files: result.sort((a, b) => b.updated.localeCompare(a.updated)) };
  }
);
