// ==========================================================================
// Realtime Database — global discussion forum
// ==========================================================================

import { rtdb, DEMO_MODE } from "./firebase-config.js";
import {
  ref, push, onValue, query, orderByChild, limitToLast, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const demoListeners = new Map();
let demoMessages = {
  "SAJS-001": [
    { id: "m1", sender: "Mrs. Kavita Rao", senderUid: "demo-teacher-01", message: "Kicking off the thread — what did everyone make of the ending?", timestamp: Date.now() - 3600000 * 5 },
    { id: "m2", sender: "Rohan Mehta", senderUid: "demo-student-02", message: "Honestly did not see that twist coming at all.", timestamp: Date.now() - 3600000 * 3 },
    { id: "m3", sender: "Ananya Sharma", senderUid: "demo-student-01", message: "Elias keeping the harbour tide tables secret for so long was the real key.", timestamp: Date.now() - 3600000 * 1 }
  ],
  "SAJS-009": [
    { id: "m4", sender: "Ananya Sharma", senderUid: "demo-student-01", message: "Has anyone solved the gear ratio clue in Chapter 4 yet?", timestamp: Date.now() - 3600000 * 8 },
    { id: "m5", sender: "Mrs. Kavita Rao", senderUid: "demo-teacher-01", message: "Pay attention to the courtyard fountain chimes at noon!", timestamp: Date.now() - 3600000 * 4 }
  ],
  "SAJS-010": [
    { id: "m6", sender: "Rohan Mehta", senderUid: "demo-student-02", message: "The Hanle Observatory scene was incredible. Made me want to study astronomy.", timestamp: Date.now() - 3600000 * 6 }
  ],
  "SAJS-015": [
    { id: "m7", sender: "Ananya Sharma", senderUid: "demo-student-01", message: "Dr. Kalam's advice on perseverance in this book is truly life-changing.", timestamp: Date.now() - 3600000 * 12 },
    { id: "m8", sender: "Mrs. Kavita Rao", senderUid: "demo-teacher-01", message: "Recommended reading for Class 9 and 10 students for our upcoming essay project.", timestamp: Date.now() - 3600000 * 10 }
  ]
};

export function sendMessage(bookId, { sender, senderUid, message }) {
  const payload = { sender, senderUid, message, timestamp: Date.now() };
  if (DEMO_MODE) {
    if (!demoMessages[bookId]) demoMessages[bookId] = [];
    payload.id = `m${Date.now()}`;
    demoMessages[bookId].push(payload);
    (demoListeners.get(bookId) || []).forEach((cb) => cb(demoMessages[bookId]));
    return;
  }
  const msgsRef = ref(rtdb, `discussions/${bookId}/messages`);
  push(msgsRef, payload);
}

/** Subscribes to the last 100 messages of a book's thread. Returns an unsubscribe fn. */
export function listenToThread(bookId, callback) {
  if (DEMO_MODE) {
    if (!demoListeners.has(bookId)) demoListeners.set(bookId, []);
    demoListeners.get(bookId).push(callback);
    callback(demoMessages[bookId] || []);
    return () => {
      demoListeners.set(bookId, demoListeners.get(bookId).filter((cb) => cb !== callback));
    };
  }
  const msgsRef = query(ref(rtdb, `discussions/${bookId}/messages`), orderByChild("timestamp"), limitToLast(100));
  const handler = (snap) => {
    const list = [];
    snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    callback(list);
  };
  return onValue(msgsRef, handler);
}

/** Teacher/admin moderation — remove a single message. */
export function deleteMessage(bookId, messageId) {
  if (DEMO_MODE) {
    demoMessages[bookId] = (demoMessages[bookId] || []).filter((m) => m.id !== messageId);
    (demoListeners.get(bookId) || []).forEach((cb) => cb(demoMessages[bookId]));
    return;
  }
  remove(ref(rtdb, `discussions/${bookId}/messages/${messageId}`));
}

/** Returns the list of book IDs that currently have at least one message — used for the thread list. */
export function getActiveThreadIds() {
  if (DEMO_MODE) return Object.keys(demoMessages);
  return []; // populated live in discussions.js via listenToThread per book once books are loaded
}
