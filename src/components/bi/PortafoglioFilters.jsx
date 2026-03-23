import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { PORTAFOGLI } from './DealsFilters';

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${selected.length > 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
      >
        {label}{selected.length > 0 && <span className="bg-blue-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{selected.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[160px] max-h-56 overflow-y-auto">
          {options.length === 0 && <div className="text-xs text-gray-400 px-2 py-1">Nessuna opzione</div>}
          {options.map(o => (
            <label key={o} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-xs text-gray-700">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="accent-blue-500" />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function applyPortafoglioFilters(rows, filters) {
  return rows.filter(r => {
    if (filters.portafoglio.length > 0 && !filters.portafoglio.includes(r.portafoglio_nome)) return false;
    if (filters.rac_26.length > 0 && !filters.rac_26.includes(r.rac_26)) return false;
    if (filters.area_mng_26.length > 0 && !filters.area_mng_26.includes(r.area_mng_26)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!['ragione_sociale','capogruppo'].some(k => String(r[k] ?? '').toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

export const EMPTY_PTF_FILTERS = { portafoglio: [], rac_26: [], area_mng_26: [], search: '' };

export default function PortafoglioFilters({ rows, filters, onChange }) {
  const opts = useMemo(() => {
    const rac26 = [...new Set(rows.map(r => r.rac_26).filter(Boolean))].sort();
    const area26 = [...new Set(rows.map(r => r.area_mng_26).filter(Boolean))].sort();
    return { rac26, area26 };
  }, [rows]);

  const hasFilters = filters.portafoglio.length > 0 || filters.rac_26.length > 0 || filters.area_mng_26.length > 0 || filters.search;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
      <input
        value={filters.search}
        onChange={e => onChange({ ...filters, search: e.target.value })}
        placeholder="Cerca ragione sociale / capogruppo..."
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
      />
      <MultiSelect label="Portafoglio" options={PORTAFOGLI} selected={filters.portafoglio} onChange={v => onChange({ ...filters, portafoglio: v })} />
      <MultiSelect label="RAC 2026" options={opts.rac26} selected={filters.rac_26} onChange={v => onChange({ ...filters, rac_26: v })} />
      <MultiSelect label="Area MNG 2026" options={opts.area26} selected={filters.area_mng_26} onChange={v => onChange({ ...filters, area_mng_26: v })} />
      {hasFilters && (
        <button onClick={() => onChange(EMPTY_PTF_FILTERS)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 ml-1">
          <X className="w-3.5 h-3.5" /> Reset
        </button>
      )}
    </div>
  );
}