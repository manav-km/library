// ==========================================================================
// Realtime Database — global discussion forum
// ==========================================================================

import { rtdb } from "./firebase-config.js";
import {
  ref, push, set, onValue, query, orderByChild, limitToLast, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { hasBadWords } from "../utils/filter.js";

// Connection Logger
onValue(ref(rtdb, ".info/connected"), (snap) => {
  if (snap.val() === true) {
    console.log("✅ [RTDB] Connected to Realtime Database successfully!");
  } else {
    console.log("❌ [RTDB] Disconnected from Realtime Database.");
  }
});

/** Returns true if the RTDB can be reached, false otherwise (5s timeout). */
async function checkRTDBConnection() {
  return new Promise((resolve) => {
    const connRef = ref(rtdb, ".info/connected");
    const timer = setTimeout(() => resolve(false), 5000);
    const unsub = onValue(connRef, (snap) => {
      clearTimeout(timer);
      unsub();
      resolve(snap.val() === true);
    }, () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export async function sendMessage(bookId, { sender, senderUid, message }) {
  if (hasBadWords(message)) {
    throw new Error("Your message contains inappropriate language or profanity.");
  }
  const payload = { sender, senderUid, message, timestamp: Date.now() };
  const msgsRef = ref(rtdb, `discussions/${bookId}/messages`);
  await push(msgsRef, payload);
}

/** Subscribes to the last 100 messages of a thread. Returns an unsubscribe fn. */
export function listenToThread(bookId, callback) {
  const msgsRef = query(ref(rtdb, `discussions/${bookId}/messages`), orderByChild("timestamp"), limitToLast(100));
  const handler = (snap) => {
    const list = [];
    snap.forEach((child) => {
      const val = child.val();
      if (val && typeof val === "object") {
        list.push({ ...val, id: child.key });
      } else {
        // Fallback for legacy string-only messages
        list.push({
          sender: "Member",
          senderUid: "legacy",
          message: String(val || ""),
          timestamp: Date.now(),
          id: child.key
        });
      }
    });
    callback(list);
  };
  return onValue(msgsRef, handler, (err) => {
    console.error("RTDB listenToThread error:", err.message);
    callback([]);
  });
}

/** Teacher/admin moderation — remove a single message. */
export function deleteMessage(bookId, messageId) {
  return remove(ref(rtdb, `discussions/${bookId}/messages/${messageId}`));
}

/** Update message content. */
export async function updateMessage(bookId, messageId, newMessage) {
  if (hasBadWords(newMessage)) {
    throw new Error("Your message contains inappropriate language or profanity.");
  }
  await set(ref(rtdb, `discussions/${bookId}/messages/${messageId}/message`), newMessage);
}

/** Delete a custom discussion thread and all its messages. */
export async function deleteDiscussion(threadId) {
  await remove(ref(rtdb, `custom_threads/${threadId}`));
  await remove(ref(rtdb, `discussions/${threadId}`));
}

/** Creates a custom discussion thread and sends initial message. */
export async function createCustomThread({ title, creatorName, creatorUid, firstMessage }) {
  if (hasBadWords(title) || hasBadWords(firstMessage)) {
    throw new Error("The discussion title or message contains inappropriate language.");
  }

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
    await sendMessage(threadId, { sender: creatorName, senderUid: creatorUid, message: firstMessage });
  }
  return { id: threadId, title, creatorName, creatorUid };
}

/** Subscribes to all user-created custom discussion threads. */
export function listenToCustomThreads(callback) {
  const threadsRef = query(ref(rtdb, "custom_threads"), orderByChild("createdAt"));
  return onValue(threadsRef, (snap) => {
    const list = [];
    snap.forEach((child) => list.push({ ...child.val(), id: child.key }));
    callback(list.reverse());
  }, (err) => {
    console.error("RTDB listenToCustomThreads error:", err.message);
    callback([]);
  });
}
