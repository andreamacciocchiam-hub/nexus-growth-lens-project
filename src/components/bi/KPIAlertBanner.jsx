import { useState } from 'react';
import { AlertTriangle, Settings, X, ChevronDown, ChevronUp } from 'lucide-react';

const KPI_DEFS = [
  {
    key: 'diff_2026',
    label: 'Differenziale 2026',
    defaultThreshold: 0,
    unit: '€K',
    scale: 1000,
    drivers: [
      'Calo del mix attacco vs difesa: meno nuovi contratti acquisiti',
      'Riduzione durata contratti: minore serv_i_anno per deal',
      'Perdita clienti strategici nel portafoglio difesa',
      'Pressione competitiva su segmenti Mobile e IoT',
    ],
  },
  {
    key: 'ytd_2026',
    label: 'Portafoglio 2026',
    defaultThreshold: 0,
    unit: '€M',
    scale: 1_000_000,
    drivers: [
      'Volumi YTD inferiori alle attese del budget',
      'Scadenze contratti non rinnovate nel trimestre',
      'Mix area RAC sbilanciato verso aree a bassa crescita',
    ],
  },
  {
    key: 'diff_2025',
    label: 'Differenziale 2025',
    defaultThreshold: 0,
    unit: '€K',
    scale: 1000,
    drivers: [
      'Base 2024 elevata: effetto confronto sfavorevole',
      'Perdita quote in segmenti Large/Mid',
    ],
  },
];

function fmt(v, scale, unit) {
  const val = v / scale;
  if (unit === '€M') return `€${val.toFixed(1)}M`;
  return `€${val.toFixed(0)}K`;
}

export default function KPIAlertBanner({ values, onThresholdsChange }) {
  // values: { diff_2026, ytd_2026, diff_2025 }
  const [thresholds, setThresholds] = useState(() =>
    Object.fromEntries(KPI_DEFS.map(k => [k.key, k.defaultThreshold]))
  );
  const [showConfig, setShowConfig] = useState(false);
  const [expandedDrivers, setExpandedDrivers] = useState({});

  const updateThreshold = (key, val) => {
    const next = { ...thresholds, [key]: val };
    setThresholds(next);
    onThresholdsChange?.(next);
  };

  const alerts = KPI_DEFS.filter(k => {
    const v = values?.[k.key] ?? null;
    return v !== null && v < thresholds[k.key];
  });

  return (
    <div className="space-y-2">
      {/* Alert cards */}
      {alerts.map(kpi => {
        const v = values[kpi.key];
        const open = expandedDrivers[kpi.key];
        return (
          <div key={kpi.key} className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800">
                    {kpi.label}: {fmt(v, kpi.scale, kpi.unit)}
                    <span className="font-normal text-red-500 ml-2">
                      (soglia: {fmt(thresholds[kpi.key], kpi.scale, kpi.unit)})
                    </span>
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">Il valore è sceso sotto la soglia critica configurata</p>
                </div>
              </div>
              <button
                onClick={() => setExpandedDrivers(p => ({ ...p, [kpi.key]: !open }))}
                className="text-red-400 hover:text-red-600 flex items-center gap-1 text-xs font-medium ml-4 flex-shrink-0"
              >
                Driver di calo {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            {open && (
              <div className="px-4 pb-4 border-t border-red-100 pt-3">
                <p className="text-xs font-semibold text-red-700 mb-2">Possibili driver di calo:</p>
                <ul className="space-y-1">
                  {kpi.drivers.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                      <span className="text-red-400 font-bold flex-shrink-0 mt-0.5">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}

      {/* Config toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowConfig(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Configura soglie alert
          {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showConfig && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-700">Soglie di allerta KPI</p>
            <button onClick={() => setShowConfig(false)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {KPI_DEFS.map(kpi => (
              <div key={kpi.key}>
                <label className="text-xs text-gray-500 font-medium block mb-1">{kpi.label} ({kpi.unit})</label>
                <input
                  type="number"
                  value={thresholds[kpi.key] / kpi.scale}
                  onChange={e => updateThreshold(kpi.key, parseFloat(e.target.value || 0) * kpi.scale)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="0"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Alert se scende sotto questo valore</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}