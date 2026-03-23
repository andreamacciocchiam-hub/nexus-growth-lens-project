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

  const { anno, offset = 0 } = await req.json().catch(() => ({}));

  // ← 50 invece di 200: ogni call finisce in ~3-4s
  const BATCH = 50;
  const filterQuery = anno ? { anno } : {};
  const batch = await base44.asServiceRole.entities.Deal.filter(filterQuery, null, BATCH, offset);

  const toUpdate = batch.filter(d => !VALID_LOB.includes(d.lob));

  // Gruppi da 5 in parallelo invece di sequenziale puro
  const PARALLEL = 5;
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += PARALLEL) {
    const group = toUpdate.slice(i, i + PARALLEL);
    await Promise.allSettled(group.map(deal => {
      const newLob = normalizeLob(
        deal.lob || '',
        deal.specialist || '',
        deal.descrizione || '',
        deal.tipo || 'CTR'
      );
      return base44.asServiceRole.entities.Deal.update(deal.id, { lob: newLob });
    }));
    updated += group.length;
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({
    success: true,
    updated,
    total: batch.length,
    hasMore: batch.length === BATCH,
  });
});