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
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { logAuditAction } from "./firestore.js";

const ADMIN_EMAILS = ["manavgmishra@gmail.com"];

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    return getUserProfile(user.uid);
  } else {
    return { isNewUser: true, user };
  }
}

export async function signUp({ email, password, name, username, className, section, rollNumber, classTeacher, favouriteGenre, favouriteSubjects, subject, _isTeacherSignup }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  // Send verification email to confirm user's email address
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn("Failed to send verification email:", err.message);
  }

  const isAdminEmail = ADMIN_EMAILS.includes((email || "").toLowerCase());
  
  // Determine role: admin email → admin, official teacher email → teacher, else student
  const TEACHER_EMAIL_SUFFIX = "_lko@jaipuria.edu.in";
  const isOfficialTeacherEmail = (email || "").toLowerCase().trim().endsWith(TEACHER_EMAIL_SUFFIX);
  let role = "student";
  if (isAdminEmail) role = "admin";
  else if (_isTeacherSignup && isOfficialTeacherEmail) role = "teacher";

  const profile = {
    uid: cred.user.uid,
    name,
    username: username || "",
    email,
    role,
    className: className || "",
    section: section || "",
    rollNumber: rollNumber || "",
    classTeacher: classTeacher || "",
    favouriteGenre: favouriteGenre || "",
    favouriteSubjects: favouriteSubjects || [],
    subject: subject || "",
    bio: "",
    profilePicture: "",
    createdAt: Date.now(),
    lastOnline: Date.now()
  };
  await setDoc(doc(db, "users", cred.user.uid), profile);

  saveAccountToLocal(profile, password);

  logAuditAction({
    action: "USER_SIGNUP",
    category: "Users",
    details: `New account created: ${name} (${email}) registered as ${role}.`,
    performedBy: profile,
    targetId: cred.user.uid
  });

  return profile;
}

export async function logIn(emailOrUsername, password) {
  let targetEmail = emailOrUsername.trim();
  
  if (!targetEmail.includes("@")) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", targetEmail));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("No user found with that username.");
    }
    
    const userDocData = querySnapshot.docs[0].data();
    targetEmail = userDocData.email;
    if (!targetEmail) {
      throw new Error("No email associated with this username.");
    }
  }

  const cred = await signInWithEmailAndPassword(auth, targetEmail, password);
  const profile = await getUserProfile(cred.user.uid);
  if (profile) saveAccountToLocal(profile, password);
  return profile;
}

export async function logOut() {
  await signOut(auth);
}

export async function completeGoogleSignUp({ password, name, username, className, section, rollNumber, favouriteGenre, favouriteSubjects }) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user currently logged in.");

  await updatePassword(user, password);
  await updateProfile(user, { displayName: name });

  const isAdminEmail = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  const profile = {
    uid: user.uid,
    name,
    username: username || "",
    email: user.email,
    role: "student",
    className: className || "",
    section: section || "",
    rollNumber: rollNumber || "",
    favouriteGenre: favouriteGenre || "",
    favouriteSubjects: favouriteSubjects || [],
    bio: "",
    profilePicture: user.photoURL || "",
    createdAt: Date.now(),
    lastOnline: Date.now()
  };

  await setDoc(doc(db, "users", user.uid), profile);

  logAuditAction({
    action: "USER_SIGNUP",
    category: "Users",
    details: `New account completed via Google: ${name} (${user.email}).`,
    performedBy: profile,
    targetId: user.uid
  });

  return isAdminEmail ? { ...profile, role: "admin" } : profile;
}

export async function changeUserPassword(oldPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is signed in.");
  
  const credential = EmailAuthProvider.credential(user.email, oldPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function deleteUserProfile(username, password) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is signed in.");

  const profile = await getUserProfile(user.uid);
  if (!profile || profile.username !== username) {
    throw new Error("Username is incorrect.");
  }

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  await setDoc(doc(db, "users", user.uid), { deleted: true }, { merge: true }); // optional tombstoning before wipe
  // or completely delete:
  // import { deleteDoc } from ...
  // await deleteDoc(doc(db, "users", user.uid));
  // Since we don't have deleteDoc imported, doing a tombstone update for now, or I can import it.
  
  await deleteUser(user);
}

export async function getUserProfile(uid) {
  const userDocRef = doc(db, "users", uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    const data = snap.data();
    const isAdminEmail = ADMIN_EMAILS.includes((data.email || "").toLowerCase());

    // If this is the admin email but Firestore still has role:"student",
    // silently promote the doc so server-side rules also work.
    if (isAdminEmail && data.role !== "admin") {
      updateDoc(userDocRef, { role: "admin" }).catch(() => {});
    }

    return isAdminEmail ? { ...data, role: "admin" } : data;
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
      if (profile) saveAccountToLocal(profile);
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
export const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

export async function checkOrDeleteExpiredUnverifiedAccount(profile) {
  const user = auth.currentUser;
  if (!user || !profile) return false;

  const isGoogleUser = user.providerData.some((p) => p.providerId === "google.com");
  if (user.emailVerified || isGoogleUser) return false;

  const createdAt = profile.createdAt || Date.now();
  const ageMs = Date.now() - createdAt;

  if (ageMs > SEVENTY_TWO_HOURS_MS) {
    try {
      await deleteDoc(doc(db, "users", user.uid)).catch(() => {});
      await deleteUser(user).catch(() => {});
      removeSavedAccount(user.email);
    } catch (err) {
      console.warn("Error deleting expired unverified account:", err);
    }
    return true;
  }
  return false;
}

export function requireAuth(requiredRoles = []) {
  return new Promise((resolve) => {
    watchAuthState(async (profile) => {
      if (!profile) {
        window.location.href = "login.html";
        return;
      }
      const user = auth.currentUser;
      if (user) {
        const isGoogleUser = user.providerData.some((p) => p.providerId === "google.com");
        if (!user.emailVerified && !isGoogleUser) {
          const isExpired = await checkOrDeleteExpiredUnverifiedAccount(profile);
          if (isExpired) {
            sessionStorage.setItem("sajs_auth_error", "As part of our security enhancement policy, your account was automatically deleted because your email address was not verified within the 72-hour window. Please sign up again.");
            window.location.href = "login.html";
            return;
          }
          window.location.href = "verify-email.html";
          return;
        }
      }
      if (requiredRoles.length && !requiredRoles.includes(profile.role)) {
        window.location.href = "student-dashboard.html";
        return;
      }
      resolve(profile);
    });
  });
}

/** Resends a verification email to the currently signed-in user. */
export async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is currently signed in.");
  await sendEmailVerification(user);
}

/** Local saved accounts management for account switching */
export function saveAccountToLocal(profile, password = null) {
  if (!profile || !profile.email) return;
  try {
    const saved = JSON.parse(localStorage.getItem("sajs_saved_accounts") || "[]");
    const existing = saved.find((a) => a.email.toLowerCase() === profile.email.toLowerCase());
    const filtered = saved.filter((a) => a.email.toLowerCase() !== profile.email.toLowerCase());
    const entry = {
      uid: profile.uid,
      name: profile.name || "User",
      email: profile.email,
      role: profile.role || "student",
      profilePicture: profile.profilePicture || "",
      password: password || existing?.password || ""
    };
    localStorage.setItem("sajs_saved_accounts", JSON.stringify([entry, ...filtered]));
  } catch (e) {}
}

export function getSavedAccounts() {
  try {
    return JSON.parse(localStorage.getItem("sajs_saved_accounts") || "[]");
  } catch (e) {
    return [];
  }
}

export function removeSavedAccount(email) {
  try {
    const saved = getSavedAccounts();
    const filtered = saved.filter((a) => a.email.toLowerCase() !== (email || "").toLowerCase());
    localStorage.setItem("sajs_saved_accounts", JSON.stringify(filtered));
  } catch (e) {}
}

/** Direct 1-click account switcher without visiting login page */
export async function switchAccountDirect(targetEmail) {
  const saved = getSavedAccounts();
  const target = saved.find((a) => a.email.toLowerCase() === (targetEmail || "").toLowerCase());
  if (!target) throw new Error("Account not found in saved list.");

  if (target.password) {
    const cred = await signInWithEmailAndPassword(auth, target.email, target.password);
    const profile = await getUserProfile(cred.user.uid);
    if (profile) saveAccountToLocal(profile, target.password);
    return profile;
  } else {
    // Fallback if no saved password
    await logOut();
    sessionStorage.setItem("sajs_switch_email", target.email);
    window.location.href = `login.html?email=${encodeURIComponent(target.email)}`;
    return null;
  }
}
