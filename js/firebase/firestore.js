// ==========================================================================
// Firestore data access — books, reviews, users
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { hasBadWords } from "../utils/filter.js";

/* ---------------------------- Books ------------------------------------ */

export async function getAllBooks() {
  const snap = await getDocs(collection(db, "books"));
  const books = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return books.sort((a, b) => String(a.BK_ID).localeCompare(String(b.BK_ID)));
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
    query(collection(db, "reviews"), where("bookId", "==", bookId))
  );
  const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return reviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export async function addReview({ bookId, userId, userName, rating, reviewText, whyLiked, whatLearnt, canBeImproved }) {
  const parts = [];
  if (whyLiked) parts.push(`Why I liked it: ${whyLiked}`);
  if (whatLearnt) parts.push(`What I learnt: ${whatLearnt}`);
  if (canBeImproved) parts.push(`What could be improved: ${canBeImproved}`);

  const mainText = reviewText || (parts.length ? parts.join("\n\n") : "");

  if (hasBadWords(whyLiked) || hasBadWords(whatLearnt) || hasBadWords(canBeImproved) || hasBadWords(mainText)) {
    throw new Error("Your review contains inappropriate language or profanity. Please edit it before submitting.");
  }

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
  const snap = await getDocs(collection(db, "announcements"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20);
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

export async function updateAnnouncement(id, changes) {
  await updateDoc(doc(db, "announcements", id), changes);
}

/* -------------------------- Audit Logs ----------------------------------- */

export async function logAuditAction({ action, category, details, performedBy, targetId = "", beforeEdit = "", afterEdit = "", deletedContent = "", reason = "" }) {
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
      timestamp: Date.now(),
      beforeEdit: beforeEdit || "",
      afterEdit: afterEdit || "",
      deletedContent: deletedContent || "",
      reason: reason || ""
    });
  } catch (err) {
    console.warn("Failed to log audit action:", err);
  }
}

export async function getAuditLogs() {
  try {
    const snap = await getDocs(collection(db, "audit_logs"));
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 150);
  } catch (err) {
    console.warn("Failed to fetch audit logs:", err);
    return [];
  }
}

/* -------------------------- Reading Lists --------------------------------- */

/** Get all shelves for a user. Returns { shelves: { "Want to Read": ["SAJS-001",...], ... } } */
export async function getReadingLists(uid) {
  if (!uid) return { shelves: {} };
  const snap = await getDoc(doc(db, "readingLists", uid));
  return snap.exists() ? snap.data() : { shelves: {} };
}

/** Save (overwrite) the shelves map for a user. */
export async function saveReadingLists(uid, shelves) {
  if (!uid) return;
  await setDoc(doc(db, "readingLists", uid), { shelves, updatedAt: Date.now() }, { merge: true });
}

/* -------------------------- Reading Progress ------------------------------ */

/** Get reading progress for a specific user+book pair. */
export async function getReadingProgress(uid, bookId) {
  if (!uid || !bookId) return null;
  const snap = await getDoc(doc(db, "readingProgress", `${uid}_${bookId}`));
  return snap.exists() ? snap.data() : null;
}

/** Set (upsert) reading progress for a user+book pair. */
export async function setReadingProgress(uid, bookId, { currentPage, totalPages, status }) {
  if (!uid || !bookId) return;
  await setDoc(doc(db, "readingProgress", `${uid}_${bookId}`), {
    uid,
    bookId,
    currentPage: Number(currentPage) || 0,
    totalPages: Number(totalPages) || 0,
    status: status || "not_started",
    updatedAt: Date.now()
  }, { merge: true });
}

/** Get all reading progress docs for a user (for the dashboard). */
export async function getAllReadingProgress(uid) {
  if (!uid) return [];
  const q = query(collection(db, "readingProgress"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/* -------------------------- Reading Challenges ---------------------------- */

export async function getChallenges() {
  const snap = await getDocs(collection(db, "challenges"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function addChallenge({ title, description, goal, goalType, startDate, endDate, createdBy }) {
  const ref = await addDoc(collection(db, "challenges"), {
    title: (title || "").trim(),
    description: (description || "").trim(),
    goal: Number(goal) || 1,
    goalType: goalType || "reviews", // "reviews" | "books"
    startDate: startDate || "",
    endDate: endDate || "",
    createdBy: createdBy || "teacher",
    active: true,
    createdAt: Date.now()
  });
  return ref.id;
}

export async function deleteChallenge(id) {
  await deleteDoc(doc(db, "challenges", id));
}

export async function updateChallenge(id, changes) {
  await updateDoc(doc(db, "challenges", id), changes);
}

/* -------------------------- Book Issues ----------------------------------- */

export async function addBookIssue({ bookId, bookName, userId, userName, userClass, userSection, reason, issueDate, returnDate }) {
  const ref = await addDoc(collection(db, "bookIssues"), {
    bookId: bookId || "",
    bookName: bookName || "",
    userId: userId || "",
    userName: userName || "",
    userClass: userClass || "",
    userSection: userSection || "",
    reason: (reason || "").trim(),
    issueDate: issueDate || "",
    returnDate: returnDate || "",
    status: "pending",
    requestedAt: Date.now()
  });
  return ref.id;
}

export async function getBookIssues() {
  const snap = await getDocs(collection(db, "bookIssues"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
}

export async function getBookIssuesForUser(uid) {
  const q = query(collection(db, "bookIssues"), where("userId", "==", uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
}

export async function updateBookIssueStatus(id, status) {
  await updateDoc(doc(db, "bookIssues", id), { status, updatedAt: Date.now() });
}

