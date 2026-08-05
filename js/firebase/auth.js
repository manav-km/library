// ==========================================================================
// Authentication + role-based access control
// ==========================================================================

import { auth, db, DEMO_MODE } from "./firebase-config.js";
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

const ADMIN_EMAILS = ["manavgmishra@gmail.com"];

const DEMO_USER = {
  uid: "admin-manav",
  name: "Manav Mishra",
  email: "manavgmishra@gmail.com",
  role: "admin",
  className: "",
  section: "",
  rollNumber: "",
  favouriteGenre: "Mystery",
  bio: "System Administrator",
  profilePicture: ""
};

export async function signInWithGoogle() {
  if (DEMO_MODE) return DEMO_USER;
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const isAdminEmail = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  const userDocRef = doc(db, "users", user.uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    const data = snap.data();
    return isAdminEmail ? { ...data, role: "admin" } : data;
  } else {
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
    return isAdminEmail ? { ...profile, role: "admin" } : profile;
  }
}

export async function signUp({ email, password, name, className, section, rollNumber, favouriteGenre }) {
  if (DEMO_MODE) {
    return { ...DEMO_USER, name, email: email || DEMO_USER.email, className, section, rollNumber, favouriteGenre };
  }
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
  return isAdminEmail ? { ...profile, role: "admin" } : profile;
}

export async function logIn(email, password) {
  if (DEMO_MODE) return DEMO_USER;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return getUserProfile(cred.user.uid);
}

export async function logOut() {
  if (DEMO_MODE) return;
  await signOut(auth);
}

export async function getUserProfile(uid) {
  if (DEMO_MODE) return DEMO_USER;
  const userDocRef = doc(db, "users", uid);
  const snap = await getDoc(userDocRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data && ADMIN_EMAILS.includes((data.email || "").toLowerCase()) && data.role !== "admin") {
    await setDoc(userDocRef, { role: "admin" }, { merge: true });
    data.role = "admin";
  }
  return data;
}

/** Fires callback(profile|null) on every auth change. Used by every page's guard. */
export function watchAuthState(callback) {
  if (DEMO_MODE) {
    callback(DEMO_USER);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);
    const profile = await getUserProfile(user.uid);
    callback(profile);
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
