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
  updateProfile,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { logAuditAction } from "./firestore.js";

const ADMIN_EMAILS = ["manavgmishra@gmail.com"];

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const profile = await getUserProfile(user.uid);
  if (!profile) {
    return { needsExtraInfo: true, user };
  }
  return profile;
}

export async function completeGoogleSignUp(user, { username, password, className, section, rollNumber, favouriteGenre }) {
  // Check if username is already taken
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Username is already taken.");
  }

  await updatePassword(user, password);
  const isAdminEmail = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  
  const profile = {
    uid: user.uid,
    name: user.displayName || (user.email ? user.email.split("@")[0] : username),
    email: user.email,
    username,
    role: "student",
    className: className || "",
    section: section || "",
    rollNumber: rollNumber || "",
    favouriteGenre: favouriteGenre || "Fiction",
    bio: "",
    profilePicture: user.photoURL || "",
    createdAt: Date.now(),
    lastOnline: Date.now()
  };
  await setDoc(doc(db, "users", user.uid), profile);

  logAuditAction({
    action: "USER_SIGNUP",
    category: "Users",
    details: `New account created via Google: ${profile.name} (${profile.email}).`,
    performedBy: profile,
    targetId: profile.uid
  });

  return isAdminEmail ? { ...profile, role: "admin" } : profile;
}

export async function signUp({ email, password, name, className, section, rollNumber, favouriteGenre, username }) {
  // Check if username is already taken
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Username is already taken.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  const isAdminEmail = ADMIN_EMAILS.includes((email || "").toLowerCase());
  const profile = {
    uid: cred.user.uid,
    name,
    email,
    username,
    role: "student", // Always write "student" on creation to satisfy firestore.md security rules
    className: className || "",
    section: section || "",
    rollNumber: rollNumber || "",
    favouriteGenre: favouriteGenre || "",
    bio: "",
    profilePicture: "",
    createdAt: Date.now(),
    lastOnline: Date.now()
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

export async function logIn(identifier, password) {
  let email = identifier;
  if (!identifier.includes("@")) {
    const q = query(collection(db, "users"), where("username", "==", identifier));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error("Username not found.");
    }
    email = snap.docs[0].data().email;
  }
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
    // Only return null. Profile will be created via completeGoogleSignUp
    return null;
  }
  return null;
}

/** Fires callback(profile|null) on every auth change. Used by every page's guard. */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);
    try {
      updateDoc(doc(db, "users", user.uid), { lastOnline: Date.now() }).catch(() => {});
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
