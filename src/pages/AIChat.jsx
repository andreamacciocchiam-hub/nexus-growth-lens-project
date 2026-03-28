import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';
import { Send, Loader2, Bot, User, Sparkles, Database, RefreshCw, TrendingUp, BarChart2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ─── Caricamento dati Firestore ────────────────────────────────────
async function loadDealsForAnno(anno) {
  const col = collection(db, 'deals');
  let all = [];
  let lastDoc = null;
  while (true) {
    const constraints = [col, where('anno', '==', anno), limit(100)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(...constraints));
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    await new Promise(r => setTimeout(r, 50));
  }
  return all;
}

// ─── Calcola statistiche aggregate per il contesto AI ─────────────
function buildContext(deals) {
  const anni = ['2024', '2025', '2026'];
  const byAnno = {};
  anni.forEach(a => { byAnno[a] = deals.filter(d => d.anno === a); });

  const sum = (arr, f) => arr.reduce((s, d) => s + (d[f] || 0), 0);

  // KPI per anno
  const kpi = {};
  anni.forEach(a => {
    const arr = byAnno[a];
    kpi[a] = {
      n: arr.length,
      serv: sum(arr, 'serv_i_anno'),
      canoni: sum(arr, 'canoni'),
      diff: sum(arr, 'differenziale_servizi'),
      attacco: arr.filter(d => d.attacco_difesa === 'Attacco').reduce((s, d) => s + (d.serv_i_anno || 0), 0),
      difesa: arr.filter(d => d.attacco_difesa === 'Difesa').reduce((s, d) => s + (d.serv_i_anno || 0), 0),
      ctr: arr.filter(d => d.tipo === 'CTR').length,
      ttv: arr.filter(d => d.tipo === 'TTV').length,
    };
  });

  // Top clienti per anno
  const topClienti = (anno, n = 10) => {
    const map = {};
    byAnno[anno].forEach(d => {
      const k = d.ragione_sociale_capogruppo || d.ragione_sociale || 'N/D';
      if (!map[k]) map[k] = { nome: k, serv: 0, canoni: 0, diff: 0, n: 0, area: d.area_rac, lobs: new Set() };
      map[k].serv += d.serv_i_anno || 0;
      map[k].canoni += d.canoni || 0;
      map[k].diff += d.differenziale_servizi || 0;
      map[k].n++;
      if (d.lob) map[k].lobs.add(d.lob);
    });
    return Object.values(map)
      .sort((a, b) => b.serv - a.serv)
      .slice(0, n)
      .map(c => ({ ...c, lobs: [...c.lobs].join(', ') }));
  };

  // LOB breakdown
  const byLob = (anno) => {
    const map = {};
    byAnno[anno].forEach(d => {
      const k = d.lob || 'N/D';
      if (!map[k]) map[k] = { lob: k, serv: 0, n: 0 };
      map[k].serv += d.serv_i_anno || 0;
      map[k].n++;
    });
    return Object.values(map).sort((a, b) => b.serv - a.serv);
  };

  // Area breakdown
  const byArea = (anno) => {
    const map = {};
    byAnno[anno].forEach(d => {
      const k = d.area_rac || 'N/D';
      if (!map[k]) map[k] = { area: k, serv: 0, diff: 0, n: 0 };
      map[k].serv += d.serv_i_anno || 0;
      map[k].diff += d.differenziale_servizi || 0;
      map[k].n++;
    });
    return Object.values(map).sort((a, b) => b.serv - a.serv);
  };

  // RAC breakdown
  const byRac = (anno) => {
    const map = {};
    byAnno[anno].forEach(d => {
      const k = d.rac || 'N/D';
      if (!map[k]) map[k] = { rac: k, area: d.area_rac, serv: 0, n: 0 };
      map[k].serv += d.serv_i_anno || 0;
      map[k].n++;
    });
    return Object.values(map).sort((a, b) => b.serv - a.serv);
  };

  const fmt = (v) => {
    if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `€${(v/1_000).toFixed(0)}K`;
    return `€${Math.round(v)}`;
  };

  const pct = (a, b) => b > 0 ? `${((a-b)/b*100).toFixed(1)}%` : 'N/A';

  let ctx = `# CONTESTO DATI BI - TIM ENTERPRISE\nDati aggiornati · ${deals.length.toLocaleString('it-IT')} record totali\n\n`;

  ctx += `## KPI PRINCIPALI\n`;
  anni.forEach(a => {
    ctx += `### Anno ${a}\n`;
    ctx += `- Portafoglio totale: ${fmt(kpi[a].serv)} (${kpi[a].n} deal)\n`;
    ctx += `- Canoni: ${fmt(kpi[a].canoni)}\n`;
    ctx += `- Differenziale: ${fmt(kpi[a].diff)}\n`;
    ctx += `- Attacco: ${fmt(kpi[a].attacco)} | Difesa: ${fmt(kpi[a].difesa)}\n`;
    ctx += `- CTR: ${kpi[a].ctr} | TTV: ${kpi[a].ttv}\n`;
  });

  ctx += `\n## CONFRONTO YoY\n`;
  ctx += `- 2025 vs 2024: ${pct(kpi['2025'].serv, kpi['2024'].serv)} (${fmt(kpi['2025'].serv - kpi['2024'].serv)})\n`;
  ctx += `- 2026 vs 2025: ${pct(kpi['2026'].serv, kpi['2025'].serv)} (${fmt(kpi['2026'].serv - kpi['2025'].serv)})\n`;
  ctx += `- Differenziale 2026: ${fmt(kpi['2026'].diff)}\n`;

  ctx += `\n## TOP 10 CLIENTI 2026\n`;
  topClienti('2026', 10).forEach((c, i) => {
    ctx += `${i+1}. ${c.nome} | ${fmt(c.serv)} | Canoni: ${fmt(c.canoni)} | Diff: ${fmt(c.diff)} | Area: ${c.area} | LOB: ${c.lobs} | Deal: ${c.n}\n`;
  });

  ctx += `\n## TOP 10 CLIENTI 2025\n`;
  topClienti('2025', 10).forEach((c, i) => {
    ctx += `${i+1}. ${c.nome} | ${fmt(c.serv)} | Canoni: ${fmt(c.canoni)} | Area: ${c.area} | LOB: ${c.lobs} | Deal: ${c.n}\n`;
  });

  ctx += `\n## LOB BREAKDOWN 2026\n`;
  byLob('2026').forEach(l => {
    ctx += `- ${l.lob}: ${fmt(l.serv)} (${l.n} deal)\n`;
  });

  ctx += `\n## LOB BREAKDOWN 2025\n`;
  byLob('2025').forEach(l => {
    ctx += `- ${l.lob}: ${fmt(l.serv)} (${l.n} deal)\n`;
  });

  ctx += `\n## AREA RAC BREAKDOWN 2026\n`;
  byArea('2026').forEach(a => {
    ctx += `- ${a.area}: ${fmt(a.serv)} | Diff: ${fmt(a.diff)} | Deal: ${a.n}\n`;
  });

  ctx += `\n## AREA RAC BREAKDOWN 2025\n`;
  byArea('2025').forEach(a => {
    ctx += `- ${a.area}: ${fmt(a.serv)} | Diff: ${fmt(a.diff)} | Deal: ${a.n}\n`;
  });

  ctx += `\n## TOP RAC 2026\n`;
  byRac('2026').slice(0, 15).forEach((r, i) => {
    ctx += `${i+1}. ${r.rac} | Area: ${r.area} | ${fmt(r.serv)} | Deal: ${r.n}\n`;
  });

  return ctx;
}

// ─── Domande suggerite ────────────────────────────────────────────
const SUGGESTED = [
  "Come sta andando il 2026 rispetto al 2025?",
  "Top 5 clienti per portafoglio 2026",
  "Confronto LOB 2025 vs 2026",
  "Analisi attacco vs difesa per anno",
  "Quale area RAC performa meglio nel 2026?",
  "Clienti con differenziale più alto 2026",
  "Trend canoni 2024-2025-2026",
  "Quanti CTR vs TTV nel 2026?",
];

const SYSTEM_PROMPT = `Sei un assistente Business Intelligence esperto per TIM Enterprise.
Hai accesso ai dati reali del portafoglio commerciale (2024, 2025, 2026) forniti nel contesto.

REGOLE:
- Rispondi SEMPRE in italiano
- Usa i dati del contesto per rispondere con numeri precisi
- Formatta i valori in K/M (es. €2.3M, €450K)
- Usa tabelle markdown quando confronti più valori
- Evidenzia trend, anomalie e insight rilevanti
- Se ti chiedono di un cliente/RAC specifico non nel contesto, dillo chiaramente
- Sii conciso ma completo — il tuo utente è un manager commerciale
- Aggiungi sempre un'osservazione finale o suggerimento di analisi`;

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnno, setLoadingAnno] = useState('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [context, setContext] = useState('');
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    loadAll();
    return () => { cancelRef.current = true; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    cancelRef.current = false;
    let all = [];
    try {
      for (const anno of ['2024', '2025', '2026']) {
        if (cancelRef.current) break;
        setLoadingAnno(anno);
        const d = await loadDealsForAnno(anno);
        all = [...all, ...d];
        setLoadedCount(all.length);
      }
      setDeals(all);
      setContext(buildContext(all));
    } catch (e) {
      setError('Errore caricamento dati: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = useCallback(async (text) => {
    const raw = (text || input).trim();
    if (!raw || sending || loading) return;
    setInput('');
    setSending(true);
    setError(null);

    const userMsg = { role: 'user', content: raw };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT + '\n\n' + context,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Errore nella risposta.';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError('Errore API: ' + e.message);
      setMessages([...newMessages, { role: 'assistant', content: '⚠️ Errore nella comunicazione con l\'AI. Riprova.' }]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, loading, context]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => setMessages([]);

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
            <p className="text-xs text-gray-400">Analisi portafoglio 2024 / 2025 / 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            loading ? 'border-orange-200 bg-orange-50 text-orange-600'
            : error ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {loading ? (
              <><Loader2 className="w-3 h-3 animate-spin" /><span>Caricamento {loadingAnno}... {loadedCount.toLocaleString('it-IT')}</span></>
            ) : error ? (
              <><span>Errore dati</span></>
            ) : (
              <><Database className="w-3 h-3" /><span>{deals.length.toLocaleString('it-IT')} record pronti</span></>
            )}
          </div>
          <button onClick={loadAll} disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {messages.length > 0 && (
            <button onClick={clearChat}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              Nuova chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Welcome screen */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[60%] text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
              <BarChart2 className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ciao! Sono il tuo analista BI</h2>
            <p className="text-sm text-gray-500 mb-1 max-w-md">
              Ho caricato <strong>{deals.length.toLocaleString('it-IT')} deal</strong> del portafoglio TIM Enterprise.
              Chiedimi qualsiasi analisi su clienti, aree, LOB e trend.
            </p>
            <p className="text-xs text-gray-400 mb-8 max-w-md">
              Rispondo con numeri reali, tabelle comparative e insight commerciali.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all text-gray-600 hover:text-blue-700 disabled:opacity-40 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading welcome */}
        {messages.length === 0 && loading && (
          <div className="flex flex-col items-center justify-center min-h-[60%] gap-4 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Caricamento dati in corso...</p>
              <p className="text-xs mt-1">Anno {loadingAnno} · {loadedCount.toLocaleString('it-IT')} record</p>
              <p className="text-xs text-gray-300 mt-1">Questo richiede qualche minuto per ~150k record</p>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-100 text-gray-700'
            }`}>
              {m.role === 'assistant' ? (
                <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:font-semibold [&_th]:text-gray-600 [&_td]:text-gray-700">
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

        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span className="text-xs text-gray-400">Analisi in corso...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions dopo prima risposta */}
      {messages.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.slice(0, 4).map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)}
              disabled={sending || loading}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 transition-colors disabled:opacity-40 border border-transparent hover:border-blue-200">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder={loading ? 'Caricamento dati in corso...' : 'Chiedi un\'analisi: "Come sta andando il 2026?", "Top clienti MNO", "Confronto LOB"...'}
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Invio per inviare · Shift+Invio per a capo</p>
      </div>
    </div>
  );
}
