import { watchAuthState } from "../firebase/auth.js";
import { getAllBooks, getAllAnnouncements } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { ensureReviewModal, wireReviewButtons } from "../components/reviewModal.js";
import { spineColorFor, ALL_GENRES, escapeHTML } from "../utils/helpers.js";

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

  const annContainer = document.getElementById("announcements-container");
  if (annContainer) {
    const announcements = await getAllAnnouncements();
    if (announcements.length) {
      annContainer.innerHTML = announcements.map(a => `
        <div class="announcement" style="margin-bottom:var(--sp-3);">
          <span class="dot"></span>
          <div>
            <strong style="font-size:var(--fs-small);">${escapeHTML(a.heading)}</strong>
            <p style="margin:2px 0 0; font-size:var(--fs-small);">${escapeHTML(a.content)}</p>
          </div>
        </div>
      `).join("");
    } else {
      annContainer.innerHTML = `<p class="text-tertiary" style="font-size:var(--fs-small);">No recent announcements.</p>`;
    }
  }

  if (currentProfile) wireReviewButtons(currentProfile);
}

init();
