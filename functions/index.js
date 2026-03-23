const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.importDealsJSON = onCall(
  { region: 'europe-west1', timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { deals } = request.data;
    if (!Array.isArray(deals)) throw new Error('deals deve essere un array');
    const CHUNK = 400;
    let inserted = 0;
    for (let i = 0; i < deals.length; i += CHUNK) {
      const batch = db.batch();
      deals.slice(i, i + CHUNK).forEach(deal => {
        const ref = db.collection('deals').doc();
        batch.set(ref, { ...deal, created_date: admin.firestore.FieldValue.serverTimestamp() });
        inserted++;
      });
      await batch.commit();
    }
    return { success: true, inserted };
  }
);

exports.deleteChunk = onCall(
  { region: 'europe-west1', timeoutSeconds: 540, memory: '256MiB' },
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
    } while (!snap.empty);
    return { success: true, deleted };
  }
);

exports.enrichLob = onCall(
  { region: 'europe-west1', timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new Error('Non autenticato');
    const { anno, offset = 0 } = request.data;
    function normalizeLob(lob, specialist) {
      const raw = (lob || specialist || '').toLowerCase().trim();
      if (!raw) return 'Other IT';
      if (raw.includes('cloud') || raw.includes('aws') || raw.includes('azure')) return 'Cloud';
      if (raw.includes('connett') || raw.includes('fibra') || raw.includes('mpls')) return 'Connettività';
      if (raw.includes('iot') || raw.includes('m2m')) return 'IoT';
      if (raw.includes('security') || raw.includes('firewall') || raw.includes('cyber')) return 'Security';
      if (raw.includes('licens') || raw.includes('microsoft') || raw.includes('software')) return 'Licensing';
      return 'Other IT';
    }
    const snap = await db.collection('deals')
      .where('anno', '==', String(anno))
      .limit(500)
      .offset(offset)
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => {
      const data = d.data();
      batch.update(d.ref, { lob: normalizeLob(data.lob, data.specialist) });
    });
    await batch.commit();
    return { processed: snap.docs.length, hasMore: snap.docs.length === 500, nextOffset: offset + snap.docs.length };
  }
);

exports.ping = onCall({ region: 'europe-west1' }, async () => {
  return { ok: true, ts: Date.now() };
});