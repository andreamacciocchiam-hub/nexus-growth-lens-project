import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AREA_LABELS = {
  MNO: 'MNO', SNO: 'SNO', LNO: 'LNO',
  MNE: 'MNE', SNE: 'SNE', LNE: 'LNE',
  MCS: 'MCS', SLCE: 'SLCE', SLCS: 'SLCS', IC: 'IC',
};

function fmt(v) {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${v.toFixed(0)}`;
}

export default function AreaChart({ data }) {
  const areas = Object.keys(AREA_LABELS);
  const chartData = areas.map(area => {
    const d24 = data.find(d => d.anno === '2024' && d.area_rac === area);
    const d25 = data.find(d => d.anno === '2025' && d.area_rac === area);
    const d26 = data.find(d => d.anno === '2026' && d.area_rac === area);
    return {
      area,
      '2024': +(((d24?.serv_i_anno || 0) / 1_000_000).toFixed(2)),
      '2025': +(((d25?.serv_i_anno || 0) / 1_000_000).toFixed(2)),
      '2026': +(((d26?.serv_i_anno || 0) / 1_000_000).toFixed(2)),
    };
  }).filter(d => d['2024'] > 0 || d['2025'] > 0 || d['2026'] > 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="area" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={v => `€${v}M`} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val, name) => [`€${val}M`, name]}
          labelFormatter={l => `Area: ${l}`}
        />
        <Legend />
        <Bar dataKey="2024" name="2024" fill="#9ca3af" radius={[3,3,0,0]} />
        <Bar dataKey="2025" name="2025" fill="#3b82f6" radius={[3,3,0,0]} />
        <Bar dataKey="2026" name="2026" fill="#10b981" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}