import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, AlertTriangle, Loader2, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DeleteDataModal({ isOpen, onClose, onDeleted }) {
  const [step, setStep] = useState('select');
  const [annoSelected, setAnnoSelected] = useState('2026');
  const [message, setMessage] = useState('');
  const [deletedCount, setDeletedCount] = useState(0);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  const runDelete = async (anni) => {
    setStep('loading');
    setLogs([]);
    setDeletedCount(0);
    const anniArr = Array.isArray(anni) ? anni : [anni];
    addLog(`▶ Cancellazione via backend: anni ${anniArr.join(', ')}...`);

    try {
      const res = await base44.functions.invoke('bulkDeleteFast', { years: anniArr });
      const total = res.data?.totalDeleted ?? 0;
      setDeletedCount(total);
      addLog(`✓ Completato: ${total.toLocaleString('it-IT')} record eliminati`);
      setMessage(`Eliminati ${total.toLocaleString('it-IT')} record (anni: ${anniArr.join(', ')})`);
      setStep('done');
      onDeleted && onDeleted();
    } catch (e) {
      addLog(`✗ Errore: ${e.message}`);
      setMessage(`Errore durante la cancellazione: ${e.message}`);
      setStep('error');
    }
  };

  const reset = () => {
    setStep('select');
    setAnnoSelected('2026');
    setMessage('');
    setDeletedCount(0);
    setLogs([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" /> Elimina Dati
          </h2>
          <button onClick={() => { onClose(); reset(); }} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'select' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Anno da cancellare</label>
              <div className="flex gap-2">
                {['2024', '2025', '2026'].map(a => (
                  <button
                    key={a}
                    onClick={() => setAnnoSelected(a)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      annoSelected === a
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 bg-red-50 border border-red-100 rounded-lg p-3">
              ⚠️ Questa azione eliminerà tutti i record dell'anno selezionato. Non può essere annullata.
            </p>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { onClose(); reset(); }} className="flex-1">
                  Annulla
                </Button>
                <Button
                  onClick={() => {
                    if (confirm(`Cancellare TUTTI i consuntivi ${annoSelected}? Non può essere annullato.`)) {
                      runDelete(annoSelected);
                    }
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Cancella {annoSelected}
                </Button>
              </div>

              <Button
                onClick={() => {
                  if (confirm('Cancellare TUTTI i dati 2025 e 2026?')) {
                    runDelete(['2025', '2026']);
                  }
                }}
                className="w-full bg-red-700 hover:bg-red-800 text-sm"
              >
                🗑 Cancella 2025 + 2026
              </Button>

              <Button
                onClick={() => {
                  if (confirm('⚠️ Cancellare TUTTI gli anni 2024, 2025, 2026?')) {
                    runDelete(['2024', '2025', '2026']);
                  }
                }}
                className="w-full bg-red-900 hover:bg-red-950 text-sm font-bold"
              >
                ⚡ Cancella TUTTI (2024 + 2025 + 2026)
              </Button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-red-500 flex-shrink-0" />
              <p className="text-sm text-gray-600 font-medium">{message || 'Eliminazione in corso...'}</p>
            </div>
            {deletedCount > 0 && (
              <p className="text-3xl font-black text-red-600 text-center">
                {deletedCount.toLocaleString('it-IT')} eliminati
              </p>
            )}
            <div className="bg-gray-950 rounded-xl p-3 h-48 overflow-y-auto space-y-1">
              {logs.map((l, i) => (
                <p key={i} className="font-mono text-[11px] text-gray-300">{l}</p>
              ))}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">{message}</p>
            <p className="text-3xl font-black text-gray-800">{deletedCount.toLocaleString('it-IT')}</p>
            <p className="text-xs text-gray-400">record eliminati</p>
            <Button onClick={() => { onClose(); reset(); }} className="w-full mt-2">
              Chiudi
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-600 text-center">{message}</p>
            <Button onClick={() => setStep('select')} variant="outline" className="w-full">
              Riprova
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}