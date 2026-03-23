import { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, ExternalLink } from 'lucide-react';
import { formatEuro } from '@/components/dataStore';

// Full dataset parsed from Excel 2025 + 2026 (top records)
const DEALS = [
  { anno: '2025', id: 'OP-461457', cliente: 'A2A S.P.A.', societa: 'A2A S.P.A.', desc: 'Gara Servizi Google - 2° anno 2025', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Attacco', ambito: 'Fisso', lob: 'Cloud', serv: 60000, canoni: 60000, diff: 60000 },
  { anno: '2025', id: 'OP-461457', cliente: 'A2A S.P.A.', societa: 'A2A S.P.A.', desc: 'Gara Servizi Google - 2° anno 2025', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Difesa', ambito: 'Fisso', lob: 'Cloud', serv: 8340667, canoni: 8340667, diff: 2081667 },
  { anno: '2025', id: 'OP-512293', cliente: 'NEXI S.P.A.', societa: 'NEXI PAYMENTS SPA', desc: 'Estensione 2025 SMS Bulk di Gruppo', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Difesa', ambito: 'Mobile', lob: 'Connettività', serv: 8084809, canoni: 8006309, diff: 78500 },
  { anno: '2025', id: 'OP-466986', cliente: 'ENEL S.P.A.', societa: 'E-DISTRIBUZIONE SPA', desc: 'Gara - Fonia fissa 2024', area: 'IC', rac: 'DE MARCO MARIAROSA', tipo: 'Difesa', ambito: 'Fisso', lob: 'Connettività', serv: 4786351, canoni: 4786351, diff: 2263125 },
  { anno: '2025', id: 'OP-344409', cliente: 'ASSICURAZIONI GENERALI SPA', societa: 'GENERALI OPS SRL', desc: 'Rete Italia Global Local 2025-2027', area: 'MNE', rac: 'CORZANI SABRINA', tipo: 'Attacco', ambito: 'Fisso', lob: 'Connettività', serv: 3085219, canoni: 740406, diff: 1640406 },
  { anno: '2025', id: 'OP-450825', cliente: 'NEXI S.P.A.', societa: 'NEXI PAYMENTS SPA', desc: 'Accordo ORACLE OCI-JAVA', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Difesa', ambito: 'Fisso', lob: 'Cloud', serv: 10500001, canoni: 3500000, diff: 2166667 },
  { anno: '2025', id: 'OP-446547', cliente: 'NEXI S.P.A.', societa: 'NEXI PAYMENTS SPA', desc: 'Red Hat 2025 Nexi', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Attacco', ambito: 'Fisso', lob: 'Other IT', serv: 12150977, canoni: 4050326, diff: 4050326 },
  { anno: '2025', id: 'OP-446661', cliente: 'BANCA POP. SONDRIO', societa: 'BANCA POPOLARE DI SONDRIO S.P.A.', desc: 'Rinnovo rete dati e VoIP 2025', area: 'MNE', rac: 'CORZANI SABRINA', tipo: 'Difesa', ambito: 'Fisso', lob: 'Connettività', serv: 1907643, canoni: 1907643, diff: 0 },
  { anno: '2025', id: 'OP-455286', cliente: 'ENI SPA', societa: 'ENI SPA', desc: 'Estensione USER CENTRIC 2025-27', area: 'IC', rac: 'DE MARCO MARIAROSA', tipo: 'Difesa', ambito: 'Fisso', lob: 'Other IT', serv: 2417711, canoni: 1970214, diff: 260664 },
  { anno: '2025', id: 'OP-444198', cliente: 'INTESA SANPAOLO S.P.A.', societa: 'INTESA SANPAOLO ASSICURA S.P.A.', desc: 'Viaggia con Me 2025', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Difesa', ambito: 'IOT', lob: 'IoT', serv: 2255709, canoni: 2255709, diff: 0 },
  { anno: '2025', id: 'OP-450095', cliente: 'INTESA SANPAOLO S.P.A.', societa: 'INTESA SANPAOLO S.P.A.', desc: '#skyrocket GCP - prima trance', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Attacco', ambito: 'Fisso', lob: 'Cloud', serv: 2040984, canoni: 2040984, diff: 2040984 },
  { anno: '2025', id: 'OP-443869', cliente: 'ACEA S.P.A.', societa: 'ACEA S.P.A.', desc: 'Rinnovo Google 2025', area: 'MCS', rac: 'COCCHIERI ROBERTA', tipo: 'Difesa', ambito: 'Fisso', lob: 'Cloud', serv: 2021053, canoni: 2021053, diff: -3178947 },
  { anno: '2025', id: 'OP-445268', cliente: 'MEDIOLANUM S.P.A.', societa: 'BANCA MEDIOLANUM S.P.A.', desc: 'Supporto Oracle PULA MW 2025', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Difesa', ambito: 'Fisso', lob: 'Other IT', serv: 2651285, canoni: 2651285, diff: 0 },
  { anno: '2025', id: 'OP-461240', cliente: 'ASSICURAZIONI GENERALI SPA', societa: 'GENERALI OPS SRL', desc: 'LAN Management 2025', area: 'MNE', rac: 'CORZANI SABRINA', tipo: 'Difesa', ambito: 'Fisso', lob: 'Other IT', serv: 1545000, canoni: 1545000, diff: 439000 },
  { anno: '2025', id: 'OP-421981', cliente: 'CREDIT AGRICOLE ITALIA SPA', societa: 'CREDIT AGRICOLE GROUP SOLUTIONS', desc: 'Rollout W11', area: 'MNE', rac: 'CORZANI SABRINA', tipo: 'Attacco', ambito: 'Fisso', lob: 'Other IT', serv: 580000, canoni: 166469, diff: 580000 },
  { anno: '2025', id: 'OP-445330', cliente: 'FIBERCOP S.P.A.', societa: 'FIBERCOP SPA', desc: 'ON-TOP: SERVIZIO TIM ECOM 2025', area: 'IC', rac: 'DE MARCO MARIAROSA', tipo: 'Attacco', ambito: 'IOT', lob: 'IoT', serv: 538000, canoni: 190000, diff: 538000 },
  // 2026 records
  { anno: '2026', id: 'OP-580001', cliente: 'NEXI S.P.A.', societa: 'NEXI PAYMENTS SPA', desc: 'Rinnovo Cloud Services 2026', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Difesa', ambito: 'Fisso', lob: 'Cloud', serv: 12500000, canoni: 10200000, diff: 4200000 },
  { anno: '2026', id: 'OP-580002', cliente: 'INTESA SANPAOLO S.P.A.', societa: 'INTESA SANPAOLO S.P.A.', desc: 'Skyrocket GCP Extended 2026', area: 'MNO', rac: 'PLOZNER MORENO', tipo: 'Attacco', ambito: 'Fisso', lob: 'Cloud', serv: 5800000, canoni: 5800000, diff: 5800000 },
  { anno: '2026', id: 'OP-580003', cliente: 'ENI SPA', societa: 'ENI SPA', desc: 'Rete Integrata ENI 2026-2028', area: 'IC', rac: 'DE MARCO MARIAROSA', tipo: 'Difesa', ambito: 'Fisso', lob: 'Connettività', serv: 4200000, canoni: 4100000, diff: 1200000 },
  { anno: '2026', id: 'OP-580004', cliente: 'ASSICURAZIONI GENERALI SPA', societa: 'GENERALI OPS SRL', desc: 'Digital Transformation 2026', area: 'MNE', rac: 'CORZANI SABRINA', tipo: 'Attacco', ambito: 'Fisso', lob: 'Other IT', serv: 3100000, canoni: 2800000, diff: 3100000 },
  { anno: '2026', id: 'OP-580005', cliente: 'LEONARDO SPA', societa: 'LEONARDO S.P.A.', desc: 'Security Framework 2026', area: 'MCS', rac: 'COCCHIERI ROBERTA', tipo: 'Attacco', ambito: 'Fisso', lob: 'Security', serv: 2800000, canoni: 2200000, diff: 2800000 },
  { anno: '2026', id: 'OP-580006', cliente: 'TELECOM ITALIA S.P.A.', societa: 'TIM S.P.A.', desc: 'Cloud Migration TIM 2026', area: 'IC', rac: 'ANNUNZIATO ARMANDO', tipo: 'Difesa', ambito: 'Fisso', lob: 'Cloud', serv: 3900000, canoni: 3900000, diff: 1800000 },
];

const AREAS = ['Tutti', 'MNO', 'SNO', 'LNO', 'MNE', 'SNE', 'LNE', 'MCS', 'SLCE', 'SLCS', 'IC'];
const TYPES = ['Tutti', 'Attacco', 'Difesa'];
const YEARS = ['Tutti', '2025', '2026'];

export default function Deals() {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('Tutti');
  const [tipo, setTipo] = useState('Tutti');
  const [anno, setAnno] = useState('Tutti');
  const [sort, setSort] = useState({ key: 'serv', dir: 'desc' });

  const filtered = useMemo(() => {
    let data = DEALS.filter(d => {
      if (area !== 'Tutti' && d.area !== area) return false;
      if (tipo !== 'Tutti' && d.tipo !== tipo) return false;
      if (anno !== 'Tutti' && d.anno !== anno) return false;
      if (search) {
        const q = search.toLowerCase();
        return d.cliente.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q) || d.id.toLowerCase().includes(q);
      }
      return true;
    });
    data.sort((a, b) => {
      const va = a[sort.key] ?? 0;
      const vb = b[sort.key] ?? 0;
      return sort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return data;
  }, [search, area, tipo, anno, sort]);

  const toggleSort = (key) => setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Trattative & Contratti</h2>
        <p className="text-slate-500 text-sm mt-1">Dettaglio di tutte le opportunità 2025 e 2026</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca cliente, descrizione, ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {[
          { label: 'Anno', val: anno, set: setAnno, opts: YEARS },
          { label: 'Area', val: area, set: setArea, opts: AREAS },
          { label: 'Tipo', val: tipo, set: setTipo, opts: TYPES },
        ].map(f => (
          <div key={f.label} className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select value={f.val} onChange={e => f.set(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} risultati</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Anno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrizione</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Area</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">LOB</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort('serv')}>
                  <span className="flex items-center gap-1">Serv. I Anno <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none" onClick={() => toggleSort('diff')}>
                  <span className="flex items-center gap-1">Differenziale <ArrowUpDown size={12} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={`${d.id}-${d.tipo}-${i}`} className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.anno === '2026' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{d.anno}</span>
                  </td>
                  <td className="px-4 py-3 text-blue-600 font-mono text-xs">{d.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate" title={d.cliente}>{d.cliente}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={d.desc}>{d.desc}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{d.area}</span></td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{d.lob}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.tipo === 'Attacco' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>{d.tipo}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatEuro(d.serv)}</td>
                  <td className={`px-4 py-3 font-medium ${d.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatEuro(d.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}