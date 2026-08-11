import { watchAuthState } from "../firebase/auth.js";
import { getAllBooks, getAnnouncements } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { ensureReviewModal, wireReviewButtons } from "../components/reviewModal.js";
import { spineColorFor, ALL_GENRES } from "../utils/helpers.js";

let currentProfile = null;

watchAuthState((profile) => {
  currentProfile = profile;
  renderNavbar(profile, "index.html");
  const authBtn = document.getElementById("hero-auth-btn");
  if (authBtn) {
    if (profile) {
      authBtn.href = "discussions.html";
      authBtn.textContent = "Discuss";
    } else {
      authBtn.href = "login.html";
      authBtn.textContent = "Sign in";
    }
  }
  if (profile) ensureReviewModal(profile);
});

async function init() {
  const books = await getAllBooks();

  // Hero shelf: 8 distinct spines from catalogue & master genres
  const bookGenres = books.map((b) => b.genre).filter(Boolean);
  const genres = [...new Set([...bookGenres, ...ALL_GENRES])].slice(0, 8);
  const shelf = document.getElementById("hero-shelf");
  if (shelf) {
    shelf.innerHTML = genres
      .map((g, i) => `<div class="spine" style="--spine-color:${spineColorFor(g)}; animation-delay:${i * 60}ms;">${g}</div>`)
      .join("");
  }

  const featured = document.getElementById("featured-books");
  const recent = document.getElementById("recent-books");
  if (featured) renderBookGrid(featured, books.slice(0, 4));
  if (recent) renderBookGrid(recent, books.slice(0, 6));

  if (currentProfile) wireReviewButtons(currentProfile);

  // ── Announcements ────────────────────────────────────────────────────────
  const annList = document.getElementById("announcements-list");
  if (annList) {
    try {
      const announcements = await getAnnouncements();
      if (!announcements.length) {
        annList.innerHTML = `<p class="text-tertiary" style="font-size:var(--fs-small);">No announcements at this time.</p>`;
      } else {
        annList.innerHTML = announcements.map(a => {
          const date = new Date(a.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
          return `
            <div class="announcement">
              <span class="dot"></span>
              <div>
                <strong style="color:var(--text-primary); font-size:var(--fs-small);">${a.title}</strong>
                <p style="margin:2px 0 4px; font-size:var(--fs-tiny); color:var(--text-secondary);">${a.body}</p>
                <span style="font-size:var(--fs-tiny); color:var(--text-tertiary);">Posted ${date} · ${a.authorName}</span>
              </div>
            </div>
          `;
        }).join("");
      }
    } catch (err) {
      console.warn("Could not load announcements:", err);
    }
  }
}

init();
