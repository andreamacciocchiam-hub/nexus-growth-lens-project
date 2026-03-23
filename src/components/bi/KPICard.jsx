export default function KPICard({ title, value, sub, delta, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-600' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className={`mt-3 text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
          <span className="text-gray-400 font-normal ml-1">vs anno prec.</span>
        </div>
      )}
    </div>
  );
}