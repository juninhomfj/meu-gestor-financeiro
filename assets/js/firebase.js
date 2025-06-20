// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Configuração do Firebase - seus dados:
const firebaseConfig = {
  apiKey: "AIzaSyBV5nv7yVcv1GVsJnw2_k774E4mrcjI0bI",
  authDomain: "gestor-financeiro-fjr.firebaseapp.com",
  projectId: "gestor-financeiro-fjr",
  storageBucket: "gestor-financeiro-fjr.firebasestorage.app",
  messagingSenderId: "391631260851",
  appId: "1:391631260851:web:f95e8ebafd11210da3b4c6"
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore
const db = getFirestore(app);

// Exporta db e funções do Firestore que você usa
export {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc
};
