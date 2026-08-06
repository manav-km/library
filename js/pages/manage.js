import { requireAuth } from "../firebase/auth.js";
import {
  getAllBooks, getNextBookId, addBook, updateBook, deleteBook,
  getReviewsForBook, deleteReview, getAllUsers, setUserRole
} from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, starString, timeAgo, showToast, qs, qsa } from "../utils/helpers.js";

const profile = await requireAuth(["teacher", "admin"]);
renderNavbar(profile, "manage.html");

const eyebrow = qs("#manage-eyebrow");
const title = qs("#manage-title");
const addBtn = qs("#add-book-btn");
const tabUsersNav = qs("#tab-users-nav");

if (profile.role === "admin") {
  if (eyebrow) eyebrow.textContent = "Full permissions · Admin tools";
  if (title) title.textContent = "Library Management & Admin";
  if (tabUsersNav) tabUsersNav.style.display = "block";
} else {
  if (eyebrow) eyebrow.textContent = profile.subject ? `${profile.subject} · Teacher tools` : "Teacher tools";
  if (title) title.textContent = "Library Management";
}

/* ==========================================================================
   Tabs
   ========================================================================== */
let currentTab = "catalogue";

qsa(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    qsa(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;

    qs("#tab-catalogue").style.display = currentTab === "catalogue" ? "block" : "none";
    qs("#tab-reviews").style.display = currentTab === "reviews" ? "block" : "none";
    qs("#tab-students").style.display = currentTab === "students" ? "block" : "none";
    qs("#tab-users").style.display = currentTab === "users" ? "block" : "none";

    if (addBtn) {
      addBtn.style.display = currentTab === "catalogue" ? "inline-flex" : "none";
    }

    if (currentTab === "reviews") loadModerationList();
    if (currentTab === "students") loadStudents();
    if (currentTab === "users" && profile.role === "admin") loadUsers();
  });
});

/* ==========================================================================
   Catalogue Management
   ========================================================================== */
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

/* ---------------------------- Modal: Add / Edit Book ---------------------------- */
const modal = qs("#book-modal");
const deleteModalBtn = qs("#delete-book-modal-btn");

async function openAddModal() {
  qs("#book-modal-title").textContent = "Add book";
  qs("#book-form").reset();
  qs("#book-doc-id").value = "";
  qs("#f-bkid").value = await getNextBookId();
  if (deleteModalBtn) deleteModalBtn.style.display = "none";
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
  if (deleteModalBtn) deleteModalBtn.style.display = "inline-flex";
  modal.classList.add("open");
}

if (deleteModalBtn) {
  deleteModalBtn.addEventListener("click", async () => {
    const docId = qs("#book-doc-id").value;
    if (!docId) return;
    if (!confirm("Delete this book from the catalogue? This action cannot be undone.")) return;
    await deleteBook(docId);
    showToast("Book deleted.");
    modal.classList.remove("open");
    loadBooks();
  });
}

if (addBtn) addBtn.addEventListener("click", openAddModal);
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
    showToast("Book added to catalogue.");
  }
  modal.classList.remove("open");
  loadBooks();
});

/* ==========================================================================
   Review Moderation
   ========================================================================== */
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

/* ==========================================================================
   User Management (Admin Only)
   ========================================================================== */
let users = [];

function roleBadge(role) {
  return `<span class="badge badge-role-${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`;
}

function renderUsersTable(list) {
  const tbody = qs("#users-table-body");
  if (!tbody) return;
  tbody.innerHTML = list.map((u) => `
    <tr data-uid="${u.uid || u.id}">
      <td>${escapeHTML(u.name)}</td>
      <td>${escapeHTML(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.className ? `${u.className}-${u.section}` : "—"}</td>
      <td>
        ${u.role === "admin" ? `<span class="text-tertiary" style="font-size:var(--fs-tiny);">Cannot modify</span>` : `
          <div class="flex gap-2">
            ${u.role === "student"
              ? `<button class="btn btn-primary btn-sm promote-btn">Make teacher</button>`
              : `<button class="btn btn-ghost btn-sm demote-btn">Revoke teacher</button>`}
          </div>
        `}
      </td>
    </tr>
  `).join("");

  qsa(".promote-btn").forEach((btn) => btn.addEventListener("click", () => changeRole(btn.closest("tr").dataset.uid, "teacher")));
  qsa(".demote-btn").forEach((btn) => btn.addEventListener("click", () => changeRole(btn.closest("tr").dataset.uid, "student")));
}

async function changeRole(uid, role) {
  await setUserRole(uid, role);
  showToast(role === "teacher" ? "Teacher access granted." : "Teacher access revoked.");
  users = users.map((u) => (u.uid === uid || u.id === uid ? { ...u, role } : u));
  renderUsersTable(users);
}

async function loadUsers() {
  users = await getAllUsers();
  renderUsersTable(users);
}

/* ==========================================================================
   Student Management
   ========================================================================== */
let students = [];

function renderStudentsTable(list) {
  const tbody = qs("#students-table-body");
  if (!tbody) return;
  tbody.innerHTML = list.length ? list.map((s) => `
    <tr data-uid="${s.uid || s.id}">
      <td><strong>${escapeHTML(s.name)}</strong></td>
      <td>${escapeHTML(s.email)}</td>
      <td>${s.className ? `Class ${escapeHTML(s.className)}-${escapeHTML(s.section || '—')}` : "—"}</td>
      <td class="mono">${escapeHTML(s.rollNumber || "—")}</td>
      <td><span class="spine-tag">${escapeHTML(s.favouriteGenre || "Fiction")}</span></td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-4);">No matching students found.</td></tr>`;
}

async function loadStudents() {
  const allUsers = await getAllUsers();
  students = allUsers.filter((u) => u.role === "student");
  renderStudentsTable(students);
}

const studentSearch = qs("#student-search");
if (studentSearch) {
  studentSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = students.filter((s) => {
      const nameMatch = (s.name || "").toLowerCase().includes(term);
      const emailMatch = (s.email || "").toLowerCase().includes(term);
      const classMatch = (s.className || "").toLowerCase().includes(term);
      const secMatch = (s.section || "").toLowerCase().includes(term);
      const rollMatch = (s.rollNumber || "").toLowerCase().includes(term);
      return nameMatch || emailMatch || classMatch || secMatch || rollMatch;
    });
    renderStudentsTable(filtered);
  });
}

// Initial load
loadBooks();
