import { X, TrendingUp, TrendingDown } from 'lucide-react';

function fmt(v) {
  if (!v) return '€0';
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${v.toFixed(0)}`;
}

function groupBy(deals, key, valueKey = 'serv_i_anno') {
  const map = {};
  for (const d of deals) {
    const k = d[key] || '(vuoto)';
    if (!map[k]) map[k] = { label: k, value: 0, count: 0 };
    map[k].value += d[valueKey] || 0;
    map[k].count++;
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

function BreakdownTable({ title, rows, total }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1">
        {rows.slice(0, 8).map((r, i) => {
          const pct = total > 0 ? (r.value / total) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-24 text-xs text-gray-600 truncate shrink-0">{r.label}</div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs font-semibold text-gray-700 w-20 text-right shrink-0">{fmt(r.value)}</div>
              <div className="text-xs text-gray-400 w-10 text-right shrink-0">{r.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KPIDetailModal({ kpiType, deals, onClose }) {
  if (!kpiType || !deals) return null;

  const deals25 = deals.filter(d => String(d.anno) === '2025');
  const deals26 = deals.filter(d => String(d.anno) === '2026');

  const sum = (arr, key) => arr.reduce((s, d) => s + (d[key] || 0), 0);

  const getContent = () => {
    if (kpiType === '2026') {
      const total = sum(deals26, 'serv_i_anno');
      return {
        title: 'Dettaglio Portafoglio 2026',
        color: 'blue',
        sections: [
          { title: 'Per Area RAC', rows: groupBy(deals26, 'area_rac'), total },
          { title: 'Per LOB', rows: groupBy(deals26, 'lob'), total },
          { title: 'Per Mese', rows: groupBy(deals26, 'mese').sort((a,b)=> a.label - b.label), total },
          { title: 'Top Clienti', rows: groupBy(deals26, 'ragione_sociale').slice(0, 8), total },
        ],
        summary: [
          { label: 'Serv. I Anno', value: fmt(total) },
          { label: 'Canoni', value: fmt(sum(deals26, 'canoni')) },
          { label: 'Differenziale', value: fmt(sum(deals26, 'differenziale_servizi')) },
          { label: 'Tot. CTR', value: fmt(sum(deals26, 'tot_ctr')) },
          { label: 'N° Contratti', value: deals26.length.toLocaleString('it-IT') },
        ]
      };
    }
    if (kpiType === '2025') {
      const total = sum(deals25, 'serv_i_anno');
      return {
        title: 'Dettaglio Portafoglio 2025',
        color: 'purple',
        sections: [
          { title: 'Per Area RAC', rows: groupBy(deals25, 'area_rac'), total },
          { title: 'Per LOB', rows: groupBy(deals25, 'lob'), total },
          { title: 'Per Mese', rows: groupBy(deals25, 'mese').sort((a,b)=> a.label - b.label), total },
          { title: 'Top Clienti', rows: groupBy(deals25, 'ragione_sociale').slice(0, 8), total },
        ],
        summary: [
          { label: 'Serv. I Anno', value: fmt(total) },
          { label: 'Canoni', value: fmt(sum(deals25, 'canoni')) },
          { label: 'Differenziale', value: fmt(sum(deals25, 'differenziale_servizi')) },
          { label: 'Tot. CTR', value: fmt(sum(deals25, 'tot_ctr')) },
          { label: 'N° Contratti', value: deals25.length.toLocaleString('it-IT') },
        ]
      };
    }
    if (kpiType === 'diff') {
      const areas = [...new Set(deals.map(d => d.area_rac).filter(Boolean))].sort();
      const rows = areas.map(area => {
        const s25 = sum(deals25.filter(d => d.area_rac === area), 'serv_i_anno');
        const s26 = sum(deals26.filter(d => d.area_rac === area), 'serv_i_anno');
        return { area, s25, s26, diff: s26 - s25, pct: s25 > 0 ? ((s26 - s25) / s25 * 100) : null };
      }).filter(r => r.s25 > 0 || r.s26 > 0).sort((a, b) => b.diff - a.diff);
      return { title: 'Differenziale 2026 vs 2025', color: 'green', rows };
    }
    if (kpiType === 'contratti') {
      const lobRows = [...new Set(deals.map(d => d.lob).filter(Boolean))].map(lob => ({
        lob,
        n25: deals25.filter(d => d.lob === lob).length,
        n26: deals26.filter(d => d.lob === lob).length,
        val25: sum(deals25.filter(d => d.lob === lob), 'serv_i_anno'),
        val26: sum(deals26.filter(d => d.lob === lob), 'serv_i_anno'),
      })).sort((a, b) => (b.n25 + b.n26) - (a.n25 + a.n26));
      return { title: 'Dettaglio Contratti per LOB', color: 'orange', lobRows };
    }
  };

  const content = getContent();

  const colorMap = {
    blue: 'bg-blue-600', purple: 'bg-purple-600', green: 'bg-green-600', orange: 'bg-orange-500'
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-2xl shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${colorMap[content.color]} text-white px-6 py-4 flex items-center justify-between`}>
          <h2 className="text-base font-bold">{content.title}</h2>
          <button onClick={onClose} className="hover:bg-white/20 rounded-lg p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary pills */}
          {content.summary && (
            <div className="grid grid-cols-5 gap-2">
              {content.summary.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                  <div className="text-sm font-bold text-gray-800">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Breakdown sections */}
          {content.sections && content.sections.map((sec, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <BreakdownTable title={sec.title} rows={sec.rows} total={sec.total} />
            </div>
          ))}

          {/* Differenziale table */}
          {content.rows && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Variazione per Area RAC</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200">
                    <th className="text-left py-2 font-medium">Area</th>
                    <th className="text-right py-2 font-medium">2025</th>
                    <th className="text-right py-2 font-medium">2026</th>
                    <th className="text-right py-2 font-medium">Diff.</th>
                    <th className="text-right py-2 font-medium">Var%</th>
                  </tr>
                </thead>
                <tbody>
                  {content.rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-white">
                      <td className="py-2 font-semibold text-gray-700">{r.area}</td>
                      <td className="py-2 text-right text-gray-600">{fmt(r.s25)}</td>
                      <td className="py-2 text-right text-gray-800 font-medium">{fmt(r.s26)}</td>
                      <td className={`py-2 text-right font-semibold ${r.diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.diff >= 0 ? '+' : ''}{fmt(r.diff)}
                      </td>
                      <td className={`py-2 text-right font-semibold ${r.pct === null ? 'text-gray-400' : r.pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.pct === null ? '—' : `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Contratti LOB table */}
          {content.lobRows && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contratti per Line of Business</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200">
                    <th className="text-left py-2 font-medium">LOB</th>
                    <th className="text-right py-2 font-medium">N° 2025</th>
                    <th className="text-right py-2 font-medium">N° 2026</th>
                    <th className="text-right py-2 font-medium">Val. 2025</th>
                    <th className="text-right py-2 font-medium">Val. 2026</th>
                  </tr>
                </thead>
                <tbody>
                  {content.lobRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-white">
                      <td className="py-2 font-medium text-gray-700">{r.lob}</td>
                      <td className="py-2 text-right text-gray-600">{r.n25}</td>
                      <td className="py-2 text-right text-gray-800 font-semibold">{r.n26}</td>
                      <td className="py-2 text-right text-gray-600">{fmt(r.val25)}</td>
                      <td className="py-2 text-right text-gray-800 font-semibold">{fmt(r.val26)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}