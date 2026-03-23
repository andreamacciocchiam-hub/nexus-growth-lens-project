import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, X } from 'lucide-react';

/**
 * Mostra i portafogli clienti disponibili.
 * Quando selezionato, filtra i deal in base ai CF del portafoglio.
 * Espone: value (portafoglio_nome selezionato), onCFsChange (array di CF da filtrare, null = tutti)
 */
export default function PortafoglioClienteFilter({ value, onChange }) {
  const [portafogli, setPortafogli] = useState([]);
  const [anni, setAnni] = useState({ '2025': true, '2026': true });

  useEffect(() => {
    base44.entities.PortafoglioCliente.list(null, 10000).then(rows => {
      const set = new Set(rows.map(r => r.portafoglio_nome).filter(Boolean));
      setPortafogli(Array.from(set).sort());
    });
  }, []);

  if (portafogli.length === 0) return null;

  const handleChange = (pf) => {
    const next = pf === value ? null : pf;
    onChange({ portafoglio_nome: next, anni: Object.keys(anni).filter(a => anni[a]) });
  };

  const toggleAnno = (a) => {
    const next = { ...anni, [a]: !anni[a] };
    setAnni(next);
    if (value) onChange({ portafoglio_nome: value, anni: Object.keys(next).filter(k => next[k]) });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
        <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <span className="text-xs text-gray-500 font-medium">Ptf Clienti:</span>
        <div className="flex gap-1">
          <button
            onClick={() => onChange({ portafoglio_nome: null, anni: Object.keys(anni).filter(a => anni[a]) })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              !value ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Tutti
          </button>
          {portafogli.map(p => (
            <button
              key={p}
              onClick={() => handleChange(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                value === p ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {value && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Anno:</span>
          {['2025', '2026'].map(a => (
            <button
              key={a}
              onClick={() => toggleAnno(a)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                anni[a] ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}