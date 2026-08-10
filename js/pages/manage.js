import { requireAuth } from "../firebase/auth.js";
import {
  getAllBooks, getNextBookId, addBook, updateBook, deleteBook,
  getReviewsForBook, deleteReview, getAllUsers, setUserRole,
  logAuditAction, getAuditLogs
} from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, starString, timeAgo, showToast, initials, qs, qsa } from "../utils/helpers.js";

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
    qs("#tab-audit").style.display = currentTab === "audit" ? "block" : "none";
    qs("#tab-users").style.display = currentTab === "users" ? "block" : "none";

    if (addBtn) {
      addBtn.style.display = currentTab === "catalogue" ? "inline-flex" : "none";
    }

    if (currentTab === "reviews") loadModerationList();
    if (currentTab === "students") loadStudents();
    if (currentTab === "audit") loadAuditLogs();
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
  const docId = row.dataset.docid;
  const bkId = row.dataset.id;
  await deleteBook(docId);
  logAuditAction({
    action: "BOOK_DELETE",
    category: "Books",
    details: `${profile.name} (${profile.role}) removed book '${bkId}' from the catalogue.`,
    performedBy: profile,
    targetId: bkId
  });
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
    const bkId = qs("#f-bkid").value;
    if (!docId) return;
    if (!confirm("Delete this book from the catalogue? This action cannot be undone.")) return;
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
  const pdfFile = qs("#f-pdf").files[0];
  if (pdfFile) bookData.pdfUrl = await uploadImage(pdfFile, "pdfs", bookData.BK_ID);
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
      details: `${profile.name} (${profile.role}) added new book '${bookData.bookName}' (${bookData.BK_ID}) to catalogue.`,
      performedBy: profile,
      targetId: bookData.BK_ID
    });
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
      logAuditAction({
        action: "REVIEW_DELETE",
        category: "Reviews",
        details: `${profile.name} (${profile.role}) removed a review on book '${item.dataset.book}'.`,
        performedBy: profile,
        targetId: item.dataset.book
      });
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
  tbody.innerHTML = list.map((u) => {
    const userId = u.id || u.uid;
    return `
      <tr data-uid="${userId}">
        <td>${escapeHTML(u.name || "—")}</td>
        <td>${escapeHTML(u.email || "—")}</td>
        <td>${roleBadge(u.role || "student")}</td>
        <td>${u.className ? `${escapeHTML(u.className)}-${escapeHTML(u.section || "—")}` : "—"}</td>
        <td>
          <button class="btn btn-ghost btn-sm view-profile-btn" data-uid="${userId}">View profile</button>
        </td>
      </tr>
    `;
  }).join("");

  qsa(".view-profile-btn", tbody).forEach((btn) => {
    btn.addEventListener("click", () => openProfileModal(btn.dataset.uid));
  });
}

async function loadUsers() {
  users = await getAllUsers();
  renderUsersTable(users);
}

const userSearch = qs("#user-search");
if (userSearch) {
  userSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    renderUsersTable(users.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)));
  });
}

/* ==========================================================================
   Student Management
   ========================================================================== */
let students = [];

function renderStudentsTable(list) {
  const tbody = qs("#students-table-body");
  if (!tbody) return;
  tbody.innerHTML = list.length ? list.map((s) => {
    const userId = s.id || s.uid;
    return `
      <tr data-uid="${userId}">
        <td><strong>${escapeHTML(s.name)}</strong></td>
        <td>${escapeHTML(s.email)}</td>
        <td>${s.className ? `Class ${escapeHTML(s.className)}-${escapeHTML(s.section || '—')}` : "—"}</td>
        <td class="mono">${escapeHTML(s.rollNumber || "—")}</td>
        <td><span class="spine-tag">${escapeHTML(s.favouriteGenre || "Fiction")}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm view-profile-btn" data-uid="${userId}">View profile</button>
        </td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6" class="text-tertiary" style="text-align:center; padding:var(--sp-4);">No matching students found.</td></tr>`;

  qsa(".view-profile-btn", tbody).forEach((btn) => {
    btn.addEventListener("click", () => openProfileModal(btn.dataset.uid));
  });
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

/* ==========================================================================
   Audit Logs
   ========================================================================== */
let auditLogs = [];

function categoryBadge(category) {
  const cat = (category || "General").toLowerCase();
  if (cat === "books") return `<span class="badge" style="background:rgba(124,140,248,0.15); color:var(--spine-fiction); border:1px solid rgba(124,140,248,0.3);">Books</span>`;
  if (cat === "reviews") return `<span class="badge" style="background:rgba(251,191,36,0.15); color:var(--warning); border:1px solid rgba(251,191,36,0.3);">Reviews</span>`;
  if (cat === "profile") return `<span class="badge" style="background:rgba(34,211,238,0.15); color:var(--cyan-400); border:1px solid rgba(34,211,238,0.3);">Profile</span>`;
  if (cat === "users") return `<span class="badge" style="background:rgba(167,139,250,0.15); color:var(--spine-scifi); border:1px solid rgba(167,139,250,0.3);">Users</span>`;
  return `<span class="badge">${escapeHTML(category)}</span>`;
}

function renderAuditLogsTable(list) {
  const tbody = qs("#audit-table-body");
  if (!tbody) return;
  tbody.innerHTML = list.length ? list.map((l) => `
    <tr>
      <td class="text-tertiary mono" style="font-size:var(--fs-tiny); white-space:nowrap;">${timeAgo(l.timestamp)}</td>
      <td>${categoryBadge(l.category)}</td>
      <td>${escapeHTML(l.details)}</td>
      <td>
        <strong style="font-size:var(--fs-small);">${escapeHTML(l.performedBy?.name || 'System')}</strong>
        <div class="text-tertiary" style="font-size:var(--fs-tiny);">${escapeHTML(l.performedBy?.email || '')} · ${escapeHTML(l.performedBy?.role || 'user')}</div>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="4" class="text-tertiary" style="text-align:center; padding:var(--sp-4);">No audit log entries recorded yet.</td></tr>`;
}

async function loadAuditLogs() {
  const mount = qs("#audit-table-body");
  if (mount) mount.innerHTML = `<tr><td colspan="4"><div class="skeleton" style="height:60px;"></div></td></tr>`;
  auditLogs = await getAuditLogs();
  renderAuditLogsTable(auditLogs);
}

const auditSearch = qs("#audit-search");
if (auditSearch) {
  auditSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = auditLogs.filter((l) => {
      const detailsMatch = (l.details || "").toLowerCase().includes(term);
      const categoryMatch = (l.category || "").toLowerCase().includes(term);
      const userMatch = (l.performedBy?.name || "").toLowerCase().includes(term);
      const emailMatch = (l.performedBy?.email || "").toLowerCase().includes(term);
      const actionMatch = (l.action || "").toLowerCase().includes(term);
      return detailsMatch || categoryMatch || userMatch || emailMatch || actionMatch;
    });
    renderAuditLogsTable(filtered);
  });
}

/* ==========================================================================
   User Profile Modal
   ========================================================================== */
function openProfileModal(uid) {
  const targetUser = users.find((u) => (u.id === uid || u.uid === uid))
                  || students.find((s) => (s.id === uid || s.uid === uid));
  if (!targetUser) {
    showToast("User profile not found.", "error");
    return;
  }

  const container = qs("#user-profile-content");
  if (!container) return;

  const role = targetUser.role || "student";
  const userInitials = initials(targetUser.name || "U");
  const avatarHTML = targetUser.profilePicture
    ? `<img src="${escapeHTML(targetUser.profilePicture)}" class="avatar avatar-lg" alt="${escapeHTML(targetUser.name)}">`
    : `<div class="avatar avatar-lg">${escapeHTML(userInitials)}</div>`;

  const formattedDate = targetUser.createdAt
    ? new Date(targetUser.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: var(--sp-4);">
      <div style="display: flex; justify-content: center; margin-bottom: var(--sp-3);">
        ${avatarHTML}
      </div>
      <h3 style="margin: 0 0 4px 0; font-size: var(--fs-h3);">${escapeHTML(targetUser.name || "Unnamed User")}</h3>
      <div style="margin-bottom: var(--sp-2);">${roleBadge(role)}</div>
      <p class="text-tertiary" style="margin: 0; font-size: var(--fs-small);">${escapeHTML(targetUser.email || "No email")}</p>
    </div>

    <div class="card" style="background: rgba(255,255,255,0.02); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3);">
      ${targetUser.className ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Class & Section</span>
          <strong>Class ${escapeHTML(targetUser.className)}-${escapeHTML(targetUser.section || "—")}</strong>
        </div>
      ` : ""}
      ${targetUser.rollNumber ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Roll Number</span>
          <strong class="mono">${escapeHTML(targetUser.rollNumber)}</strong>
        </div>
      ` : ""}
      ${targetUser.favouriteGenre ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Favourite Genre</span>
          <span class="spine-tag">${escapeHTML(targetUser.favouriteGenre)}</span>
        </div>
      ` : ""}
      ${targetUser.subject ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Subject</span>
          <strong>${escapeHTML(targetUser.subject)}</strong>
        </div>
      ` : ""}
      ${targetUser.bio ? `
        <div style="font-size: var(--fs-small); border-top: 1px solid var(--glass-border); padding-top: var(--sp-2); margin-top: var(--sp-1);">
          <span class="text-tertiary" style="display:block; margin-bottom: 4px;">Bio</span>
          <p style="margin:0; font-style: italic;">"${escapeHTML(targetUser.bio)}"</p>
        </div>
      ` : ""}
      ${formattedDate ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-tiny); color: var(--text-tertiary); border-top: 1px solid var(--glass-border); padding-top: var(--sp-2); margin-top: var(--sp-1);">
          <span>Joined</span>
          <span>${formattedDate}</span>
        </div>
      ` : ""}
    </div>
  `;

  qs("#user-profile-modal").classList.add("open");
}

qs("#close-user-profile-x")?.addEventListener("click", () => qs("#user-profile-modal").classList.remove("open"));
qs("#close-user-profile-btn")?.addEventListener("click", () => qs("#user-profile-modal").classList.remove("open"));
qs("#user-profile-modal")?.addEventListener("click", (e) => {
  if (e.target === qs("#user-profile-modal")) {
    qs("#user-profile-modal").classList.remove("open");
  }
});

// Initial load
loadBooks();
