import { watchAuthState } from "../firebase/auth.js";
import { getAllBooks } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { qs, qsa } from "../utils/helpers.js";

watchAuthState((profile) => renderNavbar(profile, "library.html"));

const grid = qs("#library-grid");
const chipRow = qs("#genre-chips");
const searchInput = qs("#search-input");
const countLabel = qs("#results-count");

let books = [];
let activeGenre = "all";

function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = books.filter((b) => {
    const matchesGenre = activeGenre === "all" || b.genre === activeGenre;
    const matchesTerm = !term ||
      b.bookName.toLowerCase().includes(term) ||
      b.author.toLowerCase().includes(term) ||
      b.BK_ID.toLowerCase().includes(term);
    return matchesGenre && matchesTerm;
  });
  if (countLabel) {
    countLabel.textContent = `${filtered.length} book${filtered.length === 1 ? "" : "s"}`;
  }
  if (grid) {
    renderBookGrid(grid, filtered);
  }
}

async function init() {
  books = await getAllBooks();

  const genres = [...new Set(books.map((b) => b.genre))];
  if (chipRow) {
    chipRow.innerHTML = `<button class="genre-chip active" data-genre="all">All genres</button>` +
      genres.map((g) => `<button class="genre-chip" data-genre="${g}">${g}</button>`).join("");

    qsa(".genre-chip", chipRow).forEach((chip) => {
      chip.addEventListener("click", () => {
        qsa(".genre-chip", chipRow).forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        activeGenre = chip.dataset.genre;
        applyFilters();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  applyFilters();
}

init();
