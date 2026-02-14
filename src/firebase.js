import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyBTJpkEClvR_KmcsfMmLlScZ-iMuHnY5tI",
  authDomain: "daily-puzzle-game-dd341.firebaseapp.com",
  projectId: "daily-puzzle-game-dd341",
  storageBucket: "daily-puzzle-game-dd341.firebasestorage.app",
  messagingSenderId: "735818455785",
  appId: "1:735818455785:web:c7c5cc910d26d313c3ae78",
  measurementId: "G-RVDHRB282W"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);