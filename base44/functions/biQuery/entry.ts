import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let portafoglio = body.portafoglio || null;
  
  // If empty string, treat as no filter
  if (portafoglio === '') portafoglio = null;

  // Fetch all deals with pagination to avoid limits
  let allDeals = [];
  let skip = 0;
  const BATCH = 5000;
  while (true) {
    const batch = await base44.asServiceRole.entities.Deal.filter({}, null, BATCH, skip);
    if (!batch || !Array.isArray(batch) || batch.length === 0) break;
    allDeals = allDeals.concat(batch);
    if (batch.length < BATCH) break;
    skip += BATCH;
  }

  if (portafoglio) {
    allDeals = allDeals.filter(d => d.portafoglio === portafoglio);
  }

  const byYearArea = {};
  const byYearAmbito = {};
  const byYearLob = {};
  const clientMap = {};

  for (const d of allDeals) {
    const anno = d.anno || 'N/A';
    const area = d.area_rac || 'N/A';
    const ambito = d.ambito || 'N/A';
    const lob = d.lob || 'N/A';
    const rc = d.ragione_sociale_capogruppo;
    const s = d.serv_i_anno || 0;
    const ad = d.attacco_difesa;
    
    // Skip records with no service revenue (but keep zero totals tracking)
    if (!s || s <= 0) continue;

    const aKey = `${anno}_${area}`;
    if (!byYearArea[aKey]) byYearArea[aKey] = { anno, area_rac: area, serv_i_anno: 0, canoni: 0, differenziale_servizi: 0, attacco: 0, difesa: 0, count: 0 };
    byYearArea[aKey].serv_i_anno += s;
    byYearArea[aKey].canoni += d.canoni || 0;
    byYearArea[aKey].differenziale_servizi += d.differenziale_servizi || 0;
    byYearArea[aKey].count += 1;
    if (ad === 'Attacco') byYearArea[aKey].attacco += s;
    else byYearArea[aKey].difesa += s;

    const amKey = `${anno}_${ambito}`;
    if (!byYearAmbito[amKey]) byYearAmbito[amKey] = { anno, ambito, serv_i_anno: 0 };
    byYearAmbito[amKey].serv_i_anno += s;

    const lKey = `${anno}_${lob}`;
    if (!byYearLob[lKey]) byYearLob[lKey] = { anno, lob, serv_i_anno: 0 };
    byYearLob[lKey].serv_i_anno += s;

    if (rc && rc.trim() !== '') {
      if (!clientMap[rc]) clientMap[rc] = { ragione_sociale_capogruppo: rc, '2025': 0, '2026': 0, areas: new Set(), n_deals: 0 };
      clientMap[rc][anno] = (clientMap[rc][anno] || 0) + s;
      if (area) clientMap[rc].areas.add(area);
      clientMap[rc].n_deals += 1;
    }
  }

  const topClients = Object.values(clientMap)
    .map(c => ({ ...c, areas: Array.from(c.areas), total: (c['2025'] || 0) + (c['2026'] || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  const deals2025 = allDeals.filter(d => d.anno === '2025' && d.serv_i_anno > 0);
  const deals2026 = allDeals.filter(d => d.anno === '2026' && d.serv_i_anno > 0);

  const ytd = {
    '2025': deals2025.reduce((s, d) => s + (d.serv_i_anno || 0), 0),
    '2026': deals2026.reduce((s, d) => s + (d.serv_i_anno || 0), 0),
    canoni_2025: deals2025.reduce((s, d) => s + (d.canoni || 0), 0),
    canoni_2026: deals2026.reduce((s, d) => s + (d.canoni || 0), 0),
    diff_2025: deals2025.reduce((s, d) => s + (d.differenziale_servizi || 0), 0),
    diff_2026: deals2026.reduce((s, d) => s + (d.differenziale_servizi || 0), 0),
  };

  return Response.json({
    byYearArea: Object.values(byYearArea),
    byYearAmbito: Object.values(byYearAmbito),
    byYearLob: Object.values(byYearLob),
    topClients,
    ytd,
    total_deals: allDeals.length,
    total_2025: deals2025.length,
    total_2026: deals2026.length,
  });
});