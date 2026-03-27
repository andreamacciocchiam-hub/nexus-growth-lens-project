import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
      raw.includes('network') || raw.includes('fibra') || raw.includes('banda') ||
      raw.includes('mpls') || raw.includes('sd-wan') || raw.includes('wan')) return 'Connettività';
  if (raw.includes('iot') || raw.includes('m2m') || raw.includes('sensori') ||
      raw.includes('telemetria') || raw.includes('smart metering')) return 'IoT';
  if (raw.includes('security') || raw.includes('sicurezza') || raw.includes('firewall') ||
      raw.includes('soc') || raw.includes('cyber') || raw.includes('antivirus') ||
      raw.includes('endpoint')) return 'Security';
  if (raw.includes('licens') || raw.includes('license') || raw.includes('microsoft') ||
      raw.includes('office') || raw.includes('software') ||
      raw.includes('abbonamento')) return 'Licensing';
  return 'Other IT';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const deals = body.deals;
  if (!deals?.length) return Response.json({ error: 'deals required' }, { status: 400 });

  const normalizedDeals = deals.map(d => ({
    ...d,
    lob: normalizeLob(
      d.lob_originale || d.lob || '',
      d.specialist || '',
      d.descrizione || '',
      d.tipo || 'CTR'
    ),
  }));

  const BATCH = 100;
  let inserted = 0;
  const errors = [];

  for (let i = 0; i < normalizedDeals.length; i += BATCH) {
    const chunk = normalizedDeals.slice(i, i + BATCH);
    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      attempts++;
      try {
        // ✅ Senza asServiceRole — è l'unico modo che funziona in Deno functions
        await base44.entities.Deal.bulkCreate(chunk);
        inserted += chunk.length;
        success = true;
      } catch (e) {
        if (attempts >= 3) {
          errors.push({ batch: Math.floor(i / BATCH), error: e.message });
        } else {
          await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }
    }

    // Pausa tra batch per non sovraccaricare Base44
    await new Promise(r => setTimeout(r, 300));
  }

  return Response.json({ success: true, inserted, errors });
});
