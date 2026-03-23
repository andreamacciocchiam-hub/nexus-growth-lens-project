import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.2';

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function parseStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const targetAnno = body.anno || '2026';
  const startRow = body.startRow || 0;
  const maxRows = body.maxRows || 1000; // ✅ era 100
  const portafoglio = body.portafoglio || 'Base';
  const fileUrl = body.fileUrl;
  const dataRiferimento = body.dataRiferimento || '';

  if (!fileUrl) return Response.json({ error: 'fileUrl required' }, { status: 400 });

  let resp;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      resp = await fetch(fileUrl);
      if (resp.ok) break;
    } catch (e) {
      if (attempt === 3) return Response.json({ error: `Failed to fetch file after 3 attempts: ${e.message}` }, { status: 500 });
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  if (!resp || !resp.ok) return Response.json({ error: 'Failed to fetch file' }, { status: 500 });

  const buffer = await resp.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const files = unzipSync(uint8);

  const sharedStringsXml = files['xl/sharedStrings.xml'];
  const sharedStrings = [];
  if (sharedStringsXml) {
    const xml = strFromU8(sharedStringsXml);
    const matches = xml.matchAll(/<si>[\s\S]*?<\/si>/g);
    for (const m of matches) {
      const texts = m[0].matchAll(/<t[^>]*>([^<]*)<\/t>/g);
      let str = '';
      for (const t of texts) str += t[1];
      sharedStrings.push(str
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    }
  }

  const wbXml = strFromU8(files['xl/workbook.xml']);
  const escapedName = `SELEZIONE &amp;amp; DETTAGLI ${targetAnno}`;
  const escapedName2 = `SELEZIONE &amp; DETTAGLI ${targetAnno}`;
  let sheetMatch = wbXml.match(new RegExp(`<sheet[^>]+name="${escapedName}"[^>]+r:id="([^"]+)"`));
  if (!sheetMatch) sheetMatch = wbXml.match(new RegExp(`<sheet[^>]+name="${escapedName2}"[^>]+r:id="([^"]+)"`));
  if (!sheetMatch) {
    sheetMatch = wbXml.match(/<sheet[^>]+r:id="([^"]+)"/);
    if (!sheetMatch) {
      const sm2 = wbXml.match(/<sheet[^>]+name="([^"]*)"[^>]+r:id="([^"]+)"/g);
      return Response.json({ error: 'Sheet not found', sheets: sm2 }, { status: 404 });
    }
  }
  const rId = sheetMatch[1];

  const relsXml = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const relMatch = relsXml.match(new RegExp(`Id="${rId}"[^>]+Target="([^"]+)"`));
  if (!relMatch) return Response.json({ error: 'Sheet rel not found' }, { status: 404 });
  const sheetPath = 'xl/' + relMatch[1].replace(/^\.\//, '');

  const sheetXmlRaw = files[sheetPath];
  if (!sheetXmlRaw) return Response.json({ error: `Sheet file not found: ${sheetPath}` }, { status: 404 });
  const sheetXml = strFromU8(sheetXmlRaw);

  const rowMatches = [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)];

  function getCellValue(attrs, inner) {
    if (!inner) return null;
    const t = (attrs.match(/\bt="([^"]*)"/)||[])[1];
    const v = (inner.match(/<v>([^<]*)<\/v>/)||[])[1];
    if (v === undefined || v === null || v === '') return null;
    if (t === 's') {
      const idx = parseInt(v);
      return sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
    }
    if (t === 'str' || t === 'inlineStr') return v;
    if (t === 'b') return v === '1';
    return parseFloat(v);
  }

  function colToIdx(colStr) {
    let n = 0;
    for (const c of colStr) n = n * 26 + c.charCodeAt(0) - 64;
    return n - 1;
  }

  function parseRow(rowXml) {
    if (!rowXml) return [];
    const cells = [...rowXml.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)];
    const arr = [];
    for (const [, attrs, inner] of cells) {
      const colMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      if (!colMatch) continue;
      const idx = colToIdx(colMatch[1]);
      arr[idx] = getCellValue(attrs, inner || '');
    }
    return arr;
  }

  let headerArr = null;
  let headerRowNum = 0;
  const dataRows = [];

  for (const [, rowNumStr, rowInner] of rowMatches) {
    const rowNum = parseInt(rowNumStr);
    const arr = parseRow(rowInner);
    if (!headerArr && arr.some(c => c !== null && c !== undefined && String(c).trim() === 'ID SDW')) {
      headerArr = arr.map(h => h ? String(h).trim() : '');
      headerRowNum = rowNum;
      continue;
    }
    if (headerArr) {
      dataRows.push({ rowNum, arr });
    }
  }

  if (!headerArr) {
    return Response.json({ error: 'Header row not found', rowMatches: rowMatches.length }, { status: 400 });
  }

  const findCol = (...names) => headerArr.findIndex(h => h && names.some(n => h.toLowerCase().includes(n.toLowerCase())));
  const C = {
    id:      headerArr.indexOf('ID SDW'),
    capogruppo: findCol('Ragione Sociale Capogruppo'),
    rs:      headerArr.findIndex(h => h === 'Ragione Sociale'),
    desc:    headerArr.indexOf('Descrizione'),
    areaRac: findCol('NEW AREA RAC', 'AREA RAC'),
    rac:     headerArr.indexOf('RAC'),
    newAreaRac: findCol('NEW AREA RAC'),
    newArea: headerArr.indexOf('NEW AREA'),
    areaMng: findCol('AREA MNG'),
    strutturaSales: findCol('STRUTTURA SALES'),
    strutturaSDW: findCol('STRUTTURA SDW'),
    ad:      findCol('Attacco/Difesa', 'Attacco / Difesa', 'A/D'),
    ambito:  findCol('NEW Ambito', 'Ambito'),
    newAmbito: findCol('NEW Ambito'),
    lob:     findCol('LOB'),
    specialist: headerArr.indexOf('SPECIALIST'),
    specialistNoDouble: findCol('SPECIALIST no Double'),
    mese:    headerArr.indexOf('Mese'),
    durata:  headerArr.indexOf('Durata'),
    newEntry: headerArr.indexOf('New ENTRY'),
    tipo:    headerArr.findIndex(h => h && /^tipo$/i.test(h.trim())),
    codice:  findCol('Codice Progetto', 'Codice'),
    fornitore: findCol('Fornitore'),
    totCtr:  findCol('tot ctr'),
    ricIAnno: findCol('ric I anno'),
    serviziTot: findCol('Servizi Totali'),
    servIAnno: findCol('serv I anno'),
    canoni:  findCol('Canoni', 'di cui Can'),
    ar:      findCol('A/R'),
    ut:      findCol('di cui UT'),
    diffServ: findCol('Differenziale Servizi'),
    vendita:  headerArr.indexOf('vendita'),
  };

  const batch = dataRows.slice(startRow, startRow + maxRows);
  const deals = [];
  let skipped = 0;
  for (const { rowNum, arr } of batch) {
    const id = arr[C.id];
    if (!id || !String(id).startsWith('OP-')) {
      skipped++;
      continue;
    }
    const mese = parseNum(arr[C.mese]);
    const tipo = mese === 0 ? 'TTV' : 'CTR';
    const lobRaw = parseStr(arr[C.lob]);
    const lobVal = lobRaw && !isNaN(Number(lobRaw)) ? '' : lobRaw;
    const ambitoRaw = parseStr(arr[C.ambito]);
    const ambitoVal = ambitoRaw && !isNaN(Number(ambitoRaw)) ? '' : ambitoRaw;

    deals.push({
      portafoglio,
      anno: targetAnno,
      tipo,
      data_riferimento: dataRiferimento,
      id_sdw:                    parseStr(arr[C.id]),
      ragione_sociale_capogruppo: parseStr(arr[C.capogruppo]),
      ragione_sociale:            parseStr(arr[C.rs]),
      descrizione:                parseStr(arr[C.desc]),
      area_rac:                   parseStr(arr[C.areaRac]),
      rac:                        parseStr(arr[C.rac]),
      new_area_rac:               parseStr(arr[C.newAreaRac]),
      new_area:                   parseStr(arr[C.newArea]),
      area_mng:                   parseStr(arr[C.areaMng]),
      struttura_sales:            parseStr(arr[C.strutturaSales]),
      struttura_sdw:              parseStr(arr[C.strutturaSDW]),
      attacco_difesa:             (() => { const v = parseStr(arr[C.ad]).toLowerCase(); if (v === 'attacco') return 'Attacco'; if (v === 'difesa') return 'Difesa'; return parseStr(arr[C.ad]); })(),
      ambito:                     ambitoVal,
      new_ambito:                 parseStr(arr[C.newAmbito]),
      lob:                        lobVal,
      specialist:                 parseStr(arr[C.specialist]),
      specialist_no_double:       parseStr(arr[C.specialistNoDouble]),
      mese:                       parseNum(arr[C.mese]),
      durata:                     parseNum(arr[C.durata]),
      new_entry:                  arr[C.newEntry] ? true : false,
      codice_progetto:            parseStr(arr[C.codice]),
      fornitore:                  parseStr(arr[C.fornitore]),
      tot_ctr:                    parseNum(arr[C.totCtr]),
      ric_i_anno:                 parseNum(arr[C.ricIAnno]),
      servizi_totali:             parseNum(arr[C.serviziTot]),
      serv_i_anno:                parseNum(arr[C.servIAnno]),
      canoni:                     parseNum(arr[C.canoni]),
      ar:                         parseNum(arr[C.ar]),
      ut:                         parseNum(arr[C.ut]),
      differenziale_servizi:      parseNum(arr[C.diffServ]),
      vendita:                    parseNum(arr[C.vendita]),
    });
  }

  if (deals.length > 0) {
    const BATCH = 500;
    const chunks = [];
    for (let i = 0; i < deals.length; i += BATCH) {
      chunks.push(deals.slice(i, i + BATCH));
    }
    
    // Inserisci max 3 batch in parallelo con retry
    for (let i = 0; i < chunks.length; i += 3) {
      const parallel = chunks.slice(i, i + 3);
      let retry = 0;
      let success = false;
      
      while (!success && retry < 3) {
        const results = await Promise.allSettled(
          parallel.map(batchData => base44.asServiceRole.entities.Deal.bulkCreate(batchData))
        );
        const failed = results.filter(r => r.status === 'rejected');
        
        if (failed.length > 0) {
          retry++;
          console.warn(`Batch round ${Math.floor(i/3)+1} failed, retry ${retry}/3 in 2s...`);
          if (retry < 3) await new Promise(r => setTimeout(r, 2000));
        } else {
          success = true;
        }
      }
      
      if (!success) throw new Error(`Batch round ${Math.floor(i/3)+1} failed after 3 retries`);
    }
    console.log(`SUCCESS: Inserted ${deals.length} deals in ${Math.ceil(chunks.length / 3)} rounds`);
  }

  const totalDataRows = dataRows.filter(r => {
    const id = r.arr[C.id];
    return id && String(id).startsWith('OP-');
  }).length;

  return Response.json({
    success: true,
    anno: targetAnno,
    portafoglio,
    inserted: deals.length,
    skipped,
    batchSize: batch.length,
    startRow,
    nextStartRow: batch.length === maxRows ? startRow + maxRows : null,
    totalDataRows,
    columnMapping: C,
    debugFirstDeal: deals.length > 0 ? deals[0] : null,
    debugHeaderDetected: headerArr.slice(0, 10),
  });
});