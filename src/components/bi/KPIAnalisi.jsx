export default function KPIAnalisi({ deals }) {
  const sum = (field) => deals.reduce((acc, d) => acc + (Number(d[field]) || 0), 0);

  const fmt = (v) => {
    if (!v && v !== 0) return '—';
    if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
    return `€${v.toFixed(0)}`;
  };

  const kpis = [
    { label: 'Tot CTR', value: fmt(sum('tot_ctr')), color: 'blue' },
    { label: 'Ric I Anno', value: fmt(sum('ric_i_anno')), color: 'indigo' },
    { label: 'Servizi Totali', value: fmt(sum('servizi_totali')), color: 'violet' },
    { label: 'Serv I Anno', value: fmt(sum('serv_i_anno')), color: 'purple' },
    { label: 'Di cui Canoni', value: fmt(sum('canoni')), color: 'sky' },
    { label: 'Di cui A/R', value: fmt(sum('ar')), color: 'cyan' },
    { label: 'Di cui UT', value: fmt(sum('ut')), color: 'teal' },
    { label: 'Diff. Servizi', value: fmt(sum('differenziale_servizi')), color: 'emerald' },
    { label: 'Vendita', value: fmt(sum('vendita')), color: 'green' },
    { label: 'N. Deal', value: deals.length.toLocaleString('it-IT'), color: 'gray', isCount: true },
  ];

  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    sky: 'bg-sky-50 border-sky-200 text-sky-800',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    teal: 'bg-teal-50 border-teal-200 text-teal-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const labelColor = {
    blue: 'text-blue-500', indigo: 'text-indigo-500', violet: 'text-violet-500',
    purple: 'text-purple-500', sky: 'text-sky-500', cyan: 'text-cyan-500',
    teal: 'text-teal-500', emerald: 'text-emerald-500', green: 'text-green-500', gray: 'text-gray-500',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">KPI Analisi (dati filtrati)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border px-3 py-2.5 ${colorMap[color]}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${labelColor[color]}`}>{label}</p>
            <p className="text-sm font-bold leading-tight">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}