import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { file_url, portafoglio_nome } = await req.json();
  if (!file_url) return Response.json({ error: 'file_url mancante' }, { status: 400 });

  const portafoglioNome = portafoglio_nome || 'IoT';

  const resp = await fetch(file_url);
  const arrayBuffer = await resp.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // Delete existing for this portafoglio in batches
  let offset = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.PortafoglioCliente.filter(
      { portafoglio_nome: portafoglioNome },
      null,
      500,
      offset
    );
    if (!batch || batch.length === 0) break;
    await Promise.all(batch.map(e => base44.asServiceRole.entities.PortafoglioCliente.delete(e.id)));
    if (batch.length < 500) break;
    offset += 500;
  }

  const str = v => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

  console.log(`DEBUG: raw rows=${rows.length}, sheetName="${sheetName}"`);
  
  const records = rows.map((r, idx) => {
    const record = {
      cf: str(r['CF']),
      cf_capogruppo: str(r['CF CAPOGRUPPO']),
      ragione_sociale: str(r['RAG_SOC']) || str(r['Capogruppo']) || 'N/D',
      capogruppo: str(r['Capogruppo']),
      vertical_gruppo: str(r['VERTICAL Gruppo']),
      segmento_26: str(r['SEGMENTO CLIENTE 2026']),
      area_rac: str(r['AREA RAC']),
      rac: str(r['RAC']),
      area_mng: str(r['AREA MNG']),
      struttura_sales: str(r['STRUTTURA SALES CORE']),
      area_rac_26: str(r['AREA RAC 26']),
      rac_26: str(r['RAC 26']),
      area_mng_26: str(r['AREA MNG 26']),
      struttura_sales_26: str(r['STRUTTURA SALES CORE 26']),
      portafoglio_nome: portafoglioNome,
    };
    if (!record.ragione_sociale) {
      console.log(`FILTER OUT row ${idx}: ragione_sociale is null`, Object.keys(r).slice(0, 5));
    }
    return record;
  }).filter(r => r.ragione_sociale);

  console.log(`DEBUG: after filter=${records.length}, portafoglio="${portafoglioNome}"`);

  const PAGE = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += PAGE) {
    const batch = records.slice(i, i + PAGE);
    console.log(`INSERT: batch ${i/PAGE + 1} with ${batch.length} records`);
    try {
      const result = await base44.asServiceRole.entities.PortafoglioCliente.bulkCreate(batch);
      console.log(`  Batch inserted successfully`, result);
      inserted += batch.length;
    } catch (e) {
      console.error(`  ERROR in batch:`, e.message);
      throw e;
    }
  }

  return Response.json({ ok: true, inserted, portafoglio_nome: portafoglioNome, totalRows: rows.length, afterFilter: records.length });
});