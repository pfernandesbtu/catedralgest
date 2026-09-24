// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';

// ------------------------------------------------------------------
// CONFIGURAÇÃO DO FIREBASE
// Certifique-se de que as regras do Firestore (Database > Rules)
// estejam configuradas como: allow read, write: if true;
// para desenvolvimento.
// ------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyC8QfO1jhJpX3UgcAjI3xPhl465M5kS-l4",
  authDomain: "catedralgest.firebaseapp.com",
  projectId: "catedralgest",
  storageBucket: "catedralgest.firebasestorage.app",
  messagingSenderId: "230261133170",
  appId: "1:230261133170:web:a9b3f5e4c26645dc4657eb"
};

let app;
let dbInstance;

try {
    console.log("Inicializando Firebase v10.8.0...");
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    console.log("Firestore conectado com sucesso.");
} catch (error) {
    console.error("ERRO CRÍTICO NO FIREBASE:", error);
    if (error instanceof Error) {
        console.error("Detalhes:", error.message);
    }
}

export const dbFirestore = dbInstance;