import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AmbitoChart({ data, anno }) {
  const filtered = data.filter(d => d.anno === anno);
  const total = filtered.reduce((s, d) => s + (d.serv_i_anno || 0), 0);

  const items = filtered.map(d => ({
    name: d.ambito || 'N/D',
    value: +(d.serv_i_anno || 0).toFixed(0),
    pct: total > 0 ? ((d.serv_i_anno / total) * 100).toFixed(1) : '0',
  })).sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={items}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          dataKey="value"
          label={({ name, pct }) => `${name} ${pct}%`}
          labelLine={false}
        >
          {items.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={v => [`€${(v / 1_000_000).toFixed(2)}M`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}