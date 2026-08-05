// ==========================================================================
// Firestore data access — books, reviews, users
// ==========================================================================

import { db, DEMO_MODE } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let demoBooksCache = null;
let demoReviews = [
  { id: "r1", bookId: "SAJS-001", userId: "demo-student-02", userName: "Rohan Mehta", rating: 5, reviewText: "The pacing in the second half genuinely surprised me. Read it in two sittings.", timestamp: Date.now() - 86400000 * 2 },
  { id: "r2", bookId: "SAJS-001", userId: "demo-student-01", userName: "Ananya Sharma", rating: 4, reviewText: "Loved the setting descriptions. Wish the ending had a bit more closure.", timestamp: Date.now() - 86400000 },
  { id: "r3", bookId: "SAJS-009", userId: "demo-student-01", userName: "Ananya Sharma", rating: 5, reviewText: "The mechanical puzzles and Old Delhi courtyard atmosphere were brilliant!", timestamp: Date.now() - 86400000 * 4 },
  { id: "r4", bookId: "SAJS-010", userId: "demo-student-02", userName: "Rohan Mehta", rating: 5, reviewText: "Mind-bending concept connecting astrophysics and raga harmonics.", timestamp: Date.now() - 86400000 * 3 },
  { id: "r5", bookId: "SAJS-011", userId: "demo-teacher-01", userName: "Mrs. Kavita Rao", rating: 5, reviewText: "A deeply moving narrative honoring Banaras handloom artisans.", timestamp: Date.now() - 86400000 * 5 },
  { id: "r6", bookId: "SAJS-015", userId: "demo-student-01", userName: "Ananya Sharma", rating: 5, reviewText: "Truly inspiring biography of Dr. Kalam. Must read for everyone in school!", timestamp: Date.now() - 86400000 * 6 },
  { id: "r7", bookId: "SAJS-016", userId: "demo-student-02", userName: "Rohan Mehta", rating: 4, reviewText: "Super fun boarding school adventure in Ooty. Loved the drone scouting plot!", timestamp: Date.now() - 86400000 * 1 }
];

async function loadDemoBooks() {
  if (demoBooksCache) return demoBooksCache;
  const res = await fetch("data/sample-books.json");
  demoBooksCache = await res.json();
  return demoBooksCache;
}

/* ---------------------------- Books ------------------------------------ */

export async function getAllBooks() {
  if (DEMO_MODE) return loadDemoBooks();
  const snap = await getDocs(query(collection(db, "books"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getBookById(bkId) {
  if (DEMO_MODE) {
    const books = await loadDemoBooks();
    return books.find((b) => b.BK_ID === bkId || b.id === bkId) || null;
  }
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
  if (DEMO_MODE) {
    const books = await loadDemoBooks();
    books.unshift(bookData);
    return bookData.BK_ID;
  }
  await addDoc(collection(db, "books"), { ...bookData, createdAt: serverTimestamp() });
  return bookData.BK_ID;
}

export async function updateBook(bookDocId, changes) {
  if (DEMO_MODE) return;
  await updateDoc(doc(db, "books", bookDocId), changes);
}

export async function deleteBook(bookDocId) {
  if (DEMO_MODE) return;
  await deleteDoc(doc(db, "books", bookDocId));
}

/* --------------------------- Reviews ------------------------------------ */

export async function getReviewsForBook(bookId) {
  if (DEMO_MODE) return demoReviews.filter((r) => r.bookId === bookId).sort((a, b) => b.timestamp - a.timestamp);
  const snap = await getDocs(
    query(collection(db, "reviews"), where("bookId", "==", bookId), orderBy("timestamp", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addReview({ bookId, userId, userName, rating, reviewText }) {
  if (DEMO_MODE) {
    const review = { id: `r${Date.now()}`, bookId, userId, userName, rating, reviewText, timestamp: Date.now() };
    demoReviews.unshift(review);
    return review.id;
  }
  const docRef = await addDoc(collection(db, "reviews"), {
    bookId, userId, userName, rating, reviewText, timestamp: Date.now()
  });
  return docRef.id;
}

/** Students may only edit/delete their own review — enforce in Firestore rules too. */
export async function updateReview(reviewId, ownerId, currentUserId, changes) {
  if (ownerId !== currentUserId) throw new Error("You can only edit your own review.");
  if (DEMO_MODE) {
    const r = demoReviews.find((x) => x.id === reviewId);
    if (r) Object.assign(r, changes);
    return;
  }
  await updateDoc(doc(db, "reviews", reviewId), changes);
}

export async function deleteReview(reviewId, ownerId, currentUserId, isModerator = false) {
  if (ownerId !== currentUserId && !isModerator) throw new Error("Not authorized to delete this review.");
  if (DEMO_MODE) {
    demoReviews = demoReviews.filter((x) => x.id !== reviewId);
    return;
  }
  await deleteDoc(doc(db, "reviews", reviewId));
}

/* ---------------------------- Users -------------------------------------- */

export async function getAllUsers() {
  if (DEMO_MODE) {
    return [
      { uid: "admin-manav", name: "Manav Mishra", email: "manavgmishra@gmail.com", role: "admin" },
      { uid: "demo-student-01", name: "Ananya Sharma", email: "ananya@demo.sajs.edu", role: "student", className: "9", section: "B" },
      { uid: "demo-student-02", name: "Rohan Mehta", email: "rohan@demo.sajs.edu", role: "student", className: "10", section: "A" },
      { uid: "demo-teacher-01", name: "Mrs. Kavita Rao", email: "kavita.rao@sajs.edu", role: "teacher", subject: "English" }
    ];
  }
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setUserRole(uid, role) {
  if (DEMO_MODE) return;
  await updateDoc(doc(db, "users", uid), { role });
}

export async function updateUserProfile(uid, changes) {
  if (DEMO_MODE) return;
  await updateDoc(doc(db, "users", uid), changes);
}
