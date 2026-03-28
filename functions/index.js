const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
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

// ─── Aggregazione: calcola KPI per un anno e salva in Firestore ────
async function computeAndSaveAggregates(anno) {
  const snap = await db.collection('deals').where('anno', '==', String(anno)).get();
  const deals = snap.docs.map(d => d.data());

  const sum = (arr, f) => arr.reduce((s, d) => s + (d[f] || 0), 0);

  // KPI globali
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

  // Per area
  const byArea = {};
  deals.forEach(d => {
    const k = d.area_rac || 'N/D';
    if (!byArea[k]) byArea[k] = { area: k, serv: 0, canoni: 0, diff: 0, att: 0, dif: 0, n: 0 };
    byArea[k].serv += d.serv_i_anno || 0;
    byArea[k].canoni += d.canoni || 0;
    byArea[k].diff += d.differenziale_servizi || 0;
    if (d.attacco_difesa === 'Attacco') byArea[k].att += d.serv_i_anno || 0;
    else byArea[k].dif += d.serv_i_anno || 0;
    byArea[k].n++;
  });

  // Per LOB
  const byLob = {};
  deals.forEach(d => {
    const k = d.lob || 'N/D';
    if (!byLob[k]) byLob[k] = { lob: k, serv: 0, canoni: 0, n: 0 };
    byLob[k].serv += d.serv_i_anno || 0;
    byLob[k].canoni += d.canoni || 0;
    byLob[k].n++;
  });

  // Per RAC
  const byRac = {};
  deals.forEach(d => {
    const k = d.rac || 'N/D';
    if (!byRac[k]) byRac[k] = { rac: k, area: d.area_rac || '', serv: 0, n: 0 };
    byRac[k].serv += d.serv_i_anno || 0;
    byRac[k].n++;
  });

  // Per mese (trend mensile)
  const byMese = {};
  deals.forEach(d => {
    if (!d.mese || d.mese === 0) return;
    const k = String(d.mese);
    if (!byMese[k]) byMese[k] = { mese: d.mese, serv: 0, canoni: 0, diff: 0, n: 0 };
    byMese[k].serv += d.serv_i_anno || 0;
    byMese[k].canoni += d.canoni || 0;
    byMese[k].diff += d.differenziale_servizi || 0;
    byMese[k].n++;
  });

  // Top 50 clienti
  const clientMap = {};
  deals.forEach(d => {
    const k = d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/D';
    if (!clientMap[k]) clientMap[k] = { nome: k, area: d.area_rac || '', rac: d.rac || '', serv: 0, canoni: 0, diff: 0, att: 0, n: 0, lobs: {} };
    clientMap[k].serv += d.serv_i_anno || 0;
    clientMap[k].canoni += d.canoni || 0;
    clientMap[k].diff += d.differenziale_servizi || 0;
    if (d.attacco_difesa === 'Attacco') clientMap[k].att += d.serv_i_anno || 0;
    clientMap[k].n++;
    if (d.lob) clientMap[k].lobs[d.lob] = (clientMap[k].lobs[d.lob] || 0) + 1;
  });
  const topClienti = Object.values(clientMap)
    .sort((a, b) => b.serv - a.serv)
    .slice(0, 100)
    .map(c => ({ ...c, lobs: Object.keys(c.lobs).join(', ') }));

  // Salva in Firestore
  await db.collection('aggregati').doc(String(anno)).set({
    anno: String(anno),
    kpi,
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
      lob: normalizeLob(
        d.lob_originale || d.lob || '',
        d.specialist || '',
        d.descrizione || '',
        d.tipo || 'CTR'
      ),
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

    // Se è l'ultimo batch, ricalcola gli aggregati per questo anno
    if (isLast && anno) {
      await computeAndSaveAggregates(anno);
    }

    return { success: true, inserted };
  }
);

// ─── aggregateDeals: ricalcola manualmente gli aggregati ──────────
exports.aggregateDeals = onCall(
  { ...FN_CONFIG, timeoutSeconds: 540, memory: '512MiB' },
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

// ─── deleteChunk ───────────────────────────────────────────────────
exports.deleteChunk = onCall(
  { ...FN_CONFIG, timeoutSeconds: 540, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno } = request.data;
    if (!anno) throw new Error('anno richiesto');
    let deleted = 0;
    let snap;
    do {
      snap = await db.collection('deals').where('anno', '==', String(anno)).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.docs.length;
      await new Promise(r => setTimeout(r, 100));
    } while (!snap.empty);
    // Resetta aggregati per questo anno
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
      batch.update(d.ref, {
        lob: normalizeLob(data.lob_originale || data.lob || '', data.specialist || '', data.descrizione || '', data.tipo || 'CTR')
      });
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
    const CHUNK = 400;
    let inserted = 0;
    for (let i = 0; i < records.length; i += CHUNK) {
      const batch = db.batch();
      records.slice(i, i + CHUNK).forEach(record => {
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
