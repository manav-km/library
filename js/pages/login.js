import { signUp, logIn, signInWithGoogle, watchAuthState, completeGoogleSignUp } from "../firebase/auth.js";
import { showToast, qs, qsa } from "../utils/helpers.js";

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
      const result = await signInWithGoogle();
      if (result.isNewUser) {
        // Show modal and prefill name
        qs("#google-signup-modal").classList.add("open");
        qs("#gs-name").value = result.user.displayName || "";
      } else {
        const profile = result;
        showToast(`Signed in with Google — welcome back, ${profile.name.split(" ")[0]}.`);
        setTimeout(() => redirectByRole(profile), 500);
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
    const email = qs("#login-email").value;
    const password = qs("#login-password").value;
    try {
      const profile = await logIn(email, password);
      showToast(`Welcome back, ${profile.name.split(" ")[0]}.`);
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
      username: qs("#signup-username").value,
      className: qs("#signup-class").value,
      section: qs("#signup-section").value,
      rollNumber: qs("#signup-roll").value,
      favouriteGenre: Array.from(qs("#signup-genre").selectedOptions).map(opt => opt.value),
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

const googleSignupForm = qs("#google-signup-form");
if (googleSignupForm) {
  googleSignupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = qs("#gs-password").value;
    const confirm = qs("#gs-password-confirm").value;

    if (password !== confirm) {
      showToast("Passwords do not match.", "error");
      return;
    }

    const payload = {
      name: qs("#gs-name").value,
      username: qs("#gs-username").value,
      className: qs("#gs-class").value,
      section: qs("#gs-section").value,
      rollNumber: qs("#gs-roll").value,
      favouriteGenre: Array.from(qs("#gs-genre").selectedOptions).map(opt => opt.value),
      password: password
    };

    try {
      const profile = await completeGoogleSignUp(payload);
      qs("#google-signup-modal").classList.remove("open");
      showToast("Account created — welcome to the library.");
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}
