import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle, XCircle, RefreshCw, Database, AlertCircle } from 'lucide-react';

const ANNI = ['2024', '2025', '2026'];

async function countByAnno(anno) {
  try {
    let total = 0;
    const PAGE = 5000;
    let skip = 0;

    while (true) {
      const batch = await base44.entities.Deal.filter({ anno }, null, PAGE, skip);
      if (!batch || batch.length === 0) break;
      total += batch.length;
      if (batch.length < PAGE) break;
      skip += PAGE;
      await new Promise(r => setTimeout(r, 200));
    }

    return total;
  } catch (e) {
    console.error(`Error counting anno ${anno}:`, e);
    return null;
  }
}

export default function DataStatusPanel({ refreshTrigger }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const entries = await Promise.all(
        ANNI.map(async anno => [anno, await countByAnno(anno)])
      );
      setCounts(Object.fromEntries(entries));
      setLastChecked(new Date());
    } catch (e) {
      console.error('Error refreshing counts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refreshTrigger]);

  const getStatus = (anno) => {
    const count = counts[anno];
    if (count === undefined) return null;
    if (count === null) return { status: 'error', label: 'Errore lettura', color: 'red' };
    if (count === 0) return { status: 'empty', label: 'Nessun dato', color: 'gray' };
    return { status: 'complete', label: `${count.toLocaleString('it-IT')} record`, color: 'green' };
  };

  const statusIcon = (s) => {
    if (!s) return <RefreshCw className="w-4 h-4 text-gray-300 animate-pulse" />;
    if (s.status === 'complete') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s.status === 'empty') return <XCircle className="w-4 h-4 text-gray-400" />;
    if (s.status === 'error') return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Database className="w-4 h-4 text-blue-500" />;
  };

  const borderColor = (s) => {
    if (!s) return 'border-gray-100';
    if (s.status === 'complete') return 'border-l-green-400';
    if (s.status === 'empty') return 'border-l-gray-300';
    if (s.status === 'error') return 'border-l-red-400';
    return 'border-l-blue-400';
  };

  const textColor = (s) => {
    if (!s) return 'text-gray-400';
    if (s.status === 'complete') return 'text-green-700';
    if (s.status === 'empty') return 'text-gray-400';
    if (s.status === 'error') return 'text-red-500';
    return 'text-blue-700';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-800">Stato Dati nel Database</h2>
          {lastChecked && (
            <span className="text-[10px] text-gray-400">
              · aggiornato alle {lastChecked.toLocaleTimeString('it-IT')}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ANNI.map(anno => {
          const s = getStatus(anno);
          return (
            <div key={anno} className={`rounded-xl border border-l-4 ${borderColor(s)} p-4 bg-gray-50`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Anno {anno}</span>
                  <div className="flex items-center gap-2 mt-1">
                    {loading ? (
                      <RefreshCw className="w-4 h-4 text-gray-300 animate-spin" />
                    ) : (
                      statusIcon(s)
                    )}
                    <span className={`text-sm font-semibold ${textColor(s)}`}>
                      {loading ? 'conteggio...' : (s?.label ?? '...')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}