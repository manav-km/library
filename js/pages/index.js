import { watchAuthState } from "../firebase/auth.js";
import { getAllBooks } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { spineColorFor } from "../utils/helpers.js";

watchAuthState((profile) => renderNavbar(profile, "index.html"));

async function init() {
  const books = await getAllBooks();

  // Hero shelf: one spine per genre present in the catalogue, signature motif
  const genres = [...new Set(books.map((b) => b.genre))].slice(0, 8);
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
}

init();
