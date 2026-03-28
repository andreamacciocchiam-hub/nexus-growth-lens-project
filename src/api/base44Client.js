import {
  collection, query, where, orderBy, limit as fsLimit,
  getDocs, addDoc, writeBatch, deleteDoc, doc, getDoc
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functionsInstance } from './firebaseClient';

function parseSort(sortStr = '-created_date') {
  const desc = sortStr.startsWith('-');
  const field = desc ? sortStr.slice(1) : sortStr;
  return { field, direction: desc ? 'desc' : 'asc' };
}

function makeEntity(collectionName) {
  const col = collection(db, collectionName);
  return {
    async list(sortStr = '-created_date', lim = 100) {
      const { field, direction } = parseSort(sortStr);
      // Firestore max è 10000, Base44 SDK restituisce max 100 per chiamata
      const safeLim = Math.min(lim, 100);
      const q = query(col, orderBy(field, direction), fsLimit(safeLim));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async filter(filters = {}, sort = null, lim = 100, offset = 0) {
      const constraints = [col];
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null) constraints.push(where(k, '==', v));
      }
      // Firestore max è 10000, usiamo max 100 per sicurezza
      const safeLim = Math.min(lim || 100, 100);
      if (sort) {
        const { field, direction } = parseSort(sort);
        constraints.push(orderBy(field, direction));
      }
      constraints.push(fsLimit(safeLim));
      const q = query(...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async bulkCreate(records) {
      const results = [];
      const CHUNK = 100; // Firestore batch max è 500, usiamo 100 per sicurezza
      for (let i = 0; i < records.length; i += CHUNK) {
        const batch = writeBatch(db);
        records.slice(i, i + CHUNK).forEach(r => {
          const ref = doc(col);
          batch.set(ref, { ...r, created_date: new Date().toISOString() });
          results.push({ id: ref.id, ...r });
        });
        await batch.commit();
        if (i + CHUNK < records.length)
          await new Promise(res => setTimeout(res, 200));
      }
      return results;
    },

    async deleteMany(filters = {}) {
      const docs = await this.filter(filters);
      const CHUNK = 100;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        docs.slice(i, i + CHUNK).forEach(d => batch.delete(doc(col, d.id)));
        await batch.commit();
        if (i + CHUNK < docs.length)
          await new Promise(res => setTimeout(res, 200));
      }
      return { deleted: docs.length };
    },

    async delete(id) { await deleteDoc(doc(col, id)); },

    async get(id) {
      const snap = await getDoc(doc(col, id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
  };
}

export const base44 = {
  entities: {
    Deal: makeEntity('deals'),
    PortafoglioCliente: makeEntity('portafoglio_clienti'),
  },
  functions: {
    invoke: async (name, payload) => {
      const fn = httpsCallable(functionsInstance, name);
      const result = await fn(payload);
      return result.data;
    }
  },
  auth: {
    me: () => new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, user => {
        unsub();
        if (user) resolve({ id: user.uid, email: user.email, role: 'admin' });
        else reject({ status: 401 });
      });
    }),
    logout: () => signOut(auth),
    redirectToLogin: () => window.location.href = '/login',
  }
};
