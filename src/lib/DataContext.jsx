import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';

const DataContext = createContext(null);

async function loadAnno(anno) {
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

async function loadPortafoglio() {
  const col = collection(db, 'portafoglio_clienti');
  let all = [];
  let lastDoc = null;
  while (true) {
    const constraints = [col, limit(100)];
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
  const [deals, setDeals] = useState([]);
  const [portafoglio, setPortafoglio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ anno: '', count: 0 });
  const [ready, setReady] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    load();
    return () => { cancelRef.current = true; };
  }, []);

  const load = async () => {
    setLoading(true);
    setDeals([]);
    let all = [];
    try {
      for (const anno of ['2026', '2025', '2024']) { // 2026 prima — più rilevante
        if (cancelRef.current) break;
        setProgress({ anno, count: all.length });
        const d = await loadAnno(anno);
        all = [...all, ...d];
        setDeals([...all]); // aggiorna progressivamente
        setProgress({ anno, count: all.length });
      }
      const ptf = await loadPortafoglio();
      setPortafoglio(ptf);
      setReady(true);
    } catch (e) {
      console.error('DataContext load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    setReady(false);
    load();
  };

  return (
    <DataContext.Provider value={{ deals, portafoglio, loading, progress, ready, reload }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
