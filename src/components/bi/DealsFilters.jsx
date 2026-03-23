import { useMemo, useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';

const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
export const PORTAFOGLI = ['IoT', 'Cloud Strategic', 'Cloud Large'];
export const EMPTY_FILTERS = {
  portafoglio: [], anno: [], mese: [], rac: [], area_mng: [],
  struttura_sales: [], tipo: [], lob: [], attacco_difesa: []
};

function MultiSelect({ label, k, options, filters, onChange, labelFn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = filters[k] || [];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    const cur = filters[k] || [];
    const next = cur.includes(String(val)) ? cur.filter(v => v !== String(val)) : [...cur, String(val)];
    onChange({ ...filters, [k]: next });
  };

  const active = selected.length > 0;

  return (
    <div className="relative flex flex-col gap-1 min-w-[120px]" ref={ref}>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          active ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'
        }`}
      >
        <span className="truncate max-w-[100px]">
          {selected.length === 0 ? 'Tutti'
            : selected.length === 1 ? (labelFn ? labelFn(selected[0]) : selected[0])
            : `${selected.length} sel.`}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] max-h-56 overflow-y-auto">
          {selected.length > 0 && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100"
              onClick={() => onChange({ ...filters, [k]: [] })}
            >
              <X className="w-3 h-3" /> Deseleziona tutti
            </button>
          )}
          {options.map((o, i) => {
            const isChecked = selected.includes(String(o));
            return (
              <button
                key={i}
                onClick={() => toggle(String(o))}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors ${isChecked ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {labelFn ? labelFn(o) : o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function applyFilters(deals, filters) {
  const match = (arr, val) => !arr || arr.length === 0 || arr.includes(String(val));
  return deals.filter(d => {
    if (!match(filters.portafoglio, d.portafoglio)) return false;
    if (!match(filters.anno, d.anno)) return false;
    if (!match(filters.mese, d.mese)) return false;
    if (!match(filters.rac, d.rac)) return false;
    if (!match(filters.area_mng, d.area_mng)) return false;
    if (!match(filters.struttura_sales, d.struttura_sales)) return false;
    if (!match(filters.tipo, d.tipo)) return false;
    if (!match(filters.lob, d.lob)) return false;
    if (!match(filters.attacco_difesa, d.attacco_difesa)) return false;
    return true;
  });
}

export default function DealsFilters({ deals, filters, onChange }) {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();

  const opts = useMemo(() => {
    const byPtf = filters.portafoglio.length > 0
      ? deals.filter(d => filters.portafoglio.includes(String(d.portafoglio)))
      : deals;
    const byAnno = filters.anno.length > 0
      ? byPtf.filter(d => filters.anno.includes(String(d.anno)))
      : byPtf;

    return {
      portafoglio: PORTAFOGLI,
      anno: ['2024', '2025', '2026'],
      mese: [1,2,3,4,5,6,7,8,9,10,11,12],
      rac: uniq(byAnno.map(d => d.rac)),
      area_mng: uniq(byAnno.map(d => d.area_mng)),
      struttura_sales: uniq(byAnno.map(d => d.struttura_sales)),
      tipo: ['CTR', 'TTV'],
      lob: uniq(byAnno.map(d => d.lob)).filter(v => v && isNaN(Number(v))),
      attacco_difesa: ['Attacco', 'Difesa'],
    };
  }, [deals, filters.portafoglio, filters.anno]);

  const hasActive = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v !== '');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">Filtri</span>
          {hasActive && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">ATTIVI</span>}
        </div>
        {hasActive && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <MultiSelect label="Portafoglio" k="portafoglio" options={opts.portafoglio} filters={filters} onChange={onChange} />
        <MultiSelect label="Anno" k="anno" options={opts.anno} filters={filters} onChange={onChange} />
        <MultiSelect label="Mese" k="mese" options={opts.mese} filters={filters} onChange={onChange} labelFn={m => MESI[Number(m) - 1]} />
        <MultiSelect label="RAC" k="rac" options={opts.rac} filters={filters} onChange={onChange} />
        <MultiSelect label="Area MNG" k="area_mng" options={opts.area_mng} filters={filters} onChange={onChange} />
        <MultiSelect label="Struttura Sales" k="struttura_sales" options={opts.struttura_sales} filters={filters} onChange={onChange} />
        <MultiSelect label="Tipo" k="tipo" options={opts.tipo} filters={filters} onChange={onChange} />
        <MultiSelect label="LOB" k="lob" options={opts.lob} filters={filters} onChange={onChange} />
        <MultiSelect label="Attacco/Difesa" k="attacco_difesa" options={opts.attacco_difesa} filters={filters} onChange={onChange} />
      </div>
    </div>
  );
}