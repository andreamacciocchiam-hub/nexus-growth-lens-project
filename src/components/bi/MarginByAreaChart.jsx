import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = { '2024': '#9ca3af', '2025': '#a855f7', '2026': '#06b6d4' };
const AREAS = ['MNO','SNO','LNO','MNE','SNE','LNE','MCS','SLCE','SLCS','IC'];

export default function MarginByAreaChart({ data }) {
  if (!data || !Array.isArray(data)) return null;

  const chartData = AREAS.map(area => {
    const d24 = data.find(d => d.anno === '2024' && d.area_rac === area);
    const d25 = data.find(d => d.anno === '2025' && d.area_rac === area);
    const d26 = data.find(d => d.anno === '2026' && d.area_rac === area);
    
    return {
      area,
      '2024': d24?.differenziale_servizi || 0,
      '2025': d25?.differenziale_servizi || 0,
      '2026': d26?.differenziale_servizi || 0,
    };
  }).filter(d => d['2024'] !== 0 || d['2025'] !== 0 || d['2026'] !== 0);

  const formatYAxis = (value) => {
    if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
    return `€${value}`;
  };

  const formatTooltip = (value) => {
    if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(1)}K`;
    return `€${value.toFixed(0)}`;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="area" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} />
        <Tooltip 
          formatter={formatTooltip}
          labelStyle={{ color: '#333' }}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', fontSize: '11px' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        <Bar dataKey="2024" fill={COLORS['2024']} radius={[4, 4, 0, 0]} />
        <Bar dataKey="2025" fill={COLORS['2025']} radius={[4, 4, 0, 0]} />
        <Bar dataKey="2026" fill={COLORS['2026']} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}