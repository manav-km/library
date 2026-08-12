// ==========================================================================
// Firebase initialization — SAJS Library Site
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXl35KnhNqOML5pKm_iqXYARXRBD4RBYQ",
  authDomain: "sajs-lib.firebaseapp.com",
  projectId: "sajs-lib",
  storageBucket: "sajs-lib.firebasestorage.app",
  messagingSenderId: "875747952416",
  appId: "1:875747952416:web:fc52ca738e63fb8377b945",
  measurementId: "G-9GVY7ZBQ7T",
  databaseURL: "https://sajs-lib-default-rtdb.asia-southeast1.firebasedatabase.app"
};

export const DEMO_MODE = false;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);
export const storage = getStorage(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
