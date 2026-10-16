import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
const firebaseConfig = {
  apiKey: 
  authDomain: "checkia-project.firebaseapp.com",
  projectId: "checkia-project",
  storageBucket: "checkia-project.firebasestorage.app",
  messagingSenderId: "728407825506",
  appId: "1:728407825506:web:73f6e31a632443ab58053b"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// No se inicializa Analytics ni se accede a Firestore en esta etapa.
