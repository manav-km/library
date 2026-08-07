import { requireAuth } from "../firebase/auth.js";
import { getAllBooks, getNextBookId, addBook, updateBook, deleteBook, logAuditAction } from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { renderBookGrid } from "../components/bookCard.js";
import { ensureReviewModal, wireReviewButtons } from "../components/reviewModal.js";
import { showToast, qs, qsa, ALL_GENRES, MAIN_FILTER_GENRES } from "../utils/helpers.js";

const profile = await requireAuth();
renderNavbar(profile, "library.html");

const grid = qs("#library-grid");
const chipRow = qs("#genre-chips");
const searchInput = qs("#search-input");
const countLabel = qs("#results-count");
const uploadBtn = qs("#upload-book-btn");
const modal = qs("#book-modal");
const deleteModalBtn = qs("#delete-book-modal-btn");

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
    wireReviewButtons(profile);
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
  if (deleteModalBtn) deleteModalBtn.style.display = "inline-flex";
  modal.classList.add("open");
}

let isExpandedGenres = false;

function renderGenreChips() {
  if (!chipRow) return;
  const bookGenres = books.map((b) => b.genre).filter(Boolean);
  const extraGenres = bookGenres.filter((g) => !MAIN_FILTER_GENRES.includes(g));

  const allAvailableGenres = [...new Set([...ALL_GENRES, ...extraGenres])];
  const otherGenres = allAvailableGenres.filter((g) => !MAIN_FILTER_GENRES.includes(g));

  const visibleGenres = isExpandedGenres ? [...MAIN_FILTER_GENRES, ...otherGenres] : MAIN_FILTER_GENRES;

  let html = `<button class="genre-chip ${activeGenre === 'all' ? 'active' : ''}" data-genre="all">All genres</button>`;
  html += visibleGenres.map((g) => `<button class="genre-chip ${activeGenre === g ? 'active' : ''}" data-genre="${g}">${g}</button>`).join("");

  if (isExpandedGenres) {
    html += `<button class="genre-chip show-more-chip" id="toggle-show-more">Show Less ∧</button>`;
  } else {
    html += `<button class="genre-chip show-more-chip" id="toggle-show-more">Show More ∨</button>`;
  }

  chipRow.innerHTML = html;

  qsa(".genre-chip:not(.show-more-chip)", chipRow).forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa(".genre-chip", chipRow).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeGenre = chip.dataset.genre;
      applyFilters();
    });
  });

  const toggleBtn = qs("#toggle-show-more", chipRow);
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isExpandedGenres = !isExpandedGenres;
      renderGenreChips();
    });
  }
}

async function init() {
  books = await getAllBooks();
  renderGenreChips();
  ensureReviewModal(profile);

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  // Top right Upload Book button for Teachers & Admins
  if (canEdit && uploadBtn) {
    uploadBtn.style.display = "inline-flex";
    uploadBtn.addEventListener("click", async () => {
      qs("#book-modal-title").textContent = "Upload book";
      qs("#book-form").reset();
      qs("#book-doc-id").value = "";
      qs("#f-bkid").value = await getNextBookId();
      if (deleteModalBtn) deleteModalBtn.style.display = "none";
      modal.classList.add("open");
    });
  }

  if (deleteModalBtn) {
    deleteModalBtn.addEventListener("click", async () => {
      const docId = qs("#book-doc-id").value;
      const bkId = qs("#f-bkid").value;
      if (!docId) return;
      if (!confirm("Remove this book from the library? This action cannot be undone.")) return;
      await deleteBook(docId);
      logAuditAction({
        action: "BOOK_DELETE",
        category: "Books",
        details: `${profile.name} (${profile.role}) deleted book '${bkId}'.`,
        performedBy: profile,
        targetId: bkId
      });
      showToast("Book deleted.");
      modal.classList.remove("open");
      books = await getAllBooks();
      renderGenreChips();
      applyFilters();
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
      logAuditAction({
        action: "BOOK_EDIT",
        category: "Books",
        details: `${profile.name} (${profile.role}) edited book '${bookData.bookName}' (${bookData.BK_ID}).`,
        performedBy: profile,
        targetId: bookData.BK_ID
      });
      showToast("Book updated.");
    } else {
      await addBook(bookData);
      logAuditAction({
        action: "BOOK_ADD",
        category: "Books",
        details: `${profile.name} (${profile.role}) uploaded book '${bookData.bookName}' (${bookData.BK_ID}).`,
        performedBy: profile,
        targetId: bookData.BK_ID
      });
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
