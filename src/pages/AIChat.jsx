import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Bot, User, Sparkles, Database, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTED_QUESTIONS = [
  "RAC Albini contratti IoT 2026",
  "Top 5 clienti per portafoglio 2026",
  "Confronto attacco vs difesa 2026",
  "Portafoglio area MNO 2025 vs 2026",
  "Clienti con differenziale positivo piu alto",
  "Canoni LOB Connettivita 2026",
];

// ─── KEYWORD TOKENS ────────────────────────────────────────────────────────────
// Parole che NON fanno parte di un nome proprio
const RESERVED = [
  'contratti','contratto','ctr','trattative','trattativa','ttr','pipeline',
  'portafoglio','canoni','canone','lob','anno','attacco','difesa','new','business',
  'iot','cloud','voice','sicurezza','connettivita','connettività','broadband',
  'top','clienti','cliente','fatturato','differenziale','area','servizi','rinnovi',
  'firmati','attivi','nuovi','esistenti','retention','opportunita',
  'mno','sno','lno','mne','sne','lne','mcs','slce','slcs','ic','rac',
  '2025','2026',
];
const RESERVED_SET = new Set(RESERVED);

function isKeyword(word) {
  return RESERVED_SET.has(word.toLowerCase());
}

// ─── PARSER: estrae token dalla query in ordine ────────────────────────────────
function parseQuery(text) {
  const result = {
    rac: null,
    clientName: null,
    year: null,
    lob: null,
    area: null,
    attackDefense: null,
    docType: null,   // 'CTR' | 'TTR' | null
    areaMng: null,   // campo area_mng nel DB
    yoy: false,       // confronto 2025 vs 2026
    isTopQuery: false,
    topN: 10,
  };

  const t = text.toLowerCase();

  // Anno
  const yearM = text.match(/\b(2025|2026)\b/);
  if (yearM) result.year = yearM[1];

  // Top N
  const topM = text.match(/\btop\s*(\d+)/i);
  if (topM) { result.isTopQuery = true; result.topN = parseInt(topM[1]); }
  if (/\bclassifica\b|\bmigliori\b|\branking\b/i.test(text)) result.isTopQuery = true;

  // Attacco/Difesa
  if (/\battacco\b|new\s*business|\bnuovi\s*clienti\b/i.test(t)) result.attackDefense = 'Attacco';
  else if (/\bdifesa\b|\brinnov|\bretention\b|\besistenti\b/i.test(t)) result.attackDefense = 'Difesa';

  // tipo_documento: 'CTR' o 'TTR'
  if (/\bcontratt[oi]?\b|\bctr\b|\bfirmati\b|\battivi\b/i.test(t)) result.docType = 'CTR';
  else if (/\btrattativ\w*\b|\bttr\b|\bpipeline\b|\bopportunit\w*\b/i.test(t)) result.docType = 'TTR';

  // LOB
  if (/\biot\b|\binternet.{0,5}cose\b/i.test(t)) result.lob = 'IoT';
  else if (/\bconnett|\bbroadband\b/i.test(t)) result.lob = 'Connettività';
  else if (/\bcloud\b/i.test(t)) result.lob = 'Cloud';
  else if (/\bsicur|\bsecurity\b/i.test(t)) result.lob = 'Sicurezza';
  else if (/\bvoice\b|\bvoce\b|\btelefon/i.test(t)) result.lob = 'Voice';

  // Area
  const AREAS = ['SLCE','SLCS','MNO','SNO','LNO','MNE','SNE','LNE','MCS','IC'];
  for (const a of AREAS) {
    if (new RegExp('\\b' + a + '\\b', 'i').test(text)) { result.area = a; break; }
  }

  // Area MNG: parola/e dopo "area mng" che non siano keyword
  const areaMngM = text.match(/\barea\s*mng\s+(.+?)(?=\s+(?:iot|cloud|voice|sicurezza|connettivit|contratt|trattativ|ctr|ttr|portafoglio|canoni?|lob|anno|2025|2026|attacco|difesa|area|mno|sno|lno|mne|sne|lne|mcs|slce|slcs|top|differenz|confronto|delta|variaz|$)|\s*$)/i);
  if (areaMngM) {
    const words = areaMngM[1].trim().split(/\s+/).filter(w => !isKeyword(w));
    if (words.length > 0) result.areaMng = words.join(' ');
  }

  // YoY: "differenza/confronto/delta 2025 2026" o viceversa
  if (/\bdiffer[ae]|\bconfronts|\bdelta|\bvariaz/i.test(t) && /2025/.test(t) && /2026/.test(t)) {
    result.yoy = true;
    result.year = null; // niente filtro su anno, prendiamo entrambi
  }

  // RAC: parola/e dopo "RAC " che non siano keyword
  const racM = text.match(/\bRAC\s+(.+?)(?:\s+(?:contratt[oi]?|trattativ\w*|ctr|ttr|portafoglio|canoni?|lob|anno|2025|2026|attacco|difesa|iot|cloud|voice|sicurezza|connettivit|area|mno|sno|lno|mne|sne|lne|mcs|slce|slcs|top\s*\d|$))/i);
  if (racM) {
    result.rac = racM[1].trim();
  } else {
    // fallback: prende tutto dopo RAC fino a fine stringa
    const racFallback = text.match(/\bRAC\s+([A-Za-z\u00C0-\u017E'&]+(?:\s+[A-Za-z\u00C0-\u017E'&]+)*)/i);
    if (racFallback) {
      const words = racFallback[1].trim().split(/\s+/).filter(w => !isKeyword(w));
      if (words.length > 0) result.rac = words.join(' ');
    }
  }

  // Cliente libero (solo se non c'è RAC)
  if (!result.rac) {
    const cleaned = text
      .replace(/\b(contratt[oi]?|trattativ\w*|portafoglio|canoni?|lob|anno|2025|2026|attacco|difesa|iot|cloud|voice|sicurezza|connettivit\w*|top\s*\d*|clienti?|fatturato|differenziale|area|mno|sno|lno|mne|sne|lne|mcs|slce|slcs|ic|new|business|firmati|attivi|rinnov\w*|retention|pipeline|ctr|ttr)\b/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ').filter(w => w.length >= 3 && !isKeyword(w) && !/^\d+$/.test(w));
    if (words.length > 0) result.clientName = words.join(' ');
  }

  return result;
}

// ─── FILTER ────────────────────────────────────────────────────────────────────
function filterDeals(allDeals, q) {
  return allDeals.filter(d => {
    if (q.year && String(d.anno) !== String(q.year)) return false;
    if (q.area && d.area_rac !== q.area) return false;
    if (q.attackDefense && d.attacco_difesa !== q.attackDefense) return false;
    if (q.lob && !String(d.lob || '').toLowerCase().trim().includes(q.lob.toLowerCase().trim())) return false;

    // tipo: CTR o TTR — campo reale nel DB
    if (q.docType) {
      if (String(d.tipo || d.tipo_documento || '').toUpperCase().trim() !== q.docType.trim()) return false;
    }

    // RAC: cerca nel campo rac del DB
    if (q.rac) {
      const racVal = String(d.RAC || d.rac || '').toLowerCase();
      const words = q.rac.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      if (words.length > 0 && !words.some(w => racVal.includes(w))) return false;
    }

    // Area MNG
    if (q.areaMng) {
      const mngVal = String(d.area_mng || '').toLowerCase();
      const words = q.areaMng.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      if (words.length > 0 && !words.some(w => mngVal.includes(w))) return false;
    }

    // Cliente libero
    if (q.clientName) {
      const name = String(d.ragione_sociale_capogruppo || d.ragione_sociale || '').toLowerCase();
      const words = q.clientName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      if (words.length > 0 && !words.some(w => name.includes(w))) return false;
    }

    return true;
  });
}

// ─── BUILD DATA CONTEXT ────────────────────────────────────────────────────────
function buildDataContext(allDeals, userText) {
  const q = parseQuery(userText);
  const filtered = filterDeals(allDeals, q);

  let dataBlock = '';

  // DEBUG — rimuovi dopo il test
  if (typeof window !== 'undefined') {
    const byFilter = {
      'Solo RAC': filterDeals(allDeals, {...q, lob:null, docType:null, year:null}).length,
      'Solo anno': filterDeals(allDeals, {...q, rac:null, lob:null, docType:null}).length,
      'Solo LOB': filterDeals(allDeals, {...q, rac:null, docType:null, year:null}).length,
      'Solo CTR': filterDeals(allDeals, {...q, rac:null, lob:null, year:null}).length,
      'RAC+anno': filterDeals(allDeals, {...q, lob:null, docType:null}).length,
      'RAC+anno+LOB': filterDeals(allDeals, {...q, docType:null}).length,
      'TUTTI': filtered.length,
    };
    console.table(byFilter);
    const sample = allDeals.find(d => String(d.RAC||'').toLowerCase().includes('albini') && String(d.lob||'').toLowerCase().includes('iot'));
    if (sample) console.log('SAMPLE:', {RAC: sample.RAC, lob: sample.lob, anno: sample.anno, tipo_documento: sample.tipo_documento, annoType: typeof sample.anno});
  }

  // Nessun risultato
  if (filtered.length === 0 && (q.rac || q.clientName || q.lob || q.docType || q.areaMng)) {
    dataBlock = '[DATI DATABASE]\nNessun record trovato con filtri: ' + JSON.stringify(q) + '\n';

    if (q.rac) {
      const allRacs = [...new Set(allDeals.map(d => d.RAC || d.rac).filter(Boolean))];
      const words = q.rac.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      const similar = allRacs.filter(r => words.some(w => String(r).toLowerCase().includes(w)));
      dataBlock += similar.length > 0
        ? 'RAC simili nel DB: ' + similar.slice(0, 8).join(' | ') + '\n'
        : 'Nessun RAC simile a "' + q.rac + '". Campi disponibili: ' + Object.keys(allDeals[0] || {}).join(', ') + '\n';
    }
    if (q.clientName) {
      const allNames = [...new Set(allDeals.map(d => d.ragione_sociale_capogruppo).filter(Boolean))];
      const words = q.clientName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      const similar = allNames.filter(n => words.some(w => n.toLowerCase().includes(w)));
      if (similar.length > 0) dataBlock += 'Clienti simili: ' + similar.slice(0, 8).join(' | ') + '\n';
    }
    return { dataBlock, q, count: 0 };
  }

  // YoY comparison (differenza 2025 vs 2026)
  if (q.yoy) {
    const f25 = filterDeals(allDeals, { ...q, year: '2025', yoy: false });
    const f26 = filterDeals(allDeals, { ...q, year: '2026', yoy: false });
    const sum = (arr, field) => arr.reduce((s, d) => s + (d[field] || 0), 0);
    const s25 = sum(f25, 'serv_i_anno'), s26 = sum(f26, 'serv_i_anno');
    const c25 = sum(f25, 'canoni'), c26 = sum(f26, 'canoni');
    const filters = [q.areaMng && 'area_mng:"' + q.areaMng + '"', q.lob && 'LOB:' + q.lob, q.rac && 'RAC:' + q.rac, q.docType && 'doc:' + q.docType].filter(Boolean).join(' | ');
    dataBlock = '[DATI DATABASE - Confronto YoY · ' + filters + ']\n';
    dataBlock += 'Anno | Serv.Anno | Canoni | N.Record\n';
    dataBlock += '2025 | ' + s25.toLocaleString('it-IT') + ' | ' + c25.toLocaleString('it-IT') + ' | ' + f25.length + '\n';
    dataBlock += '2026 | ' + s26.toLocaleString('it-IT') + ' | ' + c26.toLocaleString('it-IT') + ' | ' + f26.length + '\n';
    dataBlock += 'DELTA | ' + (s26 - s25).toLocaleString('it-IT') + ' | ' + (c26 - c25).toLocaleString('it-IT') + ' | ' + (f26.length - f25.length) + '\n';
    dataBlock += 'VAR% | ' + (s25 > 0 ? ((s26-s25)/s25*100).toFixed(1) + '%' : 'N/A') + '\n';
    return { dataBlock, q, count: f25.length + f26.length };
  }

  // Top N
  if (q.isTopQuery || (!q.rac && !q.clientName && !q.lob && !q.area && !q.attackDefense && !q.docType)) {
    const source = filtered.length > 0 ? filtered : allDeals;
    const byClient = {};
    for (const d of source) {
      if (!(d.serv_i_anno > 0)) continue;
      const key = d.ragione_sociale_capogruppo || 'N/A';
      if (!byClient[key]) byClient[key] = { nome: key, area: d.area_rac, totale: 0, canoni: 0 };
      byClient[key].totale += d.serv_i_anno;
      byClient[key].canoni += d.canoni || 0;
    }
    const top = Object.values(byClient).sort((a, b) => b.totale - a.totale).slice(0, q.topN);
    const desc = [q.year && 'anno:' + q.year, q.lob && 'LOB:' + q.lob, q.area && 'area:' + q.area, q.docType && 'doc:' + q.docType].filter(Boolean).join(' ');
    dataBlock = '[DATI DATABASE - Top ' + q.topN + ' clienti' + (desc ? ' · ' + desc : '') + ']\n';
    dataBlock += top.map((c, i) => (i + 1) + '. ' + c.nome + ' | Area:' + c.area + ' | Servizi:' + c.totale.toLocaleString('it-IT') + ' | Canoni:' + c.canoni.toLocaleString('it-IT')).join('\n');
    return { dataBlock, q, count: top.length };
  }

  // Aggregato + dettaglio
  const byClient = {};
  for (const d of filtered) {
    const key = d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/A';
    if (!byClient[key]) byClient[key] = {
      nome: key, area: d.area_rac, anno: d.anno,
      rac: d.RAC || d.rac || '',
      areaMng: d.area_mng || '',
      serv: 0, canoni: 0, diff: 0, ar: 0, ut: 0, vendita: 0, tot_ctr: 0,
      lobs: new Set(), tipi: new Set(), docs: new Set(), n: 0
    };
    byClient[key].serv += d.serv_i_anno || 0;
    byClient[key].canoni += d.canoni || 0;
    byClient[key].diff += d.differenziale_servizi || 0;
    byClient[key].ar += d.ar || 0;
    byClient[key].ut += d.ut || 0;
    byClient[key].vendita += d.vendita || 0;
    byClient[key].tot_ctr += d.tot_ctr || 0;
    if (d.lob) byClient[key].lobs.add(d.lob);
    if (d.tipo_ctr) byClient[key].tipi.add(d.tipo_ctr);
    if (d.tipo || d.tipo_documento) byClient[key].docs.add(d.tipo || d.tipo_documento);
    byClient[key].n += 1;
  }

  const desc = [
    q.rac && 'RAC:"' + q.rac + '"',
    q.areaMng && 'area_mng:"' + q.areaMng + '"',
    q.clientName && 'cliente:"' + q.clientName + '"',
    q.year && 'anno:' + q.year,
    q.lob && 'LOB:' + q.lob,
    q.area && 'area:' + q.area,
    q.docType && 'tipo_documento:' + q.docType + (q.docType === 'CTR' ? ' (CONTRATTI firmati)' : ' (TRATTATIVE/pipeline)'),
    q.attackDefense && 'tipo:' + q.attackDefense,
  ].filter(Boolean).join(' | ');

  dataBlock = '[DATI DATABASE · ' + desc + ' · ' + filtered.length + ' record]\n';
  dataBlock += 'RIEPILOGO PER CLIENTE:\n';
  dataBlock += Object.values(byClient).sort((a, b) => b.serv - a.serv).map(r =>
    'Cliente: ' + r.nome + ' | RAC: ' + (r.rac || 'N/A') + ' | Area: ' + r.area +
    ' | Anno: ' + r.anno + ' | Serv: ' + r.serv.toLocaleString('it-IT') +
    ' | Canoni: ' + r.canoni.toLocaleString('it-IT') +
    ' | Diff: ' + r.diff.toLocaleString('it-IT') +
    ' | AR: ' + r.ar.toLocaleString('it-IT') +
    ' | UT: ' + r.ut.toLocaleString('it-IT') +
    ' | Vendita: ' + r.vendita.toLocaleString('it-IT') +
    ' | TotCTR: ' + r.tot_ctr.toLocaleString('it-IT') +
    ' | LOB: ' + [...r.lobs].join('/') +
    ' | TipoDoc: ' + [...r.docs].join('/') +
    ' | TipoCTR: ' + [...r.tipi].join('/') +
    ' | N: ' + r.n
  ).join('\n');

  // Righe singole per query di dettaglio (RAC o cliente specifico, <=20 record)
  if (filtered.length <= 20 && (q.rac || q.clientName)) {
    dataBlock += '\n\nDETTAGLIO SINGOLI CONTRATTI:\n';
    dataBlock += filtered.map(d =>
      'Cliente: ' + (d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/A') +
      ' | ID: ' + (d.id_opportunita || d.id || '') +
      ' | Descr: ' + (d.descrizione || d.nome || '') +
      ' | AttDif: ' + (d.attacco_difesa || '') +
      ' | TipoDoc: ' + (d.tipo || d.tipo_documento || '') +
      ' | TipoCTR: ' + (d.tipo_ctr || '') +
      ' | TotCTR: ' + (d.tot_ctr || 0).toLocaleString('it-IT') +
      ' | Serv1Anno: ' + (d.serv_i_anno || 0).toLocaleString('it-IT') +
      ' | Canoni: ' + (d.canoni || 0).toLocaleString('it-IT') +
      ' | AR: ' + (d.ar || 0).toLocaleString('it-IT') +
      ' | UT: ' + (d.ut || 0).toLocaleString('it-IT') +
      ' | Diff: ' + (d.differenziale_servizi || 0).toLocaleString('it-IT') +
      ' | Vendita: ' + (d.vendita || 0).toLocaleString('it-IT')
    ).join('\n');
  }

  return { dataBlock, q, count: filtered.length };
}

// ─── LOADER PARALLELO ──────────────────────────────────────────────────────────
async function loadEntityAll(entity, batchSize = 5000) {
  const first = await entity.list(null, batchSize, 0);
  if (!first || first.length === 0) return [];
  if (first.length < batchSize) return first;
  const pages = await Promise.all([1, 2, 3, 4].map(i => entity.list(null, batchSize, i * batchSize)));
  let all = [...first];
  for (const page of pages) {
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < batchSize) break;
  }
  return all;
}

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
const ANALYST_PROMPT = `Sei un assistente BI per un'azienda Telco italiana.
Ad ogni messaggio ricevi i dati gia filtrati nel blocco [DATI DATABASE]. Il tuo unico compito e' analizzarli.

SCHEMA DEL DATABASE (campi reali):
- tipo_documento: 'CTR' = contratti firmati, 'TTR' = trattative/pipeline
- attacco_difesa: 'Attacco' = nuovi clienti, 'Difesa' = rinnovi
- lob: Line of Business (IoT, Cloud, Connettivita, Sicurezza, Voice...)
- area_rac: area commerciale (MNO, SNO, LNO, MNE, SNE, LNE, MCS, SLCE, SLCS, IC)
- area_mng: area manager (es. 'Carrozza') — diverso da area_rac
- rac / nome_rac: nome del responsabile commerciale (RAC)
- serv_i_anno: valore servizi primo anno (= portafoglio)
- canoni: canone annuo ricorrente
- differenziale_servizi: variazione vs anno precedente
- ragione_sociale_capogruppo: nome cliente (capogruppo)
- anno: '2025' o '2026'

REGOLE RISPOSTA — SEGUI SEMPRE QUESTE PRIORITA':

STRUTTURA RISPOSTA OBBLIGATORIA:

**STEP 1 — TABELLA KPI**
Il titolo della risposta DEVE rispecchiare ESATTAMENTE i filtri nel blocco [DATI DATABASE]:
- Se tipo_documento contiene "CTR" → scrivi "Contratti" NON "Trattative"
- Se tipo_documento contiene "TTR" → scrivi "Trattative"
- Se attacco_difesa = "Difesa" → scrivi "Difesa (rinnovi)"
- Se attacco_difesa = "Attacco" → scrivi "Attacco (nuovi clienti)"
MAI usare "Trattative" se il filtro dice CTR (contratti firmati).

Mostra SEMPRE una tabella markdown con i totali aggregati. Colonne SOLO se il valore > 0:
| KPI | Valore |
|-----|--------|
| Contratti | N |
| Serv. Anno | X,XM |
| Canoni | X,XK |
| Differenziale | X,XK |
| Vendita | X,XK |
| AR | X,XK |
| UT | X,XK |
Valori sempre in K/M. MAI numeri interi lunghi.

**STEP 2 — TABELLA CLIENTI** (solo se ci sono piu clienti distinti)
- Se <= 10 clienti: tabella markdown | Cliente | N | Serv.Anno | Canoni | Diff | — ometti colonne tutte a 0
- Se > 10 clienti: scrivi "Trovati X clienti. Per il dettaglio completo vai su **Dati Dettaglio**." e mostra solo top 5 per Serv.Anno

**STEP 3 — DESCRIZIONE**
2-3 righe di commento: cosa emerge dai dati, trend principale, eventuali anomalie.

**STEP 4 — APPROFONDIMENTO**
Una sola riga: suggerisci un filtro o analisi utile come follow-up.

ALTRE REGOLE:
- MAI mostrare righe singole a meno che l'utente chieda "dettaglio contratti" o "lista contratti"
- Se [DATI DATABASE] segnala "RAC simili" o "clienti simili": mostrali e chiedi quale intende
- NON inventare dati non presenti nel blocco [DATI DATABASE]`;

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AIChat() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [allDeals, setAllDeals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [lastQ, setLastQ] = useState(null);
  const [lastCount, setLastCount] = useState(null);
  const [queryHistory, setQueryHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bi_query_history') || '[]'); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { initAll(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const initAll = async () => {
    const [deals, conv] = await Promise.all([
      loadEntityAll(base44.entities.Deal),
      base44.agents.createConversation({
        agent_name: 'bi_agent',
        metadata: { name: 'BI ' + new Date().toLocaleDateString('it-IT') },
        initial_message: ANALYST_PROMPT,
      }),
    ]);
    setAllDeals(deals);
    setLoadingData(false);
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => setMessages([...data.messages]));
    setMessages(conv.messages || []);
  };

  const sendMessage = useCallback(async (text) => {
    const raw = (text || input).trim();
    if (!raw || !conversation || sending || loadingData) return;
    setInput('');
    setSending(true);

    const { dataBlock, q, count } = buildDataContext(allDeals, raw);
    setLastQ(q);
    setLastCount(count);
    setQueryHistory(prev => {
      const updated = [{ text: raw, time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), count }, ...prev.slice(0, 49)];
      try { localStorage.setItem('bi_query_history', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Tronca il dataBlock se troppo lungo (limite ~12.000 caratteri)
    const MAX_CHARS = 12000;
    const truncatedBlock = dataBlock.length > MAX_CHARS
      ? dataBlock.slice(0, MAX_CHARS) + '\n...[dati troncati per limite lunghezza - mostra solo i primi record]'
      : dataBlock;

    await base44.agents.addMessage(conversation, { role: 'user', content: raw + '\n\n' + truncatedBlock });
    setSending(false);
  }, [allDeals, conversation, input, sending, loadingData]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const visibleMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      ...m,
      content: m.role === 'user' ? m.content.replace(/\n\n\[DATI DATABASE[\s\S]*$/, '').trim() : m.content,
    }));

  const FilterBadge = ({ label, value, color = 'blue' }) => {
    if (!value) return null;
    const colors = {
      blue: 'bg-blue-100 text-blue-800',
      purple: 'bg-purple-100 text-purple-800',
      green: 'bg-green-100 text-green-800',
      orange: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${colors[color]}`}>
        {label}: {value}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800">AI Business Intelligence</h1>
            <p className="text-xs text-gray-400">Analisi dati 2025/2026 · Powered by AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${loadingData ? 'border-orange-200 bg-orange-50 text-orange-500' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {loadingData
              ? <><Loader2 className="w-3 h-3 animate-spin" /><span className="ml-1">Caricamento...</span></>
              : <><Database className="w-3 h-3" /><span className="ml-1">{allDeals.length.toLocaleString('it-IT')} record</span></>}
          </div>
          {queryHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${showHistory ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
            >
              <History className="w-3 h-3" />
              <span>Cronologia ({queryHistory.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* History panel */}
      {showHistory && queryHistory.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cronologia domande</span>
            <button onClick={() => { setQueryHistory([]); localStorage.removeItem('bi_query_history'); }} className="text-[10px] text-red-400 hover:text-red-600">Cancella tutto</button>
          </div>
          <div className="space-y-1">
            {queryHistory.map((h, i) => (
              <button
                key={i}
                onClick={() => { sendMessage(h.text); setShowHistory(false); }}
                disabled={sending || loadingData}
                className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors group disabled:opacity-40"
              >
                <span className="text-xs text-gray-700 truncate group-hover:text-blue-700">{h.text}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">{h.date} {h.time} · {h.count} rec</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter debug bar */}
      {lastQ && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-gray-400 font-medium mr-1">Filtri:</span>
          <FilterBadge label="RAC" value={lastQ.rac} color="purple" />
          <FilterBadge label="anno" value={lastQ.year} color="blue" />
          <FilterBadge label="LOB" value={lastQ.lob} color="blue" />
          <FilterBadge label="area" value={lastQ.area} color="blue" />
          <FilterBadge label="tipo_documento" value={lastQ.docType} color="orange" />
          <FilterBadge label="area_mng" value={lastQ.areaMng} color="purple" />
          {lastQ.yoy && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-yellow-100 text-yellow-800">YoY 2025 vs 2026</span>}
          <FilterBadge label="att/dif" value={lastQ.attackDefense} color="green" />
          <FilterBadge label="cliente" value={lastQ.clientName} color="purple" />
          <span className="ml-auto text-gray-400 font-semibold">{lastCount} record</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-blue-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-1">Ciao! Sono il tuo assistente BI</h2>
            <p className="text-sm text-gray-400 mb-1 max-w-sm">Scrivi come parli — capisco il linguaggio del commerciale.</p>
            <p className="text-xs text-gray-300 mb-6 max-w-sm italic">
              "RAC Albini contratti IoT 2026" &nbsp;·&nbsp; "top 5 MNO" &nbsp;·&nbsp; "trattative difesa"
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  disabled={sending || !conversation || loadingData}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-600 hover:text-blue-700 disabled:opacity-40">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === 'user' ? 'bg-[#0a1628] text-white' : 'bg-white border border-gray-100 shadow-sm text-gray-700'
            }`}>
              {m.role === 'assistant'
                ? <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{m.content}</ReactMarkdown>
                : <p>{m.content}</p>}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span className="text-xs text-gray-400">Analisi in corso...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-4">
        {visibleMessages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)}
                disabled={sending || !conversation || loadingData}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 transition-colors disabled:opacity-40">
                {q.substring(0, 40)}...
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loadingData}
            placeholder={loadingData ? "Caricamento dati..." : "Scrivi: 'RAC Albini contratti IoT 2026', 'top 5 MNO attacco'..."}
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending || !conversation || loadingData}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Invio per inviare · Shift+Invio per a capo</p>
      </div>
    </div>
  );
}