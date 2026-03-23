import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MonthlyTrendChart({ data }) {
  if (!data || !Array.isArray(data)) return null;

  // Aggregate data by month and year
  const monthlyData = {};
  data.forEach(deal => {
    if (!deal.mese || deal.mese < 1 || deal.mese > 12) return;
    const key = `${deal.mese}`;
    if (!monthlyData[key]) {
      monthlyData[key] = { mese: deal.mese, 'Ricavi 2025': 0, 'Ricavi 2026': 0, 'Margini 2025': 0, 'Margini 2026': 0 };
    }
    const ricarboKey = deal.anno === '2025' ? 'Ricavi 2025' : 'Ricavi 2026';
    const marginKey = deal.anno === '2025' ? 'Margini 2025' : 'Margini 2026';
    monthlyData[key][ricarboKey] += deal.serv_i_anno || 0;
    monthlyData[key][marginKey] += deal.differenziale_servizi || 0;
  });

  const chartData = Object.values(monthlyData).sort((a, b) => a.mese - b.mese);
  if (chartData.length === 0) return null;

  const formatYAxis = (value) => {
    if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(0)}M`;
    if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
    return `€${value}`;
  };

  const formatTooltip = (value) => {
    if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(1)}K`;
    return `€${value.toFixed(0)}`;
  };

  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="mese" 
          tickFormatter={(m) => months[m - 1]}
          tick={{ fontSize: 11 }}
        />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} />
        <Tooltip 
          formatter={formatTooltip}
          labelFormatter={(m) => months[m - 1]}
          labelStyle={{ color: '#333' }}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', fontSize: '11px' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        <Line type="monotone" dataKey="Ricavi 2025" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Ricavi 2026" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Margini 2025" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Margini 2026" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}