// ==========================================================================
// Navbar component
// ==========================================================================

import { initials } from "../utils/helpers.js";
import { logOut } from "../firebase/auth.js";

const NAV_LINKS = [
  { href: "index.html", label: "Home" },
  { href: "guidelines.html", label: "Guidelines" },
  { href: "library.html", label: "Library" },
  { href: "discussions.html", label: "Discussions" },
  { href: "discover.html", label: "Discover People" },
  { href: "leaderboard.html", label: "🏆 Leaderboard" }
];

function roleHome(role) {
  if (role === "teacher" || role === "admin") return "teacher-dashboard.html";
  return "student-dashboard.html";
}

export function renderNavbar(profile, activePage = "") {
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
                <button id="logout-btn">Sign out</button>
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
      ${profile ? `<a href="#" id="mobile-logout">Sign out</a>` : `<a href="login.html">Sign in</a>`}
    </div>
  `;

  wireInteractions();
}

function wireInteractions() {
  const dropdown = document.getElementById("profile-dropdown");
  const trigger = document.getElementById("profile-trigger");
  if (trigger) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => dropdown.classList.remove("open"));
  }

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
