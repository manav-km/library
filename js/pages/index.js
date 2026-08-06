import { watchAuthState } from "../firebase/auth.js";
import { getAllBooks } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { ensureReviewModal, wireReviewButtons } from "../components/reviewModal.js";
import { spineColorFor } from "../utils/helpers.js";

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

  // Hero shelf: one spine per genre present in the catalogue, signature motif
  const genres = [...new Set(books.map((b) => b.genre))].filter(Boolean).slice(0, 8);
  const shelf = document.getElementById("hero-shelf");
  if (shelf && genres.length) {
    shelf.innerHTML = genres
      .map((g, i) => `<div class="spine" style="--spine-color:${spineColorFor(g)}; animation-delay:${i * 60}ms;">${g}</div>`)
      .join("");
  }

  const featured = document.getElementById("featured-books");
  const recent = document.getElementById("recent-books");
  if (featured) renderBookGrid(featured, books.slice(0, 4));
  if (recent) renderBookGrid(recent, books.slice(0, 6));

  if (currentProfile) wireReviewButtons(currentProfile);
}

init();
