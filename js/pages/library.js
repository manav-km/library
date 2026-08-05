import { requireAuth } from "../firebase/auth.js";
import { getAllBooks, getNextBookId, addBook, updateBook } from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { showToast, qs, qsa } from "../utils/helpers.js";

const profile = await requireAuth();
renderNavbar(profile, "library.html");

const grid = qs("#library-grid");
const chipRow = qs("#genre-chips");
const searchInput = qs("#search-input");
const countLabel = qs("#results-count");
const uploadFab = qs("#upload-book-fab");
const modal = qs("#book-modal");

let books = [];
let activeGenre = "all";
const canEdit = profile && (profile.role === "teacher" || profile.role === "admin");

function applyFilters() {
  const term = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filtered = books.filter((b) => {
    const matchesGenre = activeGenre === "all" || b.genre === activeGenre;
    const matchesTerm = !term ||
      (b.bookName || "").toLowerCase().includes(term) ||
      (b.author || "").toLowerCase().includes(term) ||
      (b.BK_ID || "").toLowerCase().includes(term);
    return matchesGenre && matchesTerm;
  });
  if (countLabel) {
    countLabel.textContent = `${filtered.length} book${filtered.length === 1 ? "" : "s"}`;
  }
  if (grid) {
    renderBookGrid(grid, filtered, canEdit);
    wireCardEditButtons();
  }
}

function wireCardEditButtons() {
  if (!canEdit) return;
  qsa(".edit-card-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditModal(btn.dataset.bkid);
    });
  });
}

function openEditModal(bkId) {
  const b = books.find((x) => x.BK_ID === bkId);
  if (!b) return;
  qs("#book-modal-title").textContent = "Edit book";
  qs("#book-doc-id").value = b.id || b.BK_ID;
  qs("#f-bkid").value = b.BK_ID;
  qs("#f-name").value = b.bookName || "";
  qs("#f-author").value = b.author || "";
  qs("#f-year").value = b.year || "";
  qs("#f-genre").value = b.genre || "Fiction";
  qs("#f-mainidea").value = b.mainIdea || "";
  qs("#f-themes").value = (b.themes || []).join(", ");
  qs("#f-characters").value = (b.characters || []).map((c) => `${c.name} | ${c.role} | ${c.note || ""}`).join("\n");
  qs("#f-setting").value = b.setting || "";
  qs("#f-plot").value = b.plot || "";
  qs("#f-conflict").value = b.conflict || "";
  qs("#f-resolution").value = b.resolution || "";
  qs("#f-moral").value = b.moral || "";
  qs("#f-summary").value = b.summary || "";
  modal.classList.add("open");
}

function renderGenreChips() {
  if (!chipRow) return;
  const genres = [...new Set(books.map((b) => b.genre))];
  chipRow.innerHTML = `<button class="genre-chip ${activeGenre === 'all' ? 'active' : ''}" data-genre="all">All genres</button>` +
    genres.map((g) => `<button class="genre-chip ${activeGenre === g ? 'active' : ''}" data-genre="${g}">${g}</button>`).join("");

  qsa(".genre-chip", chipRow).forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa(".genre-chip", chipRow).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeGenre = chip.dataset.genre;
      applyFilters();
    });
  });
}

async function init() {
  books = await getAllBooks();
  renderGenreChips();

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  // Teacher / Admin Upload Book FAB
  if (canEdit && uploadFab) {
    uploadFab.style.display = "inline-flex";
    uploadFab.addEventListener("click", async () => {
      qs("#book-modal-title").textContent = "Upload book";
      qs("#book-form").reset();
      qs("#book-doc-id").value = "";
      qs("#f-bkid").value = await getNextBookId();
      modal.classList.add("open");
    });
  }

  qs("#cancel-book-modal")?.addEventListener("click", () => modal.classList.remove("open"));

  qs("#book-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const characters = qs("#f-characters").value.split("\n").filter(Boolean).map((line) => {
      const [name, role, note] = line.split("|").map((s) => (s || "").trim());
      return { name, role, note };
    });

    const parsedYear = parseInt(qs("#f-year").value, 10);
    const bookData = {
      BK_ID: qs("#f-bkid").value,
      bookName: qs("#f-name").value,
      author: qs("#f-author").value,
      year: isNaN(parsedYear) ? new Date().getFullYear() : parsedYear,
      genre: qs("#f-genre").value,
      mainIdea: qs("#f-mainidea").value,
      themes: qs("#f-themes").value.split(",").map((t) => t.trim()).filter(Boolean),
      characters,
      setting: qs("#f-setting").value,
      plot: qs("#f-plot").value,
      conflict: qs("#f-conflict").value,
      resolution: qs("#f-resolution").value,
      moral: qs("#f-moral").value,
      summary: qs("#f-summary").value,
      coverImage: ""
    };

    const coverFile = qs("#f-cover").files[0];
    if (coverFile) bookData.coverImage = await uploadImage(coverFile, "covers", bookData.BK_ID);

    const docId = qs("#book-doc-id").value;
    if (docId) {
      await updateBook(docId, bookData);
      showToast("Book updated.");
    } else {
      await addBook(bookData);
      showToast("Book uploaded to library.");
    }

    modal.classList.remove("open");

    // Refresh library data live
    books = await getAllBooks();
    renderGenreChips();
    applyFilters();
  });

  applyFilters();
}

init();
