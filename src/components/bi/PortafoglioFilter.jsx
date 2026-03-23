import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Layers } from 'lucide-react';

export default function PortafoglioFilter({ value, onChange }) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    base44.entities.Deal.list(null, 1000).then(deals => {
      const set = new Set(deals.map(d => d.portafoglio).filter(Boolean));
      setOptions(Array.from(set).sort());
    });
  }, []);

  if (options.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
      <Layers className="w-4 h-4 text-blue-500 flex-shrink-0" />
      <span className="text-xs text-gray-500 font-medium">Portafoglio:</span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange('')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            !value ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Tutti
        </button>
        {options.map(p => (
          <button
            key={p}
            onClick={() => onChange(p === value ? '' : p)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              value === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}