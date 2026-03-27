const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// ✅ Configurazione comune: CORS aperto + invoker pubblico
const FN_CONFIG = {
  region: 'europe-west1',
  cors: true,          // ← fix CORS
  invoker: 'public',   // ← consente chiamate da browser autenticati
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

// ─── importDealsJSON ───────────────────────────────────────────────
exports.importDealsJSON = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { deals } = request.data;
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

    return { success: true, inserted };
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
      snap = await db.collection('deals')
        .where('anno', '==', String(anno))
        .limit(400)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.docs.length;
      await new Promise(r => setTimeout(r, 100));
    } while (!snap.empty);
    return { success: true, deleted };
  }
);

// ─── enrichLob ────────────────────────────────────────────────────
exports.enrichLob = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno, offset = 0 } = request.data;
    const snap = await db.collection('deals')
      .where('anno', '==', String(anno))
      .limit(500)
      .offset(offset)
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => {
      const data = d.data();
      batch.update(d.ref, {
        lob: normalizeLob(
          data.lob_originale || data.lob || '',
          data.specialist || '',
          data.descrizione || '',
          data.tipo || 'CTR'
        )
      });
    });
    await batch.commit();
    return {
      processed: snap.docs.length,
      hasMore: snap.docs.length === 500,
      nextOffset: offset + snap.docs.length
    };
  }
);

// ─── ping ─────────────────────────────────────────────────────────
exports.ping = onCall(
  { ...FN_CONFIG },
  async () => ({ ok: true, ts: Date.now() })
);

// ─── importPortafoglioClienti ──────────────────────────────────────
exports.importPortafoglioClienti = onCall(
  { ...FN_CONFIG, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { file_url, portafoglio_nome } = request.data;
    if (!file_url) throw new Error('file_url mancante');

    const portafoglioNome = portafoglio_nome || 'Base';

    // 1. Scarica il file Excel da Firebase Storage
    const fetch = (await import('node-fetch')).default;
    const resp = await fetch(file_url);
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Parse Excel con xlsx
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const str = v => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

    const records = rows.map(r => ({
      cf:                str(r['CF']),
      cf_capogruppo:     str(r['CF CAPOGRUPPO']),
      ragione_sociale:   str(r['RAG_SOC']) || str(r['Capogruppo']) || 'N/D',
      capogruppo:        str(r['Capogruppo']),
      vertical_gruppo:   str(r['VERTICAL Gruppo']),
      segmento_26:       str(r['SEGMENTO CLIENTE 2026']),
      area_rac:          str(r['AREA RAC']),
      rac:               str(r['RAC']),
      area_mng:          str(r['AREA MNG']),
      struttura_sales:   str(r['STRUTTURA SALES CORE']),
      area_rac_26:       str(r['AREA RAC 26']),
      rac_26:            str(r['RAC 26']),
      area_mng_26:       str(r['AREA MNG 26']),
      struttura_sales_26: str(r['STRUTTURA SALES CORE 26']),
      portafoglio_nome:  portafoglioNome,
    })).filter(r => r.ragione_sociale);

    // 3. Cancella i record esistenti per questo portafoglio
    let deleted = 0;
    let snap;
    do {
      snap = await db.collection('portafoglio_clienti')
        .where('portafoglio_nome', '==', portafoglioNome)
        .limit(400)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.docs.length;
      await new Promise(r => setTimeout(r, 100));
    } while (!snap.empty);

    // 4. Inserisci nuovi record
    const CHUNK = 400;
    let inserted = 0;
    for (let i = 0; i < records.length; i += CHUNK) {
      const batch = db.batch();
      records.slice(i, i + CHUNK).forEach(record => {
        const ref = db.collection('portafoglio_clienti').doc();
        batch.set(ref, { ...record, created_date: admin.firestore.FieldValue.serverTimestamp() });
        inserted++;
      });
      await batch.commit();
      await new Promise(r => setTimeout(r, 200));
    }

    return { ok: true, inserted, deleted, portafoglio_nome: portafoglioNome };
  }
);
