// ==========================================================================
// Firestore data access — books, reviews, users
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------- Books ------------------------------------ */

export async function getAllBooks() {
  const snap = await getDocs(query(collection(db, "books"), orderBy("BK_ID", "asc")));
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

  if (!mainText.trim()) {
    throw new Error("Review text cannot be empty. Please write something before submitting.");
  }
  if (mainText.length > 2000) {
    throw new Error("Review text cannot exceed 2 000 characters.");
  }

  const docRef = await addDoc(collection(db, "reviews"), {
    bookId,
    userId,
    userName,
    rating,
    reviewText: mainText.trim(),
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
  if (!uid) throw new Error("Invalid User ID");
  await setDoc(doc(db, "users", uid), { role }, { merge: true });
}

export async function updateUserProfile(uid, changes) {
  await updateDoc(doc(db, "users", uid), changes);
}

/* ------------------------- Announcements --------------------------------- */

export async function getAnnouncements() {
  const snap = await getDocs(
    query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addAnnouncement({ title, body, authorName, authorRole }) {
  const safeTitle = (title || "").trim();
  const safeBody = (body || "").trim();

  if (!safeTitle) throw new Error("Announcement title cannot be empty.");
  if (!safeBody) throw new Error("Announcement message cannot be empty.");

  const ref = await addDoc(collection(db, "announcements"), {
    title: safeTitle,
    body: safeBody,
    authorName: authorName || "Admin",
    authorRole: authorRole || "admin",
    createdAt: Date.now()
  });
  return ref.id;
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, "announcements", id));
}

/* -------------------------- Audit Logs ----------------------------------- */

export async function logAuditAction({ action, category, details, performedBy, targetId = "" }) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      action: action || "ACTION",
      category: category || "General",
      details: details || "",
      performedBy: {
        uid: performedBy?.uid || "system",
        name: performedBy?.name || "System User",
        role: performedBy?.role || "student",
        email: performedBy?.email || ""
      },
      targetId: targetId || "",
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn("Failed to log audit action:", err);
  }
}

export async function getAuditLogs() {
  try {
    const snap = await getDocs(
      query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(150))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Failed to fetch audit logs:", err);
    return [];
  }
}
