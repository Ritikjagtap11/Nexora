import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCj_Qul5FLEWKXACCkp7DfHWBKoZTKrY6U",
  authDomain: "nexora-25e8a.firebaseapp.com",
  projectId: "nexora-25e8a",
  storageBucket: "nexora-25e8a.firebasestorage.app",
  messagingSenderId: "749043376875",
  appId: "1:749043376875:web:36deaddbdd18c1aba894ae",
  measurementId: "G-DGSQWY7DY0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
