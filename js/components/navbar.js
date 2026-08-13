// ==========================================================================
// Navbar component with Account Switcher
// ==========================================================================

import { initials, escapeHTML, showToast } from "../utils/helpers.js";
import { logOut, getSavedAccounts, removeSavedAccount, switchAccountDirect } from "../firebase/auth.js";

const NAV_LINKS = [
  { href: "index.html", label: "Home" },
  { href: "guidelines.html", label: "Guidelines" },
  { href: "library.html", label: "Library" },
  { href: "discussions.html", label: "Discussions" },
  { href: "discover.html", label: "Discover People" },
  { href: "leaderboard.html", label: "Leaderboard" }
];

function roleHome(role) {
  if (role === "teacher" || role === "admin") return "teacher-dashboard.html";
  return "student-dashboard.html";
}

let activeUserProfile = null;

export function renderNavbar(profile, activePage = "") {
  activeUserProfile = profile;
  const mount = document.getElementById("navbar-mount");
  if (!mount) return;

  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="${activePage === l.href ? "active" : ""}">${l.label}</a>`
  ).join("");

  const dashboardHref = profile ? roleHome(profile.role) : "login.html";
  const canManage = profile && (profile.role === "teacher" || profile.role === "admin");
  const manageHref = "manage.html";

  mount.innerHTML = `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="nav-brand">
          <img src="assets/image.jpeg" class="brand-logo" alt="SAJS Logo" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">
          SAJS Library Site
        </a>

        <div class="nav-links">
          ${links}
          <a href="${dashboardHref}" class="${activePage === dashboardHref ? "active" : ""}">Dashboard</a>
          ${canManage ? `<a href="${manageHref}" class="${activePage === manageHref ? "active" : ""}">Manage</a>` : ""}
        </div>

        <div class="nav-right">
          ${profile ? `
            <div class="dropdown" id="profile-dropdown">
              <button class="avatar" id="profile-trigger" aria-haspopup="true" aria-label="Open profile menu">
                ${profile.profilePicture ? `<img src="${profile.profilePicture}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials(profile.name)}
              </button>
              <div class="dropdown-menu">
                <div style="padding:8px 12px; margin-bottom:4px; border-bottom:1px solid var(--glass-border); font-size:var(--fs-tiny);">
                  <strong>${escapeHTML(profile.name)}</strong>
                  <div class="text-tertiary" style="font-size:0.7rem; margin-top:2px;">${escapeHTML(profile.email || "")}</div>
                </div>
                <button id="switch-account-btn" style="display:flex; align-items:center; gap:6px; cursor:pointer;">🔄 Switch account</button>
                <button id="logout-btn" style="color:var(--danger); display:flex; align-items:center; gap:6px; cursor:pointer;">🚪 Sign out</button>
              </div>
            </div>
          ` : `
            <a href="login.html" class="btn btn-primary btn-sm">Sign in</a>
          `}
          <button class="hamburger" id="hamburger-btn" aria-label="Open menu" aria-expanded="false">
            <span></span>
          </button>
        </div>
      </div>
    </nav>

    <div class="mobile-nav" id="mobile-nav">
      ${links}
      ${profile ? `<a href="${dashboardHref}">Dashboard</a>` : ""}
      ${canManage ? `<a href="${manageHref}">Manage</a>` : ""}
      ${profile ? `<a href="#" id="mobile-switch">🔄 Switch account</a>` : ""}
      ${profile ? `<a href="#" id="mobile-logout">Sign out</a>` : `<a href="login.html">Sign in</a>`}
    </div>
  `;

  wireInteractions();
}

function renderSwitchModal(currentProfile) {
  let modal = document.getElementById("switch-account-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "switch-account-modal";
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
  }

  const accounts = getSavedAccounts();
  const listHTML = accounts.length
    ? accounts.map((acc) => {
        const isCurrent = currentProfile && currentProfile.email && currentProfile.email.toLowerCase() === acc.email.toLowerCase();
        const initial = initials(acc.name || "U");
        return `
          <div class="flex justify-between items-center" style="padding:10px 12px; background:var(--bg-card); border:1px solid var(--glass-border); border-radius:var(--radius-sm); margin-bottom:8px;">
            <div class="flex items-center gap-3">
              ${acc.profilePicture ? `<img src="${acc.profilePicture}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : `<div class="avatar avatar-sm">${initial}</div>`}
              <div>
                <strong style="font-size:var(--fs-small);">${escapeHTML(acc.name)}</strong> ${isCurrent ? `<span class="badge badge-approved" style="font-size:0.6rem; margin-left:4px;">Current</span>` : ''}
                <div class="text-tertiary" style="font-size:var(--fs-tiny);">${escapeHTML(acc.email)} · ${acc.role}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${!isCurrent ? `<button class="btn btn-primary btn-sm switch-acc-btn" data-email="${escapeHTML(acc.email)}">Switch</button>` : ''}
              <button class="btn btn-ghost btn-sm remove-acc-btn" data-email="${escapeHTML(acc.email)}" style="color:var(--danger); padding:4px 8px;" title="Remove from list">✕</button>
            </div>
          </div>`;
      }).join("")
    : `<p class="text-tertiary" style="font-size:var(--fs-small);">No other accounts saved on this device.</p>`;

  modal.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <h3 style="margin-bottom:var(--sp-4);">🔄 Switch Account</h3>
      <div id="saved-accounts-list">${listHTML}</div>
      <div class="flex gap-3" style="margin-top:var(--sp-5);">
        <button class="btn btn-ghost btn-block" id="close-switch-modal">Cancel</button>
        <button class="btn btn-primary btn-block" id="add-account-btn">+ Add Account</button>
      </div>
    </div>`;

  modal.classList.add("open");

  modal.querySelector("#close-switch-modal")?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

  modal.querySelectorAll(".switch-acc-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      btn.disabled = true;
      btn.textContent = "Switching...";
      showToast("Switching account...", "info");
      try {
        const newProfile = await switchAccountDirect(email);
        if (newProfile) {
          showToast(`Switched to ${newProfile.name}`, "success");
          setTimeout(() => {
            window.location.href = roleHome(newProfile.role);
          }, 300);
        }
      } catch (err) {
        showToast("Switch failed: " + err.message, "error");
        btn.disabled = false;
        btn.textContent = "Switch";
      }
    });
  });

  modal.querySelectorAll(".remove-acc-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const email = btn.dataset.email;
      removeSavedAccount(email);
      renderSwitchModal(currentProfile);
    });
  });

  modal.querySelector("#add-account-btn")?.addEventListener("click", async () => {
    await logOut();
    window.location.href = "login.html";
  });
}

function wireInteractions() {
  const dropdown = document.getElementById("profile-dropdown");
  const trigger = document.getElementById("profile-trigger");
  if (trigger) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => dropdown?.classList.remove("open"));
  }

  const switchBtn = document.getElementById("switch-account-btn");
  const mobileSwitch = document.getElementById("mobile-switch");
  [switchBtn, mobileSwitch].forEach((btn) => {
    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      dropdown?.classList.remove("open");
      renderSwitchModal(activeUserProfile);
    });
  });

  const logoutBtn = document.getElementById("logout-btn");
  const mobileLogout = document.getElementById("mobile-logout");
  [logoutBtn, mobileLogout].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logOut();
      window.location.href = "login.html";
    });
  });

  const hamburger = document.getElementById("hamburger-btn");
  const mobileNav = document.getElementById("mobile-nav");
  if (hamburger && mobileNav) {
    hamburger.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("open");
      hamburger.classList.toggle("open", open);
      hamburger.setAttribute("aria-expanded", String(open));
    });
  }
}
