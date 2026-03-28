import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, getDoc, collection, query, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/api/firebaseClient';

const DataContext = createContext(null);

const ANNI = ['2024', '2025', '2026'];

// Carica tutti i deal di un anno con paginazione
async function loadDealsForAnno(anno, onProgress) {
  const col = collection(db, 'deals');
  let all = [], lastDoc = null;
  while (true) {
    const constraints = [col, where('anno', '==', anno), limit(200)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(...constraints));
    if (snap.empty) break;
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
    lastDoc = snap.docs[snap.docs.length - 1];
    if (onProgress) onProgress(anno, all.length);
    if (snap.docs.length < 200) break;
    await new Promise(r => setTimeout(r, 20));
  }
  return all;
}

export function DataProvider({ children }) {
  // Aggregati — istantanei
  const [aggregati, setAggregati] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasAggregati, setHasAggregati] = useState(false);

  // Deal raw — caricati in background
  const [deals, setDeals] = useState({ '2024': [], '2025': [], '2026': [] });
  const [dealsLoading, setDealsLoading] = useState({ '2024': false, '2025': false, '2026': false });
  const [dealsReady, setDealsReady] = useState({ '2024': false, '2025': false, '2026': false });
  const [dealsProgress, setDealsProgress] = useState({ '2024': 0, '2025': 0, '2026': 0 });

  // Portafoglio clienti
  const [portafoglio, setPortafoglio] = useState([]);
  const [portafoglioMap, setPortafoglioMap] = useState({});
  const [portafoglioReady, setPortafoglioReady] = useState(false);

  const loadedRef = useRef({ aggregati: false, portafoglio: false, deals: {} });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadAggregati(),
      loadPortafoglio(),
    ]);
    // Carica i deal in background uno alla volta
    loadAllDealsBackground();
  };

  const loadAggregati = async () => {
    setLoading(true);
    try {
      const results = {};
      await Promise.all(ANNI.map(async anno => {
        const snap = await getDoc(doc(db, 'aggregati', anno));
        if (snap.exists()) results[anno] = snap.data();
      }));
      setAggregati(results);
      setHasAggregati(Object.keys(results).length > 0);
    } catch (e) {
      console.error('Aggregati error:', e);
    }
    setLoading(false);
  };

  const loadPortafoglio = async () => {
    try {
      const snap = await getDocs(collection(db, 'portafoglio_clienti'));
      const docs = snap.docs.map(d => d.data());
      setPortafoglio(docs);
      const map = {};
      docs.forEach(c => {
        if (c.ragione_sociale) map[c.ragione_sociale.toLowerCase().trim()] = c;
        if (c.capogruppo) map[c.capogruppo.toLowerCase().trim()] = c;
      });
      setPortafoglioMap(map);
      setPortafoglioReady(true);
    } catch (e) {
      console.error('Portafoglio error:', e);
    }
  };

  const loadAllDealsBackground = async () => {
    for (const anno of ANNI) {
      if (loadedRef.current.deals[anno]) continue;
      loadedRef.current.deals[anno] = true;
      setDealsLoading(prev => ({ ...prev, [anno]: true }));
      try {
        const data = await loadDealsForAnno(anno, (a, count) => {
          setDealsProgress(prev => ({ ...prev, [a]: count }));
        });
        setDeals(prev => ({ ...prev, [anno]: data }));
        setDealsReady(prev => ({ ...prev, [anno]: true }));
        setDealsProgress(prev => ({ ...prev, [anno]: data.length }));
      } catch (e) {
        console.error(`Deals ${anno} error:`, e);
      }
      setDealsLoading(prev => ({ ...prev, [anno]: false }));
      // Piccola pausa tra un anno e l'altro
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const reload = async () => {
    loadedRef.current = { aggregati: false, portafoglio: false, deals: {} };
    setDealsReady({ '2024': false, '2025': false, '2026': false });
    setDeals({ '2024': [], '2025': [], '2026': [] });
    await loadAll();
  };

  // Ricarica solo portafoglio (dopo import)
  const reloadPortafoglio = async () => {
    await loadPortafoglio();
  };

  // Tutti i deal combinati
  const allDeals = [...(deals['2024']||[]), ...(deals['2025']||[]), ...(deals['2026']||[])];
  const allReady = dealsReady['2024'] && dealsReady['2025'] && dealsReady['2026'];

  return (
    <DataContext.Provider value={{
      // Aggregati
      aggregati, loading, hasAggregati,
      // Deals raw
      deals, allDeals,
      dealsLoading, dealsReady, dealsProgress, allReady,
      // Portafoglio
      portafoglio, portafoglioMap, portafoglioReady,
      // Actions
      reload, reloadPortafoglio,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
