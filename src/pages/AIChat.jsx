import { useState, useRef, useEffect } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { Send, Bot, User, Sparkles, Database, Loader2, TrendingUp, BarChart2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ─── Formatters ────────────────────────────────────────────────────
const fmt = (v) => {
  if (!v && v !== 0) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
};
const pct = (a, b) => b > 0 ? `${((a-b)/b*100).toFixed(1)}%` : 'N/A';
const sign = (v) => v >= 0 ? `+${fmt(v)}` : fmt(v);

// ─── BI Engine: risponde alle domande sui dati ─────────────────────
function biQuery(deals, text) {
  const t = text.toLowerCase();
  const sum = (arr, f) => arr.reduce((s, d) => s + (d[f] || 0), 0);
  const count = (arr) => arr.length;

  // Filtra per anno
  const anno = t.match(/\b(2024|2025|2026)\b/)?.[1];
  const anni = anno ? [anno] : ['2024', '2025', '2026'];

  // Filtra per area
  const areaMatch = text.match(/\b(MNO|SNO|LNO|MNE|SNE|LNE|MCS|SLCE|SLCS|IC)\b/i)?.[1]?.toUpperCase();

  // Filtra per LOB
  const lobMap = { cloud: 'Cloud', connettiv: 'Connettività', iot: 'IoT', security: 'Security', licens: 'Licensing', 'other it': 'Other IT' };
  const lobMatch = Object.entries(lobMap).find(([k]) => t.includes(k))?.[1];

  // Tipo
  const tipoAttacco = t.includes('attacco') || t.includes('new business');
  const tipoDifesa = t.includes('difesa') || t.includes('rinnov');
  const tipoCTR = t.includes('ctr') || t.includes('contratt');
  const tipoTTV = t.includes('ttv') || t.includes('trattativ');

  // Cliente o RAC libero
  const clientMatch = text.match(/cliente[:\s]+([a-zA-Z\s]+)/i)?.[1]?.trim() ||
                      text.match(/per\s+([A-Z][A-Z\s]+?)(?:\s+(?:nel|in|del|2024|2025|2026)|$)/)?.[1]?.trim();
  const racMatch = text.match(/\bRAC\s+([A-Za-z\s]+?)(?:\s+(?:nel|in|del|2024|2025|2026|area|lob)|$)/i)?.[1]?.trim();

  // Applica filtri
  let filtered = deals.filter(d => {
    if (anno && d.anno !== anno) return false;
    if (areaMatch && d.area_rac !== areaMatch) return false;
    if (lobMatch && d.lob !== lobMatch) return false;
    if (tipoAttacco && d.attacco_difesa !== 'Attacco') return false;
    if (tipoDifesa && d.attacco_difesa !== 'Difesa') return false;
    if (tipoCTR && d.tipo !== 'CTR') return false;
    if (tipoTTV && d.tipo !== 'TTV') return false;
    if (racMatch) {
      const r = (d.rac || '').toLowerCase();
      if (!racMatch.toLowerCase().split(' ').some(w => w.length > 2 && r.includes(w))) return false;
    }
    if (clientMatch) {
      const n = ((d.ragione_sociale_capogruppo || '') + ' ' + (d.ragione_sociale || '')).toLowerCase();
      if (!clientMatch.toLowerCase().split(' ').some(w => w.length > 2 && n.includes(w))) return false;
    }
    return true;
  });

  // ── TIPO DI DOMANDA ────────────────────────────────────────────

  // Confronto YoY (2024 vs 2025 vs 2026)
  if (t.match(/confronto|vs|versus|variaz|trend|crescita|calat|andament|rispetto/)) {
    const byA = {};
    anni.forEach(a => {
      const arr = deals.filter(d => d.anno === a && (!areaMatch || d.area_rac === areaMatch) && (!lobMatch || d.lob === lobMatch));
      byA[a] = { serv: sum(arr, 'serv_i_anno'), canoni: sum(arr, 'canoni'), diff: sum(arr, 'differenziale_servizi'), n: arr.length, att: arr.filter(d=>d.attacco_difesa==='Attacco').reduce((s,d)=>s+(d.serv_i_anno||0),0) };
    });
    let md = `## 📊 Confronto Portafoglio${areaMatch ? ` — Area ${areaMatch}` : ''}${lobMatch ? ` — LOB ${lobMatch}` : ''}\n\n`;
    md += `| Anno | Portafoglio | Canoni | Differenziale | Attacco | Deal |\n`;
    md += `|------|------------|--------|--------------|---------|------|\n`;
    ['2024','2025','2026'].forEach(a => {
      if (byA[a]) md += `| **${a}** | ${fmt(byA[a].serv)} | ${fmt(byA[a].canoni)} | ${sign(byA[a].diff)} | ${fmt(byA[a].att)} | ${byA[a].n} |\n`;
    });
    if (byA['2025'] && byA['2026']) {
      md += `\n**Variazione 2025→2026:** ${sign(byA['2026'].serv - byA['2025'].serv)} (${pct(byA['2026'].serv, byA['2025'].serv)})\n`;
    }
    if (byA['2024'] && byA['2025']) {
      md += `**Variazione 2024→2025:** ${sign(byA['2025'].serv - byA['2024'].serv)} (${pct(byA['2025'].serv, byA['2024'].serv)})\n`;
    }
    return md;
  }

  // Top clienti
  if (t.match(/top|migliori|classifica|ranking|maggiori/)) {
    const nMatch = t.match(/top\s*(\d+)/i);
    const n = nMatch ? parseInt(nMatch[1]) : 10;
    const map = {};
    filtered.forEach(d => {
      const k = d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/D';
      if (!map[k]) map[k] = { nome: k, serv: 0, canoni: 0, diff: 0, n: 0, area: d.area_rac, lob: new Set() };
      map[k].serv += d.serv_i_anno || 0;
      map[k].canoni += d.canoni || 0;
      map[k].diff += d.differenziale_servizi || 0;
      map[k].n++;
      if (d.lob) map[k].lob.add(d.lob);
    });
    const top = Object.values(map).sort((a,b) => b.serv - a.serv).slice(0, n);
    const desc = [anno && `${anno}`, areaMatch && `Area ${areaMatch}`, lobMatch && `LOB ${lobMatch}`, tipoAttacco && 'Attacco', tipoDifesa && 'Difesa'].filter(Boolean).join(' · ');
    let md = `## 🏆 Top ${n} Clienti${desc ? ` — ${desc}` : ''}\n\n`;
    md += `| # | Cliente | Portafoglio | Canoni | Differenziale | Area | Deal |\n`;
    md += `|---|---------|------------|--------|--------------|------|------|\n`;
    top.forEach((c, i) => {
      md += `| ${i+1} | **${c.nome}** | ${fmt(c.serv)} | ${fmt(c.canoni)} | ${sign(c.diff)} | ${c.area} | ${c.n} |\n`;
    });
    md += `\n*Totale filtrato: ${filtered.length.toLocaleString('it-IT')} deal · ${fmt(sum(filtered, 'serv_i_anno'))} portafoglio*`;
    return md;
  }

  // LOB breakdown
  if (t.match(/\blob\b|line of business|business line|distribuzione|mix lob/)) {
    const map = {};
    filtered.forEach(d => {
      const k = d.lob || 'N/D';
      if (!map[k]) map[k] = { lob: k, serv: 0, canoni: 0, n: 0 };
      map[k].serv += d.serv_i_anno || 0;
      map[k].canoni += d.canoni || 0;
      map[k].n++;
    });
    const tot = sum(filtered, 'serv_i_anno');
    const rows = Object.values(map).sort((a,b) => b.serv - a.serv);
    const desc = [anno && `${anno}`, areaMatch && `Area ${areaMatch}`].filter(Boolean).join(' · ');
    let md = `## 📦 Distribuzione LOB${desc ? ` — ${desc}` : ''}\n\n`;
    md += `| LOB | Portafoglio | % | Canoni | Deal |\n`;
    md += `|-----|------------|---|--------|------|\n`;
    rows.forEach(r => {
      const p = tot > 0 ? (r.serv/tot*100).toFixed(1) : 0;
      md += `| **${r.lob}** | ${fmt(r.serv)} | ${p}% | ${fmt(r.canoni)} | ${r.n} |\n`;
    });
    md += `\n**Totale:** ${fmt(tot)} · ${filtered.length} deal`;
    return md;
  }

  // Area breakdown
  if (t.match(/\barea\b|per area|aree|territorial/)) {
    const map = {};
    filtered.forEach(d => {
      const k = d.area_rac || 'N/D';
      if (!map[k]) map[k] = { area: k, serv: 0, diff: 0, att: 0, dif: 0, n: 0 };
      map[k].serv += d.serv_i_anno || 0;
      map[k].diff += d.differenziale_servizi || 0;
      if (d.attacco_difesa === 'Attacco') map[k].att += d.serv_i_anno || 0;
      else map[k].dif += d.serv_i_anno || 0;
      map[k].n++;
    });
    const desc = [anno && `${anno}`, lobMatch && `LOB ${lobMatch}`].filter(Boolean).join(' · ');
    let md = `## 🗺️ Portafoglio per Area RAC${desc ? ` — ${desc}` : ''}\n\n`;
    md += `| Area | Portafoglio | Differenziale | Attacco | Difesa | Deal |\n`;
    md += `|------|------------|--------------|---------|--------|------|\n`;
    Object.values(map).sort((a,b) => b.serv - a.serv).forEach(r => {
      md += `| **${r.area}** | ${fmt(r.serv)} | ${sign(r.diff)} | ${fmt(r.att)} | ${fmt(r.dif)} | ${r.n} |\n`;
    });
    return md;
  }

  // Attacco vs Difesa
  if (t.match(/attacco|difesa|new business|rinnov|mix commerciale/)) {
    const byAD = {};
    anni.forEach(a => {
      const arr = filtered.filter(d => d.anno === a);
      const att = arr.filter(d => d.attacco_difesa === 'Attacco');
      const dif = arr.filter(d => d.attacco_difesa === 'Difesa');
      byAD[a] = {
        att: sum(att, 'serv_i_anno'), dif: sum(dif, 'serv_i_anno'),
        nAtt: att.length, nDif: dif.length
      };
    });
    let md = `## ⚔️ Mix Attacco vs Difesa\n\n`;
    md += `| Anno | Attacco | % | Difesa | % | Tot Deal |\n`;
    md += `|------|---------|---|--------|---|----------|\n`;
    anni.forEach(a => {
      if (!byAD[a]) return;
      const tot = byAD[a].att + byAD[a].dif;
      const pA = tot > 0 ? (byAD[a].att/tot*100).toFixed(0) : 0;
      const pD = tot > 0 ? (byAD[a].dif/tot*100).toFixed(0) : 0;
      md += `| **${a}** | ${fmt(byAD[a].att)} | ${pA}% | ${fmt(byAD[a].dif)} | ${pD}% | ${byAD[a].nAtt + byAD[a].nDif} |\n`;
    });
    return md;
  }

  // RAC specifico
  if (racMatch) {
    const map = {};
    filtered.forEach(d => {
      const a = d.anno || 'N/D';
      if (!map[a]) map[a] = { serv: 0, canoni: 0, diff: 0, n: 0, att: 0, lobs: new Set() };
      map[a].serv += d.serv_i_anno || 0;
      map[a].canoni += d.canoni || 0;
      map[a].diff += d.differenziale_servizi || 0;
      if (d.attacco_difesa === 'Attacco') map[a].att += d.serv_i_anno || 0;
      map[a].n++;
      if (d.lob) map[a].lobs.add(d.lob);
    });
    let md = `## 👤 RAC: ${racMatch}\n\n`;
    md += `| Anno | Portafoglio | Canoni | Differenziale | Attacco | LOB | Deal |\n`;
    md += `|------|------------|--------|--------------|---------|-----|------|\n`;
    Object.entries(map).sort().forEach(([a, r]) => {
      md += `| **${a}** | ${fmt(r.serv)} | ${fmt(r.canoni)} | ${sign(r.diff)} | ${fmt(r.att)} | ${[...r.lobs].join(', ')} | ${r.n} |\n`;
    });
    if (filtered.length === 0) md += `\n⚠️ Nessun record trovato per RAC "${racMatch}". Verifica il nome esatto.`;
    return md;
  }

  // Canoni
  if (t.match(/canon|ricorrent|mrr|arr/)) {
    const byA = {};
    anni.forEach(a => {
      const arr = filtered.filter(d => d.anno === a);
      byA[a] = { canoni: sum(arr, 'canoni'), serv: sum(arr, 'serv_i_anno'), n: arr.length };
    });
    let md = `## 💰 Canoni Ricorrenti${areaMatch ? ` — Area ${areaMatch}` : ''}${lobMatch ? ` — LOB ${lobMatch}` : ''}\n\n`;
    md += `| Anno | Canoni | Portafoglio | % Canoni/Serv | Deal |\n`;
    md += `|------|--------|------------|---------------|------|\n`;
    anni.forEach(a => {
      if (!byA[a]) return;
      const p = byA[a].serv > 0 ? (byA[a].canoni/byA[a].serv*100).toFixed(1) : 0;
      md += `| **${a}** | ${fmt(byA[a].canoni)} | ${fmt(byA[a].serv)} | ${p}% | ${byA[a].n} |\n`;
    });
    if (byA['2025'] && byA['2026']) {
      md += `\n**Var. canoni 2025→2026:** ${sign(byA['2026'].canoni - byA['2025'].canoni)} (${pct(byA['2026'].canoni, byA['2025'].canoni)})`;
    }
    return md;
  }

  // Differenziale
  if (t.match(/differenz|delta|variaz|crescita netta/)) {
    const byA = {};
    anni.forEach(a => {
      const arr = filtered.filter(d => d.anno === a);
      const pos = arr.filter(d => (d.differenziale_servizi || 0) > 0);
      const neg = arr.filter(d => (d.differenziale_servizi || 0) < 0);
      byA[a] = { diff: sum(arr, 'differenziale_servizi'), nPos: pos.length, nNeg: neg.length, diffPos: sum(pos, 'differenziale_servizi'), diffNeg: sum(neg, 'differenziale_servizi') };
    });
    let md = `## 📈 Analisi Differenziale${areaMatch ? ` — Area ${areaMatch}` : ''}\n\n`;
    md += `| Anno | Differenziale | Positivi | Negativi | Tot+ | Tot- |\n`;
    md += `|------|--------------|---------|---------|------|------|\n`;
    anni.forEach(a => {
      if (!byA[a]) return;
      md += `| **${a}** | ${sign(byA[a].diff)} | ${byA[a].nPos} | ${byA[a].nNeg} | ${fmt(byA[a].diffPos)} | ${fmt(byA[a].diffNeg)} |\n`;
    });
    return md;
  }

  // CTR vs TTV
  if (t.match(/\bctr\b|\bttv\b|contratt|trattativ|pipeline/)) {
    const byA = {};
    anni.forEach(a => {
      const arr = filtered.filter(d => d.anno === a);
      const ctr = arr.filter(d => d.tipo === 'CTR');
      const ttv = arr.filter(d => d.tipo === 'TTV');
      byA[a] = { ctr: sum(ctr,'serv_i_anno'), ttv: sum(ttv,'serv_i_anno'), nCtr: ctr.length, nTtv: ttv.length };
    });
    let md = `## 📋 CTR vs TTV${areaMatch ? ` — Area ${areaMatch}` : ''}\n\n`;
    md += `| Anno | CTR (Contratti) | N | TTV (Trattative) | N |\n`;
    md += `|------|----------------|---|-----------------|---|\n`;
    anni.forEach(a => {
      if (!byA[a]) return;
      md += `| **${a}** | ${fmt(byA[a].ctr)} | ${byA[a].nCtr} | ${fmt(byA[a].ttv)} | ${byA[a].nTtv} |\n`;
    });
    return md;
  }

  // Query generica — KPI riassuntivo
  const byA = {};
  anni.forEach(a => {
    const arr = filtered.filter(d => d.anno === a);
    if (arr.length === 0) return;
    byA[a] = {
      serv: sum(arr, 'serv_i_anno'), canoni: sum(arr, 'canoni'),
      diff: sum(arr, 'differenziale_servizi'), n: arr.length,
      att: arr.filter(d => d.attacco_difesa==='Attacco').reduce((s,d)=>s+(d.serv_i_anno||0),0),
    };
  });

  const filters = [anno && `Anno ${anno}`, areaMatch && `Area ${areaMatch}`, lobMatch && `LOB ${lobMatch}`, tipoAttacco && 'Attacco', tipoDifesa && 'Difesa'].filter(Boolean);
  let md = `## 📊 Riepilogo${filters.length ? ` — ${filters.join(' · ')}` : ' Generale'}\n\n`;
  md += `| Anno | Portafoglio | Canoni | Differenziale | Attacco | Deal |\n`;
  md += `|------|------------|--------|--------------|---------|------|\n`;
  ['2024','2025','2026'].forEach(a => {
    if (!byA[a]) return;
    md += `| **${a}** | ${fmt(byA[a].serv)} | ${fmt(byA[a].canoni)} | ${sign(byA[a].diff)} | ${fmt(byA[a].att)} | ${byA[a].n} |\n`;
  });
  if (byA['2025'] && byA['2026']) {
    const var2625 = pct(byA['2026'].serv, byA['2025'].serv);
    md += `\n**2026 vs 2025:** ${sign(byA['2026'].serv - byA['2025'].serv)} (${var2625})`;
  }

  if (filtered.length === 0) {
    return `⚠️ Nessun record trovato con questi filtri.\n\nProva a riformulare la domanda o usa termini come:\n- *"top 10 clienti 2026"*\n- *"confronto LOB 2025 vs 2026"*\n- *"area MNO attacco 2026"*`;
  }

  return md;
}

// ─── Suggerimenti ──────────────────────────────────────────────────
const SUGGESTED = [
  "Come sta andando il 2026 rispetto al 2025?",
  "Top 10 clienti per portafoglio 2026",
  "Confronto LOB 2025 vs 2026",
  "Mix attacco vs difesa per anno",
  "Area RAC con più portafoglio 2026",
  "Andamento canoni 2024-2025-2026",
  "Differenziale per area 2026",
  "CTR vs TTV 2026",
];

export default function AIChat() {
  const { deals, loading, progress, ready } = useData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text) => {
    const raw = (text || input).trim();
    if (!raw || thinking || !ready) return;
    setInput('');
    setThinking(true);

    const userMsg = { role: 'user', content: raw };
    setMessages(prev => [...prev, userMsg]);

    // Risposta sincrona — niente API, tutto in memoria
    setTimeout(() => {
      const reply = biQuery(deals, raw);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setThinking(false);
    }, 200); // piccolo delay per UX
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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
            <h1 className="font-bold text-gray-800">BI Assistant</h1>
            <p className="text-xs text-gray-400">Analisi portafoglio 2024 · 2025 · 2026</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
          loading ? 'border-orange-200 bg-orange-50 text-orange-600'
          : ready ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}>
          {loading ? (
            <><Loader2 className="w-3 h-3 animate-spin" /><span>Caricamento {progress.anno}... {progress.count.toLocaleString('it-IT')}</span></>
          ) : (
            <><Database className="w-3 h-3" /><span>{deals.length.toLocaleString('it-IT')} record in memoria</span></>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Welcome */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60%] text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
              <BarChart2 className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">BI Assistant</h2>
            <p className="text-sm text-gray-500 mb-1 max-w-md">
              {ready
                ? `Dati pronti — ${deals.length.toLocaleString('it-IT')} deal in memoria. Chiedimi qualsiasi analisi.`
                : 'Caricamento dati in corso...'}
            </p>
            <p className="text-xs text-gray-400 mb-8 max-w-md">
              Rispondo istantaneamente con tabelle e numeri reali — nessuna API esterna.
            </p>
            {ready && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {SUGGESTED.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all text-gray-600 hover:text-blue-700 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                    {q}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span className="text-sm">Caricamento anno {progress.anno}... {progress.count.toLocaleString('it-IT')} record</span>
              </div>
            )}
          </div>
        )}

        {/* Chat */}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-100 text-gray-700'
            }`}>
              {m.role === 'assistant' ? (
                <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_table]:w-full [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:px-2 [&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-gray-100">
                  {m.content}
                </ReactMarkdown>
              ) : (
                <p>{m.content}</p>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggerimenti veloci */}
      {messages.length > 0 && ready && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.slice(0, 4).map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)}
              disabled={thinking}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 transition-colors disabled:opacity-40 border border-transparent hover:border-blue-200">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={!ready}
            placeholder={
              loading ? `Caricamento ${progress.anno}... ${progress.count.toLocaleString('it-IT')} record`
              : 'Chiedi: "top 10 clienti 2026", "confronto LOB", "area MNO attacco"...'
            }
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || thinking || !ready}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Invio per inviare · Shift+Invio per a capo · Risposte istantanee dai dati in memoria</p>
      </div>
    </div>
  );
}
