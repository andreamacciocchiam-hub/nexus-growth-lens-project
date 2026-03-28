import { useState, useRef, useEffect } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { Send, Bot, User, Sparkles, Database, Loader2, TrendingUp, BarChart2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const fmt = (v) => {
  if (!v && v !== 0) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
  return `€${Math.round(v)}`;
};
const sign = (v) => v >= 0 ? `+${fmt(v)}` : fmt(v);
const pct = (a, b) => b > 0 ? `${((a-b)/b*100).toFixed(1)}%` : 'N/A';

function biAnswer(aggregati, text) {
  const t = text.toLowerCase();
  const ag24 = aggregati?.['2024'];
  const ag25 = aggregati?.['2025'];
  const ag26 = aggregati?.['2026'];

  if (!ag26) return '⚠️ Dati non disponibili. Assicurati di aver calcolato gli aggregati dalla Dashboard.';

  const annoMatch = t.match(/\b(2024|2025|2026)\b/)?.[1];
  const getAg = (a) => aggregati?.[a];

  // Area filter
  const areaMatch = text.match(/\b(MNO|SNO|LNO|MNE|SNE|LNE|MCS|SLCE|SLCS|IC)\b/i)?.[1]?.toUpperCase();
  const getArea = (ag, area) => ag?.byArea?.find(a => a.area === area);

  // LOB filter
  const lobKeys = { cloud: 'Cloud', connettiv: 'Connettività', iot: 'IoT', security: 'Security', licens: 'Licensing', 'other it': 'Other IT' };
  const lobMatch = Object.entries(lobKeys).find(([k]) => t.includes(k))?.[1];
  const getLob = (ag, lob) => ag?.byLob?.find(l => l.lob === lob);

  // RAC filter
  const racMatch = text.match(/\bRAC\s+([A-Za-z\s]{3,30}?)(?:\s+(?:2024|2025|2026|area|lob|$))/i)?.[1]?.trim();

  // ── Confronto YoY ────────────────────────────────────────────────
  if (t.match(/confronto|vs|versus|variaz|trend|crescita|andamento|rispetto|yoy/)) {
    const getV = (ag) => areaMatch ? getArea(ag, areaMatch)?.serv : ag?.kpi?.serv;
    const getC = (ag) => areaMatch ? getArea(ag, areaMatch)?.canoni : ag?.kpi?.canoni;
    const getD = (ag) => areaMatch ? getArea(ag, areaMatch)?.diff : ag?.kpi?.diff;
    const getN = (ag) => areaMatch ? getArea(ag, areaMatch)?.n : ag?.kpi?.n;

    let md = `## 📊 Confronto Portafoglio${areaMatch ? ` — Area ${areaMatch}` : ''}${lobMatch ? ` — LOB ${lobMatch}` : ''}\n\n`;
    md += `| Anno | Portafoglio | Canoni | Differenziale | Deal |\n`;
    md += `|------|------------|--------|--------------|------|\n`;
    ['2024','2025','2026'].forEach(a => {
      const ag = getAg(a);
      if (!ag) return;
      const v = lobMatch ? getLob(ag, lobMatch)?.serv : getV(ag);
      const c = lobMatch ? getLob(ag, lobMatch)?.canoni : getC(ag);
      const d = lobMatch ? 0 : getD(ag);
      const n = lobMatch ? getLob(ag, lobMatch)?.n : getN(ag);
      md += `| **${a}** | ${fmt(v)} | ${fmt(c)} | ${sign(d||0)} | ${n||0} |\n`;
    });
    const v25 = lobMatch ? getLob(ag25, lobMatch)?.serv : (areaMatch ? getArea(ag25, areaMatch)?.serv : ag25?.kpi?.serv);
    const v26 = lobMatch ? getLob(ag26, lobMatch)?.serv : (areaMatch ? getArea(ag26, areaMatch)?.serv : ag26?.kpi?.serv);
    const v24 = lobMatch ? getLob(ag24, lobMatch)?.serv : (areaMatch ? getArea(ag24, areaMatch)?.serv : ag24?.kpi?.serv);
    md += `\n**Variazione 2025→2026:** ${sign((v26||0)-(v25||0))} (${pct(v26||0, v25||0)})`;
    md += `\n**Variazione 2024→2025:** ${sign((v25||0)-(v24||0))} (${pct(v25||0, v24||0)})`;
    return md;
  }

  // ── Top clienti ───────────────────────────────────────────────────
  if (t.match(/top|migliori|classifica|ranking|maggiori/)) {
    const nMatch = t.match(/top\s*(\d+)/i);
    const n = nMatch ? parseInt(nMatch[1]) : 10;
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    let clienti = ag?.topClienti || [];
    if (areaMatch) clienti = clienti.filter(c => c.area === areaMatch);
    if (lobMatch) clienti = clienti.filter(c => c.lobs?.includes(lobMatch));
    clienti = clienti.slice(0, n);

    let md = `## 🏆 Top ${n} Clienti ${anno}${areaMatch ? ` — Area ${areaMatch}` : ''}${lobMatch ? ` — LOB ${lobMatch}` : ''}\n\n`;
    md += `| # | Cliente | Portafoglio | Canoni | Differenziale | Area | Deal |\n`;
    md += `|---|---------|------------|--------|--------------|------|------|\n`;
    clienti.forEach((c, i) => {
      md += `| ${i+1} | **${c.nome}** | ${fmt(c.serv)} | ${fmt(c.canoni)} | ${sign(c.diff||0)} | ${c.area} | ${c.n} |\n`;
    });
    return md;
  }

  // ── LOB breakdown ─────────────────────────────────────────────────
  if (t.match(/\blob\b|line of business|distribuzione lob|mix lob/)) {
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    const lobs = (ag?.byLob || []).filter(l => l.lob && l.lob !== 'N/D').sort((a,b) => b.serv - a.serv);
    const tot = lobs.reduce((s, l) => s + l.serv, 0);
    let md = `## 📦 Distribuzione LOB ${anno}\n\n`;
    md += `| LOB | Portafoglio | % | Canoni | Deal |\n`;
    md += `|-----|------------|---|--------|------|\n`;
    lobs.forEach(l => {
      const p = tot > 0 ? (l.serv/tot*100).toFixed(1) : 0;
      md += `| **${l.lob}** | ${fmt(l.serv)} | ${p}% | ${fmt(l.canoni)} | ${l.n} |\n`;
    });
    md += `\n**Totale:** ${fmt(tot)}`;
    return md;
  }

  // ── Area breakdown ────────────────────────────────────────────────
  if (t.match(/per area|per aree|area rac|territorial|area commerc/)) {
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    const areas = (ag?.byArea || []).sort((a,b) => b.serv - a.serv);
    let md = `## 🗺️ Portafoglio per Area RAC — ${anno}\n\n`;
    md += `| Area | Portafoglio | Canoni | Differenziale | Attacco | Difesa | Deal |\n`;
    md += `|------|------------|--------|--------------|---------|--------|------|\n`;
    areas.forEach(a => {
      md += `| **${a.area}** | ${fmt(a.serv)} | ${fmt(a.canoni)} | ${sign(a.diff||0)} | ${fmt(a.att||0)} | ${fmt(a.dif||0)} | ${a.n} |\n`;
    });
    return md;
  }

  // ── Attacco vs Difesa ─────────────────────────────────────────────
  if (t.match(/attacco|difesa|new business|rinnov|mix commerciale/)) {
    let md = `## ⚔️ Mix Attacco vs Difesa\n\n`;
    md += `| Anno | Attacco | % | Difesa | % | Totale |\n`;
    md += `|------|---------|---|--------|---|--------|\n`;
    ['2024','2025','2026'].forEach(a => {
      const ag = getAg(a);
      if (!ag) return;
      const att = areaMatch ? getArea(ag, areaMatch)?.att : ag.kpi?.att || 0;
      const dif = areaMatch ? getArea(ag, areaMatch)?.dif : ag.kpi?.dif || 0;
      const tot = (att||0) + (dif||0);
      const pA = tot > 0 ? ((att||0)/tot*100).toFixed(0) : 0;
      md += `| **${a}** | ${fmt(att)} | ${pA}% | ${fmt(dif)} | ${100-pA}% | ${fmt(tot)} |\n`;
    });
    return md;
  }

  // ── RAC specifico ─────────────────────────────────────────────────
  if (racMatch) {
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    const racData = (ag?.byRac || []).filter(r => {
      const words = racMatch.toLowerCase().split(' ').filter(w => w.length > 2);
      return words.some(w => r.rac.toLowerCase().includes(w));
    });
    if (racData.length === 0) {
      const allRac = (ag?.byRac || []).map(r => r.rac).slice(0, 15).join(', ');
      return `⚠️ Nessun RAC trovato con "${racMatch}".\n\nRAC disponibili: ${allRac}`;
    }
    let md = `## 👤 RAC: ${racMatch} — ${anno}\n\n`;
    md += `| RAC | Area | Portafoglio | Deal |\n`;
    md += `|-----|------|------------|------|\n`;
    racData.forEach(r => { md += `| **${r.rac}** | ${r.area} | ${fmt(r.serv)} | ${r.n} |\n`; });
    return md;
  }

  // ── Canoni ────────────────────────────────────────────────────────
  if (t.match(/canon|ricorrent|mrr/)) {
    let md = `## 💰 Canoni Ricorrenti\n\n`;
    md += `| Anno | Canoni | Portafoglio | % su Portafoglio |\n`;
    md += `|------|--------|------------|------------------|\n`;
    ['2024','2025','2026'].forEach(a => {
      const ag = getAg(a);
      if (!ag) return;
      const c = ag.kpi?.canoni || 0, s = ag.kpi?.serv || 0;
      const p = s > 0 ? (c/s*100).toFixed(1) : 0;
      md += `| **${a}** | ${fmt(c)} | ${fmt(s)} | ${p}% |\n`;
    });
    const c25 = ag25?.kpi?.canoni || 0, c26 = ag26?.kpi?.canoni || 0;
    md += `\n**Variazione 2025→2026:** ${sign(c26-c25)} (${pct(c26, c25)})`;
    return md;
  }

  // ── Differenziale ─────────────────────────────────────────────────
  if (t.match(/differenz|delta/)) {
    let md = `## 📈 Differenziale per Anno${areaMatch ? ` — Area ${areaMatch}` : ''}\n\n`;
    md += `| Anno | Differenziale | Portafoglio | % Diff/Port |\n`;
    md += `|------|--------------|------------|-------------|\n`;
    ['2024','2025','2026'].forEach(a => {
      const ag = getAg(a);
      if (!ag) return;
      const d = areaMatch ? getArea(ag, areaMatch)?.diff : ag.kpi?.diff || 0;
      const s = areaMatch ? getArea(ag, areaMatch)?.serv : ag.kpi?.serv || 0;
      const p = s > 0 ? (d/s*100).toFixed(1) : 0;
      md += `| **${a}** | ${sign(d||0)} | ${fmt(s)} | ${p}% |\n`;
    });
    return md;
  }

  // ── Riepilogo generale ────────────────────────────────────────────
  const getKpi = (ag) => areaMatch ? getArea(ag, areaMatch) : ag?.kpi;
  let md = `## 📊 Riepilogo${areaMatch ? ` — Area ${areaMatch}` : ''}${annoMatch ? ` — Anno ${annoMatch}` : ''}\n\n`;
  md += `| Anno | Portafoglio | Canoni | Differenziale | Attacco | Deal |\n`;
  md += `|------|------------|--------|--------------|---------|------|\n`;
  ['2024','2025','2026'].forEach(a => {
    if (annoMatch && a !== annoMatch) return;
    const ag = getAg(a);
    if (!ag) return;
    const k = getKpi(ag);
    md += `| **${a}** | ${fmt(k?.serv||0)} | ${fmt(k?.canoni||0)} | ${sign(k?.diff||0)} | ${fmt(k?.att||0)} | ${k?.n||0} |\n`;
  });
  const v25 = getKpi(ag25)?.serv || 0, v26 = getKpi(ag26)?.serv || 0;
  md += `\n**Variazione 2025→2026:** ${sign(v26-v25)} (${pct(v26, v25)})`;
  return md;
}

const SUGGESTED = [
  "Come sta andando il 2026 rispetto al 2025?",
  "Top 10 clienti per portafoglio 2026",
  "Distribuzione LOB 2026",
  "Mix attacco vs difesa per anno",
  "Portafoglio area MNO per anno",
  "Andamento canoni 2024-2026",
  "Differenziale per area 2026",
  "Confronto LOB Cloud 2025 vs 2026",
];

export default function AIChat() {
  const { aggregati, loading, hasAggregati } = useData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = (text) => {
    const raw = (text || input).trim();
    if (!raw || thinking || !hasAggregati) return;
    setInput('');
    setThinking(true);
    setMessages(prev => [...prev, { role: 'user', content: raw }]);
    setTimeout(() => {
      const reply = biAnswer(aggregati, raw);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setThinking(false);
    }, 150);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800">BI Assistant</h1>
            <p className="text-xs text-gray-400">Risposte istantanee dai dati in memoria</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
          loading ? 'border-orange-200 bg-orange-50 text-orange-600'
          : hasAggregati ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-red-200 bg-red-50 text-red-600'
        }`}>
          {loading ? <><Loader2 className="w-3 h-3 animate-spin" /><span>Caricamento...</span></>
          : hasAggregati ? <><Database className="w-3 h-3" /><span>Dati pronti</span></>
          : <><AlertCircle className="w-3 h-3" /><span>Aggregati mancanti</span></>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60%] text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
              <BarChart2 className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">BI Assistant</h2>
            <p className="text-sm text-gray-500 mb-1 max-w-md">
              {hasAggregati ? 'Dati pronti. Chiedimi qualsiasi analisi — rispondo in meno di 1 secondo.' : 'Calcola gli aggregati dalla Dashboard per abilitare la chat.'}
            </p>
            {!hasAggregati && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-2">Dashboard → "Aggiorna aggregati"</p>}
            {hasAggregati && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl mt-6">
                {SUGGESTED.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all text-gray-600 hover:text-blue-700 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100 text-gray-700'}`}>
              {m.role === 'assistant'
                ? <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:px-2 [&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-gray-100">{m.content}</ReactMarkdown>
                : <p>{m.content}</p>}
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
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5">
              {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && hasAggregati && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.slice(0, 4).map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)} disabled={thinking}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 transition-colors border border-transparent hover:border-blue-200 disabled:opacity-40">
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border-t border-gray-100 p-4">
        <div className="flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            disabled={!hasAggregati}
            placeholder={hasAggregati ? 'Es: "top 10 clienti 2026", "confronto LOB 2025 vs 2026", "area MNO attacco"...' : 'Calcola gli aggregati dalla Dashboard per iniziare'}
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
          <button onClick={() => sendMessage()} disabled={!input.trim() || thinking || !hasAggregati}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Risposte istantanee · nessuna API esterna</p>
      </div>
    </div>
  );
}
