import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';

const DataContext = createContext(null);

// Carica i 3 documenti aggregati — istantaneo
async function loadAggregati() {
  const anni = ['2024', '2025', '2026'];
  const results = {};
  await Promise.all(anni.map(async anno => {
    const snap = await getDoc(doc(db, 'aggregati', anno));
    if (snap.exists()) results[anno] = snap.data();
  }));
  return results;
}

// Carica deals raw per anno (per pagine di dettaglio) — on demand
export async function loadDealsAnno(anno) {
  const col = collection(db, 'deals');
  let all = [];
  let lastDoc = null;
  while (true) {
    const constraints = [col, where('anno', '==', anno), limit(100)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(...constraints));
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < 100) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    await new Promise(r => setTimeout(r, 30));
  }
  return all;
}

export function DataProvider({ children }) {
  const [aggregati, setAggregati] = useState(null); // { '2024': {...}, '2025': {...}, '2026': {...} }
  const [loading, setLoading] = useState(true);
  const [hasAggregati, setHasAggregati] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await loadAggregati();
      setAggregati(data);
      setHasAggregati(Object.keys(data).length > 0);
    } catch (e) {
      console.error('DataContext error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DataContext.Provider value={{ aggregati, loading, hasAggregati, reload: load }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
