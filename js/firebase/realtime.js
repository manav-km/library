// ==========================================================================
// Realtime Database — global discussion forum
// ==========================================================================

import { rtdb } from "./firebase-config.js";
import {
  ref, push, set, onValue, query, orderByChild, limitToLast, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function sendMessage(bookId, { sender, senderUid, message }) {
  const payload = { sender, senderUid, message, timestamp: Date.now() };
  const msgsRef = ref(rtdb, `discussions/${bookId}/messages`);
  push(msgsRef, payload);
}

/** Subscribes to the last 100 messages of a thread. Returns an unsubscribe fn. */
export function listenToThread(bookId, callback) {
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
  remove(ref(rtdb, `discussions/${bookId}/messages/${messageId}`));
}

/** Creates a custom discussion thread and sends initial message. */
export async function createCustomThread({ title, creatorName, creatorUid, firstMessage }) {
  const threadRef = push(ref(rtdb, "custom_threads"));
  const threadId = threadRef.key;
  await set(threadRef, {
    id: threadId,
    title,
    creatorName,
    creatorUid,
    createdAt: Date.now()
  });
  if (firstMessage) {
    sendMessage(threadId, { sender: creatorName, senderUid: creatorUid, message: firstMessage });
  }
  return { id: threadId, title, creatorName, creatorUid };
}

/** Subscribes to all user-created custom discussion threads. */
export function listenToCustomThreads(callback) {
  const threadsRef = query(ref(rtdb, "custom_threads"), orderByChild("createdAt"));
  return onValue(threadsRef, (snap) => {
    const list = [];
    snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    callback(list.reverse());
  });
}
