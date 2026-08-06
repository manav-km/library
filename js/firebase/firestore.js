// ==========================================================================
// Firestore data access — books, reviews, users
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------- Books ------------------------------------ */

export async function getAllBooks() {
  const booksRef = collection(db, "books");
  const snap = await getDocs(query(booksRef, orderBy("createdAt", "desc")));
  
  if (snap.empty) {
    // Auto-seed sample books if Firestore books collection is empty
    try {
      const res = await fetch("data/sample-books.json");
      const samples = await res.json();
      for (const b of samples) {
        await addDoc(booksRef, { ...b, createdAt: serverTimestamp() });
      }
      const seededSnap = await getDocs(query(booksRef, orderBy("createdAt", "desc")));
      return seededSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Failed to auto-seed Firestore sample books:", e);
      return [];
    }
  }

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getBookById(bkId) {
  // Search by BK_ID field first
  const q = query(collection(db, "books"), where("BK_ID", "==", bkId), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  }
  // Fallback to doc ID
  const docSnap = await getDoc(doc(db, "books", bkId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

/** Generates the next sequential SAJS-### id by scanning existing books. */
export async function getNextBookId() {
  const books = await getAllBooks();
  const nums = books
    .map((b) => parseInt(String(b.BK_ID).replace("SAJS-", ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SAJS-${String(next).padStart(3, "0")}`;
}

export async function addBook(bookData) {
  await addDoc(collection(db, "books"), { ...bookData, createdAt: serverTimestamp() });
  return bookData.BK_ID;
}

export async function updateBook(bookDocId, changes) {
  await updateDoc(doc(db, "books", bookDocId), changes);
}

export async function deleteBook(bookIdOrDocId) {
  if (!bookIdOrDocId) return;
  try {
    const docRef = doc(db, "books", bookIdOrDocId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
      return;
    }
  } catch (e) {
    // Continue to search by BK_ID
  }

  const q = query(collection(db, "books"), where("BK_ID", "==", bookIdOrDocId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}

/* --------------------------- Reviews ------------------------------------ */

export async function getReviewsForBook(bookId) {
  const snap = await getDocs(
    query(collection(db, "reviews"), where("bookId", "==", bookId), orderBy("timestamp", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addReview({ bookId, userId, userName, rating, reviewText, whyLiked, whatLearnt, canBeImproved }) {
  const parts = [];
  if (whyLiked) parts.push(`Why I liked it: ${whyLiked}`);
  if (whatLearnt) parts.push(`What I learnt: ${whatLearnt}`);
  if (canBeImproved) parts.push(`What could be improved: ${canBeImproved}`);

  const mainText = reviewText || (parts.length ? parts.join("\n\n") : "");

  const docRef = await addDoc(collection(db, "reviews"), {
    bookId,
    userId,
    userName,
    rating,
    reviewText: mainText,
    whyLiked: whyLiked || "",
    whatLearnt: whatLearnt || "",
    canBeImproved: canBeImproved || "",
    timestamp: Date.now()
  });
  return docRef.id;
}

export async function updateReview(reviewId, ownerId, currentUserId, changes) {
  if (ownerId !== currentUserId) throw new Error("You can only edit your own review.");
  await updateDoc(doc(db, "reviews", reviewId), changes);
}

export async function deleteReview(reviewId, ownerId, currentUserId, isModerator = false) {
  if (ownerId !== currentUserId && !isModerator) throw new Error("Not authorized to delete this review.");
  await deleteDoc(doc(db, "reviews", reviewId));
}

/* ---------------------------- Users -------------------------------------- */

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setUserRole(uid, role) {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function updateUserProfile(uid, changes) {
  await updateDoc(doc(db, "users", uid), changes);
}
