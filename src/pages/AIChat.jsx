import { useState, useRef, useEffect } from 'react';
import { useData } from '@/lib/DataContext.jsx';
import { Send, Bot, User, Sparkles, Database, Loader2, TrendingUp, BarChart2, AlertCircle } from 'lucide-react';

function fmt(v) {
  if (!v && v !== 0) return '€0';
  const val = (v || 0) * 1000;
  if (Math.abs(val) >= 1_000_000_000) return `€${(val/1_000_000_000).toFixed(2)}B`;
  if (Math.abs(val) >= 1_000_000) return `€${(val/1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `€${(val/1_000).toFixed(0)}K`;
  return `€${Math.round(val)}`;
}
const sign = (v) => {
  const f = fmt(Math.abs(v));
  return v >= 0 ? `+${f}` : `-${f}`;
};
const pct = (a, b) => b > 0 ? `${((a-b)/b*100).toFixed(1)}%` : 'N/A';

// Costruisce HTML tabella da headers + rows
function buildTable(headers, rows, colAlign) {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map(row => {
    const tds = row.map((cell, i) => {
      const align = colAlign?.[i] || 'left';
      return `<td style="text-align:${align}">${cell ?? '—'}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table>${ths ? `<thead><tr>${ths}</tr></thead>` : ''}<tbody>${trs}</tbody></table>`;
}

function biAnswer(aggregati, allDeals, portafoglioMap, text) {
  const t = text.toLowerCase();
  const ag24 = aggregati?.['2024'];
  const ag25 = aggregati?.['2025'];
  const ag26 = aggregati?.['2026'];

  if (!ag26) return { type: 'text', content: '⚠️ Dati non disponibili. Calcola gli aggregati dalla Dashboard.' };

  const annoMatch = t.match(/\b(2024|2025|2026)\b/)?.[1];
  const getAg = (a) => aggregati?.[a];
  const areaMatch = text.match(/\b(MNO|SNO|LNO|MNE|SNE|LNE|MCS|SLCE|SLCS|IC)\b/i)?.[1]?.toUpperCase();
  const lobKeys = { cloud:'Cloud', connettiv:'Connettività', iot:'IoT', security:'Security', licens:'Licensing', 'other it':'Other IT' };
  const lobMatch = Object.entries(lobKeys).find(([k]) => t.includes(k))?.[1];

  // ── Confronto YoY ────────────────────────────────────────────────
  if (t.match(/confronto|vs|versus|variaz|trend|crescita|andamento|rispetto|yoy/)) {
    const getV = (ag) => areaMatch ? ag?.byArea?.find(a=>a.area===areaMatch)?.serv : ag?.kpi?.serv;
    const getC = (ag) => areaMatch ? ag?.byArea?.find(a=>a.area===areaMatch)?.canoni : ag?.kpi?.canoni;
    const getD = (ag) => areaMatch ? ag?.byArea?.find(a=>a.area===areaMatch)?.diff : ag?.kpi?.diff;
    const getN = (ag) => areaMatch ? ag?.byArea?.find(a=>a.area===areaMatch)?.n : ag?.kpi?.n;

    const title = `Confronto Portafoglio${areaMatch?` — Area ${areaMatch}`:''}${lobMatch?` — LOB ${lobMatch}`:''}`;
    const rows = ['2024','2025','2026'].map(a => {
      const ag = getAg(a); if (!ag) return null;
      const v = lobMatch ? ag.byLob?.find(x=>x.lob===lobMatch)?.serv : getV(ag);
      const c = lobMatch ? ag.byLob?.find(x=>x.lob===lobMatch)?.canoni : getC(ag);
      const d = lobMatch ? null : getD(ag);
      const n = lobMatch ? ag.byLob?.find(x=>x.lob===lobMatch)?.n : getN(ag);
      return [a, fmt(v), fmt(c), d!=null?sign(d):'—', n?.toLocaleString('it-IT')||'—'];
    }).filter(Boolean);

    const v25 = lobMatch?ag25?.byLob?.find(x=>x.lob===lobMatch)?.serv:(areaMatch?ag25?.byArea?.find(a=>a.area===areaMatch)?.serv:ag25?.kpi?.serv)||0;
    const v26 = lobMatch?ag26?.byLob?.find(x=>x.lob===lobMatch)?.serv:(areaMatch?ag26?.byArea?.find(a=>a.area===areaMatch)?.serv:ag26?.kpi?.serv)||0;
    const v24 = lobMatch?ag24?.byLob?.find(x=>x.lob===lobMatch)?.serv:(areaMatch?ag24?.byArea?.find(a=>a.area===areaMatch)?.serv:ag24?.kpi?.serv)||0;

    return {
      type: 'table', title,
      html: buildTable(['Anno','Portafoglio','Canoni','Differenziale','Deal'], rows, ['left','right','right','right','right']),
      footer: `Var 25→26: ${sign(v26-v25)} (${pct(v26,v25)}) · Var 24→25: ${sign(v25-v24)} (${pct(v25,v24)})`
    };
  }

  // ── Top clienti ───────────────────────────────────────────────────
  if (t.match(/top|migliori|classifica|ranking|maggiori/)) {
    const nMatch = t.match(/top\s*(\d+)/i);
    const n = nMatch ? parseInt(nMatch[1]) : 10;
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    let clienti = ag?.topClienti || [];
    if (areaMatch) clienti = clienti.filter(c=>c.area===areaMatch);
    if (lobMatch) clienti = clienti.filter(c=>c.lobs?.includes(lobMatch));
    clienti = clienti.slice(0, n);

    const rows = clienti.map((c,i) => [i+1, c.nome, fmt(c.serv), fmt(c.canoni), sign(c.diff||0), c.area, c.n]);
    return {
      type: 'table',
      title: `Top ${n} Clienti ${anno}${areaMatch?` — Area ${areaMatch}`:''}${lobMatch?` — LOB ${lobMatch}`:''}`,
      html: buildTable(['#','Cliente','Portafoglio','Canoni','Differenziale','Area','Deal'], rows, ['right','left','right','right','right','center','right'])
    };
  }

  // ── LOB breakdown ─────────────────────────────────────────────────
  if (t.match(/\blob\b|line of business|distribuzione lob|mix lob/)) {
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    const lobs = (ag?.byLob||[]).filter(l=>l.lob&&l.lob!=='N/D').sort((a,b)=>b.serv-a.serv);
    const tot = lobs.reduce((s,l)=>s+l.serv,0);
    const rows = lobs.map(l => [l.lob, fmt(l.serv), tot>0?`${(l.serv/tot*100).toFixed(1)}%`:'—', fmt(l.canoni), l.n]);
    return {
      type: 'table', title: `Distribuzione LOB ${anno}`,
      html: buildTable(['LOB','Portafoglio','%','Canoni','Deal'], rows, ['left','right','right','right','right']),
      footer: `Totale: ${fmt(tot)}`
    };
  }

  // ── Area breakdown ────────────────────────────────────────────────
  if (t.match(/per area|per aree|area rac|territorial|area commerc/)) {
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    const areas = (ag?.byArea||[]).sort((a,b)=>b.serv-a.serv);
    const rows = areas.map(a => [a.area, fmt(a.serv), fmt(a.canoni), sign(a.diff||0), fmt(a.att||0), fmt(a.dif||0), a.n]);
    return {
      type: 'table', title: `Portafoglio per Area RAC — ${anno}`,
      html: buildTable(['Area','Portafoglio','Canoni','Differenziale','Attacco','Difesa','Deal'], rows, ['left','right','right','right','right','right','right'])
    };
  }

  // ── Attacco vs Difesa ─────────────────────────────────────────────
  if (t.match(/attacco|difesa|new business|rinnov|mix commerciale/)) {
    const rows = ['2024','2025','2026'].map(a => {
      const ag = getAg(a); if (!ag) return null;
      const att = areaMatch ? ag.byArea?.find(x=>x.area===areaMatch)?.att : ag.kpi?.att||0;
      const dif = areaMatch ? ag.byArea?.find(x=>x.area===areaMatch)?.dif : ag.kpi?.dif||0;
      const tot = (att||0)+(dif||0);
      const pA = tot>0?((att||0)/tot*100).toFixed(0):0;
      return [a, fmt(att), `${pA}%`, fmt(dif), `${100-pA}%`, fmt(tot)];
    }).filter(Boolean);
    return {
      type: 'table', title: `Mix Attacco vs Difesa${areaMatch?` — Area ${areaMatch}`:''}`,
      html: buildTable(['Anno','Attacco','% Att','Difesa','% Dif','Totale'], rows, ['left','right','right','right','right','right'])
    };
  }

  // ── CTR vs TTV ────────────────────────────────────────────────────
  if (t.match(/ctr|ttv|tipologia|tipo deal/)) {
    const rows = ['2024','2025','2026'].map(a => {
      const ag = getAg(a); if (!ag) return null;
      return [a, ag.kpi?.ctr?.toLocaleString('it-IT')||'—', ag.kpi?.ttv?.toLocaleString('it-IT')||'—', ag.kpi?.n?.toLocaleString('it-IT')||'—'];
    }).filter(Boolean);
    return {
      type: 'table', title: 'Distribuzione CTR vs TTV',
      html: buildTable(['Anno','CTR','TTV','Totale'], rows, ['left','right','right','right'])
    };
  }

  // ── Canoni ────────────────────────────────────────────────────────
  if (t.match(/canon|ricorrent|mrr/)) {
    const rows = ['2024','2025','2026'].map(a => {
      const ag = getAg(a); if (!ag) return null;
      const c = ag.kpi?.canoni||0, s = ag.kpi?.serv||0;
      return [a, fmt(c), fmt(s), s>0?`${(c/s*100).toFixed(1)}%`:'—'];
    }).filter(Boolean);
    const c25=ag25?.kpi?.canoni||0, c26=ag26?.kpi?.canoni||0;
    return {
      type: 'table', title: 'Canoni Ricorrenti',
      html: buildTable(['Anno','Canoni','Portafoglio','% su Portafoglio'], rows, ['left','right','right','right']),
      footer: `Var 25→26: ${sign(c26-c25)} (${pct(c26,c25)})`
    };
  }

  // ── RAC specifico ─────────────────────────────────────────────────
  const racMatch = text.match(/\bRAC\s+([A-Za-z\s]{3,30}?)(?:\s|$)/i)?.[1]?.trim();
  if (racMatch) {
    const anno = annoMatch || '2026';
    const ag = getAg(anno);
    const racData = (ag?.byRac||[]).filter(r => {
      const words = racMatch.toLowerCase().split(' ').filter(w=>w.length>2);
      return words.some(w=>r.rac.toLowerCase().includes(w));
    });
    if (racData.length===0) {
      const all = (ag?.byRac||[]).map(r=>r.rac).slice(0,15).join(', ');
      return { type:'text', content:`⚠️ Nessun RAC trovato con "${racMatch}".\n\nRAC disponibili: ${all}` };
    }
    const rows = racData.map(r=>[r.rac, r.area, fmt(r.serv), r.n]);
    return {
      type: 'table', title: `RAC: ${racMatch} — ${anno}`,
      html: buildTable(['RAC','Area','Portafoglio','Deal'], rows, ['left','left','right','right'])
    };
  }

  // ── Riepilogo generale ────────────────────────────────────────────
  const getKpi = (ag) => areaMatch ? ag?.byArea?.find(a=>a.area===areaMatch) : ag?.kpi;
  const rows = ['2024','2025','2026'].map(a => {
    if (annoMatch && a!==annoMatch) return null;
    const ag = getAg(a); if (!ag) return null;
    const k = getKpi(ag);
    return [a, fmt(k?.serv||0), fmt(k?.canoni||0), sign(k?.diff||0), fmt(k?.att||0), k?.n||0];
  }).filter(Boolean);
  const v25=getKpi(ag25)?.serv||0, v26=getKpi(ag26)?.serv||0;
  return {
    type: 'table',
    title: `Riepilogo${areaMatch?` — Area ${areaMatch}`:''}${annoMatch?` — Anno ${annoMatch}`:''}`,
    html: buildTable(['Anno','Portafoglio','Canoni','Differenziale','Attacco','Deal'], rows, ['left','right','right','right','right','right']),
    footer: `Var 25→26: ${sign(v26-v25)} (${pct(v26,v25)})`
  };
}

const SUGGESTED = [
  "Come sta andando il 2026 rispetto al 2025?",
  "Top 10 clienti per portafoglio 2026",
  "Distribuzione LOB 2026",
  "Mix attacco vs difesa per anno",
  "Portafoglio per area 2026",
  "Andamento canoni 2024-2026",
  "Distribuzione CTR vs TTV",
  "Confronto LOB Cloud 2025 vs 2026",
];

function MessageContent({ msg }) {
  if (msg.role === 'user') return <p className="text-sm">{msg.content}</p>;
  const r = msg.result;
  if (!r) return <p className="text-sm text-gray-500 italic">{msg.content}</p>;
  return (
    <div className="space-y-2">
      {r.title && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{r.title}</p>}
      {r.type === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <style>{`
            .bi-table { width:100%; border-collapse:collapse; font-size:12px; }
            .bi-table thead tr { background:#f8fafc; border-bottom:2px solid #e2e8f0; }
            .bi-table thead th { padding:8px 12px; font-weight:600; color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; }
            .bi-table tbody tr { border-bottom:1px solid #f1f5f9; transition:background .1s; }
            .bi-table tbody tr:hover { background:#f0f9ff; }
            .bi-table tbody tr:last-child { border-bottom:none; }
            .bi-table tbody td { padding:7px 12px; color:#374151; white-space:nowrap; }
            .bi-table tbody tr:first-child td { font-weight:600; }
          `}</style>
          <div dangerouslySetInnerHTML={{ __html: r.html.replace('<table>', '<table class="bi-table">') }} />
        </div>
      )}
      {r.type === 'text' && <p className="text-sm text-gray-700 whitespace-pre-line">{r.content}</p>}
      {r.footer && <p className="text-xs text-gray-400 mt-1">{r.footer}</p>}
    </div>
  );
}

export default function AIChat() {
  const { aggregati, loading, hasAggregati, allDeals, portafoglioMap } = useData();
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
      const result = biAnswer(aggregati, allDeals, portafoglioMap, raw);
      setMessages(prev => [...prev, { role: 'assistant', content: '', result }]);
      setThinking(false);
    }, 100);
  };

  const handleKey = (e) => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800">BI Assistant</h1>
            <p className="text-xs text-gray-400">Risposte istantanee · tabelle strutturate</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
          loading ? 'border-orange-200 bg-orange-50 text-orange-600'
          : hasAggregati ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-red-200 bg-red-50 text-red-600'
        }`}>
          {loading ? <><Loader2 className="w-3 h-3 animate-spin"/><span>Caricamento...</span></>
          : hasAggregati ? <><Database className="w-3 h-3"/><span>Dati pronti</span></>
          : <><AlertCircle className="w-3 h-3"/><span>Aggregati mancanti</span></>}
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
              {hasAggregati ? 'Chiedimi qualsiasi analisi — rispondo in meno di 1 secondo con tabelle strutturate.' : 'Calcola gli aggregati dalla Dashboard per iniziare.'}
            </p>
            {hasAggregati && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl mt-6">
                {SUGGESTED.map((q,i) => (
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

        {messages.map((m,i) => (
          <div key={i} className={`flex gap-3 ${m.role==='user'?'justify-end':'justify-start'}`}>
            {m.role==='assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white"/>
              </div>
            )}
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-sm ${m.role==='user'?'bg-blue-600 text-white':'bg-white border border-gray-100 text-gray-700'}`}>
              <MessageContent msg={m} />
            </div>
            {m.role==='user' && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-gray-600"/>
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white"/>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5">
              {[0,150,300].map(d=><div key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {messages.length > 0 && hasAggregati && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.slice(0,4).map((q,i) => (
            <button key={i} onClick={()=>sendMessage(q)} disabled={thinking}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 transition-colors border border-transparent hover:border-blue-200 disabled:opacity-40">
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border-t border-gray-100 p-4">
        <div className="flex gap-2">
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            disabled={!hasAggregati}
            placeholder={hasAggregati?'Es: "top 10 clienti 2026", "distribuzione CTR vs TTV", "area MNO attacco"...':'Calcola gli aggregati dalla Dashboard per iniziare'}
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"/>
          <button onClick={()=>sendMessage()} disabled={!input.trim()||thinking||!hasAggregati}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4"/>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Risposte istantanee · tabelle strutturate · nessuna API esterna</p>
      </div>
    </div>
  );
}
