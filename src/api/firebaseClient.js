import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyA-JCfHgz7i7plIZAxK5YYx08jV2CtAalg",
  authDomain: "nexus-growth-lens.firebaseapp.com",
  projectId: "nexus-growth-lens",
  storageBucket: "nexus-growth-lens.firebasestorage.app",
  messagingSenderId: "39660228318",
  appId: "1:39660228318:web:70aeab62f0e003cad4bc4f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functionsInstance = getFunctions(app, 'europe-west1');