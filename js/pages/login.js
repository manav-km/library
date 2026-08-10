import { signUp, logIn, signInWithGoogle, completeGoogleSignUp, watchAuthState } from "../firebase/auth.js";
import { showToast, populateGenreSelects, qs, qsa } from "../utils/helpers.js";

// Populate genre dropdowns on load
document.addEventListener("DOMContentLoaded", () => populateGenreSelects());

function redirectByRole(profile) {
  window.location.href = "student-dashboard.html";
}

// ---- Tab switching & form elements ----
const tabs = qsa(".auth-tab");
const loginForm = qs("#login-form");
const signupForm = qs("#signup-form");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.style.display = isLogin ? "block" : "none";
    signupForm.style.display = isLogin ? "none" : "block";
  });
});

// Redirect already signed in users
watchAuthState((profile) => {
  if (profile) redirectByRole(profile);
});

function formatAuthError(err) {
  const code = err.code || "";
  if (code.includes("operation-not-allowed") || code.includes("admin-restricted-operation") || err.message?.includes("ADMIN_ONLY_OPERATION")) {
    return "Sign-in provider is disabled. Enable Email/Password and Google in Firebase Console -> Authentication -> Sign-in method.";
  }
  if (code.includes("invalid-api-key")) {
    return "Invalid API key or restricted key in Google Cloud Console. Check Firebase Console project settings.";
  }
  return err.message || "Authentication failed. Check your details.";
}

// ---- Google Sign-in handler ----
qsa(".google-signin-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      const res = await signInWithGoogle();
      if (res && res.needsExtraInfo) {
        window.tempGoogleUser = res.user;
        qs("#google-signup-modal").classList.add("open");
      } else if (res) {
        showToast(`Signed in with Google — welcome back, ${(res.name || "User").split(" ")[0]}.`);
        setTimeout(() => redirectByRole(res), 500);
      }
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = qs("#login-identifier").value.trim();
    const password = qs("#login-password").value;
    try {
      const profile = await logIn(identifier, password);
      showToast(`Welcome back, ${(profile.name || "User").split(" ")[0]}.`);
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: qs("#signup-name").value,
      username: qs("#signup-username").value.trim().toLowerCase(),
      className: qs("#signup-class").value,
      section: qs("#signup-section").value,
      rollNumber: qs("#signup-roll").value,
      favouriteGenre: qs("#signup-genre").value,
      email: qs("#signup-email").value,
      password: qs("#signup-password").value
    };
    try {
      const profile = await signUp(payload);
      showToast("Account created — welcome to the library.");
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}

const gsForm = qs("#google-signup-form");
if (gsForm) {
  gsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!window.tempGoogleUser) return;
    
    const payload = {
      username: qs("#gs-username").value.trim().toLowerCase(),
      password: qs("#gs-password").value,
      className: qs("#gs-class").value,
      section: qs("#gs-section").value,
      rollNumber: qs("#gs-roll").value,
      favouriteGenre: qs("#gs-genre").value
    };
    
    try {
      const profile = await completeGoogleSignUp(window.tempGoogleUser, payload);
      showToast("Profile completed — welcome to the library.");
      qs("#google-signup-modal").classList.remove("open");
      window.tempGoogleUser = null;
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}

qs("#gs-cancel-btn")?.addEventListener("click", () => {
  qs("#google-signup-modal").classList.remove("open");
  window.tempGoogleUser = null;
});
