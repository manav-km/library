// ==========================================================================
// Email Verification Page Logic
// ==========================================================================

import { auth } from "../firebase/firebase-config.js";
import { watchAuthState, resendVerificationEmail, logOut } from "../firebase/auth.js";
import { renderNavbar } from "../components/navbar.js";
import { showToast, qs } from "../utils/helpers.js";

function roleHome(role) {
  if (role === "teacher" || role === "admin") return "teacher-dashboard.html";
  return "student-dashboard.html";
}

watchAuthState(async (profile) => {
  if (!profile || !auth.currentUser) {
    window.location.href = "login.html";
    return;
  }

  renderNavbar(profile, "");

  // Reload current user to check for latest emailVerified flag
  await auth.currentUser.reload();
  const user = auth.currentUser;

  // Google Provider users or verified users bypass this screen
  const isGoogleUser = user.providerData.some((p) => p.providerId === "google.com");
  if (user.emailVerified || isGoogleUser) {
    window.location.href = roleHome(profile.role);
    return;
  }

  qs("#user-email-tag").textContent = user.email || profile.email;

  // Live 72-hour countdown calculation
  const createdAt = profile.createdAt || Date.now();
  const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

  function updateCountdown() {
    const elapsed = Date.now() - createdAt;
    const remainingMs = SEVENTY_TWO_HOURS_MS - elapsed;
    const countdownEl = qs("#verify-countdown");
    if (!countdownEl) return;

    if (remainingMs <= 0) {
      countdownEl.textContent = "Deadline expired. Account queued for deletion.";
      return;
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);
    countdownEl.textContent = `Time remaining: ${hours}h ${mins}m ${secs}s`;
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Wire buttons
  qs("#check-verified-btn")?.addEventListener("click", async () => {
    const btn = qs("#check-verified-btn");
    btn.disabled = true;
    btn.textContent = "Checking...";
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        showToast("Email verified successfully! Welcome.", "success");
        setTimeout(() => {
          window.location.href = roleHome(profile.role);
        }, 600);
      } else {
        showToast("Email is not verified yet. Please click the link in your inbox.", "error");
      }
    } catch (err) {
      showToast("Error checking verification: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "I've verified my email →";
    }
  });

  qs("#resend-email-btn")?.addEventListener("click", async () => {
    const btn = qs("#resend-email-btn");
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      await resendVerificationEmail();
      showToast("Verification email sent! Please check your inbox and spam folder.", "success");
    } catch (err) {
      showToast("Failed to resend email: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "✉️ Resend verification email";
    }
  });

  qs("#signout-verify-btn")?.addEventListener("click", async () => {
    await logOut();
    window.location.href = "login.html";
  });
});
