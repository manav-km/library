import { signUp, logIn, signInWithGoogle } from "../firebase/auth.js";
import { showToast, qs, qsa } from "../utils/helpers.js";

// ---- Tab switching ----
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

function redirectByRole(profile) {
  if (profile.role === "teacher") window.location.href = "teacher-dashboard.html";
  else if (profile.role === "admin") window.location.href = "admin-panel.html";
  else window.location.href = "student-dashboard.html";
}

// ---- Google Sign-in handler ----
qsa(".google-signin-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      const profile = await signInWithGoogle();
      showToast(`Signed in with Google — welcome back, ${profile.name.split(" ")[0]}.`);
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      showToast(err.message || "Google sign-in failed. Try again.", "error");
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
      showToast(err.message || "Could not sign in. Check your details.", "error");
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: qs("#signup-name").value,
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
      showToast(err.message || "Could not create account.", "error");
    }
  });
}

