// ==========================================================================
// Authentication + role-based access control
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { logAuditAction } from "./firestore.js";

const ADMIN_EMAILS = ["manavgmishra@gmail.com"];

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  return getUserProfile(user.uid);
}

export async function signUp({ email, password, name, className, section, rollNumber, favouriteGenre }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  const isAdminEmail = ADMIN_EMAILS.includes((email || "").toLowerCase());
  const profile = {
    uid: cred.user.uid,
    name,
    email,
    role: "student", // Always write "student" on creation to satisfy firestore.md security rules
    className: className || "",
    section: section || "",
    rollNumber: rollNumber || "",
    favouriteGenre: favouriteGenre || "",
    bio: "",
    profilePicture: "",
    createdAt: Date.now()
  };
  await setDoc(doc(db, "users", cred.user.uid), profile);

  logAuditAction({
    action: "USER_SIGNUP",
    category: "Users",
    details: `New account created: ${name} (${email}) registered as student.`,
    performedBy: profile,
    targetId: cred.user.uid
  });

  return isAdminEmail ? { ...profile, role: "admin" } : profile;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return getUserProfile(cred.user.uid);
}

export async function logOut() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  const user = auth.currentUser;
  const userDocRef = doc(db, "users", uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    const data = snap.data();
    if (ADMIN_EMAILS.includes((data.email || "").toLowerCase())) {
      return { ...data, role: "admin" };
    }
    return data;
  } else if (user && user.uid === uid) {
    const isAdminEmail = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
    const profile = {
      uid: user.uid,
      name: user.displayName || user.email.split("@")[0],
      email: user.email,
      role: "student", // Always write "student" on creation to satisfy firestore.md security rules
      className: "",
      section: "",
      rollNumber: "",
      favouriteGenre: "Fiction",
      bio: "",
      profilePicture: user.photoURL || "",
      createdAt: Date.now()
    };
    await setDoc(userDocRef, profile);

    logAuditAction({
      action: "USER_SIGNUP",
      category: "Users",
      details: `New account created via Google: ${profile.name} (${profile.email}).`,
      performedBy: profile,
      targetId: profile.uid
    });

    return isAdminEmail ? { ...profile, role: "admin" } : profile;
  }
  return null;
}

/** Fires callback(profile|null) on every auth change. Used by every page's guard. */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);
    try {
      const profile = await getUserProfile(user.uid);
      callback(profile);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      callback(null);
    }
  });
}

/**
 * Route guard. requiredRoles = [] means "any signed-in user".
 * Redirects to login.html if signed out, or to student-dashboard.html
 * if signed in but lacking the required role.
 */
export function requireAuth(requiredRoles = []) {
  return new Promise((resolve) => {
    watchAuthState((profile) => {
      if (!profile) {
        window.location.href = "login.html";
        return;
      }
      if (requiredRoles.length && !requiredRoles.includes(profile.role)) {
        window.location.href = "student-dashboard.html";
        return;
      }
      resolve(profile);
    });
  });
}
