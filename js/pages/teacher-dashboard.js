import { requireAuth } from "../firebase/auth.js";
import {
  getAllBooks, getNextBookId, addBook, updateBook, deleteBook,
  getReviewsForBook, deleteReview
} from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, starString, timeAgo, showToast, qs, qsa } from "../utils/helpers.js";

const profile = await requireAuth(["teacher", "admin"]);
renderNavbar(profile, "teacher-dashboard.html");

qs("#teacher-name").textContent = profile.name;
qs("#teacher-eyebrow").textContent = profile.subject ? `${profile.subject} · Teacher tools` : "Teacher tools";

let books = [];

async function loadBooks() {
  books = await getAllBooks();
  renderBooksTable();
}

function renderBooksTable() {
  const tbody = qs("#books-table-body");
  if (!tbody) return;
  tbody.innerHTML = books.map((b) => `
    <tr data-id="${b.BK_ID}" data-docid="${b.id || b.BK_ID}">
      <td class="mono">${b.BK_ID}</td>
      <td>${escapeHTML(b.bookName)}</td>
      <td>${escapeHTML(b.author)}</td>
      <td><span class="spine-tag">${b.genre}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm edit-book-btn">Edit</button>
          <button class="btn btn-danger btn-sm delete-book-btn">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  qsa(".edit-book-btn").forEach((btn) => btn.addEventListener("click", () => openEditModal(btn.closest("tr").dataset.id)));
  qsa(".delete-book-btn").forEach((btn) => btn.addEventListener("click", () => handleDeleteBook(btn.closest("tr"))));
}

async function handleDeleteBook(row) {
  if (!confirm("Remove this book from the catalogue? This cannot be undone.")) return;
  await deleteBook(row.dataset.docid);
  showToast("Book removed from catalogue.");
  loadBooks();
}

/* ---------------------------- Modal: add/edit ---------------------------- */
const modal = qs("#book-modal");

async function openAddModal() {
  qs("#book-modal-title").textContent = "Add book";
  qs("#book-form").reset();
  qs("#book-doc-id").value = "";
  qs("#f-bkid").value = await getNextBookId();
  modal.classList.add("open");
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

qs("#add-book-btn").addEventListener("click", openAddModal);
qs("#cancel-book-modal").addEventListener("click", () => modal.classList.remove("open"));

qs("#book-form").addEventListener("submit", async (e) => {
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
    showToast("Book added to catalogue.");
  }
  modal.classList.remove("open");
  loadBooks();
});

/* ---------------------------- Tabs ---------------------------------------- */
qsa(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    qsa(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    qs("#tab-catalogue").style.display = tab.dataset.tab === "catalogue" ? "block" : "none";
    qs("#tab-reviews").style.display = tab.dataset.tab === "reviews" ? "block" : "none";
    if (tab.dataset.tab === "reviews") loadModerationList();
  });
});

/* ---------------------------- Review moderation ---------------------------- */
async function loadModerationList() {
  const mount = qs("#moderation-list");
  if (!mount) return;
  mount.innerHTML = `<div class="skeleton" style="height:80px;"></div>`;

  const allLists = await Promise.all(books.map(async (b) => ({ book: b, reviews: await getReviewsForBook(b.BK_ID) })));
  const flat = allLists.flatMap(({ book, reviews }) => reviews.map((r) => ({ ...r, book })));

  mount.innerHTML = flat.length ? flat.map((r) => `
    <div class="review-item" data-id="${r.id}" data-book="${r.book.BK_ID}">
      <div class="review-head">
        <div>
          <strong>${escapeHTML(r.userName)}</strong> on <a href="book-details.html?id=${r.book.BK_ID}">${escapeHTML(r.book.bookName)}</a>
          <div class="stars">${starString(r.rating)}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-tertiary" style="font-size:var(--fs-tiny);">${timeAgo(r.timestamp)}</span>
          <button class="btn btn-danger btn-sm mod-delete-review-btn">Remove</button>
        </div>
      </div>
      <p style="margin-top:var(--sp-2);">${escapeHTML(r.reviewText)}</p>
    </div>
  `).join("") : `<div class="empty-state"><h3>Nothing to moderate</h3><p>All reviews are clean right now.</p></div>`;

  qsa(".mod-delete-review-btn", mount).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".review-item");
      await deleteReview(item.dataset.id, null, profile.uid, true);
      showToast("Review removed.");
      loadModerationList();
    });
  });
}

loadBooks();
