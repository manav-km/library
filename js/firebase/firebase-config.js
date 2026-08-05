// ==========================================================================
// Firebase initialization
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// TODO: replace with your project's config (Project settings → General → Your apps)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com" // Realtime DB, for discussions
};

// DEMO_MODE: true until firebaseConfig above is filled in. In demo mode the
// app runs entirely on the sample data in /data/sample-books.json and a
// mock signed-in user, so the UI can be reviewed with no backend at all.
export const DEMO_MODE = firebaseConfig.apiKey === "YOUR_API_KEY";

export const app = DEMO_MODE ? null : initializeApp(firebaseConfig);
export const auth = DEMO_MODE ? null : getAuth(app);
export const db = DEMO_MODE ? null : getFirestore(app);
export const rtdb = DEMO_MODE ? null : getDatabase(app);
export const storage = DEMO_MODE ? null : getStorage(app);
