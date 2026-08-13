import { requireAuth } from "../firebase/auth.js";
import {
  getAllBooks, getNextBookId, addBook, updateBook, deleteBook,
  getReviewsForBook, deleteReview, getAllUsers, setUserRole,
  logAuditAction, getAuditLogs,
  addAnnouncement, getAnnouncements, deleteAnnouncement, updateAnnouncement,
  getBookIssues, updateBookIssueStatus
} from "../firebase/firestore.js";
import { uploadImage, uploadFile } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, starString, timeAgo, showToast, initials, qs, qsa, withTimeout } from "../utils/helpers.js";

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
  const tabAuditNav = qs("#tab-audit-nav");
  if (tabAuditNav) tabAuditNav.style.display = "block";
} else {
  if (eyebrow) eyebrow.textContent = profile.subject ? `${profile.subject} · Teacher tools` : "Teacher tools";
  if (title) title.textContent = "Library Management";
}

/* ==========================================================================
   Tabs
   ========================================================================== */
let currentTab = "catalogue";

const addAnnouncementBtn = qs("#add-announcement-btn");
const deleteAllBtn = qs("#delete-all-books-btn");

if (deleteAllBtn) {
  deleteAllBtn.addEventListener("click", async () => {
    if (!books.length) {
      showToast("Catalogue is already empty.");
      return;
    }
    if (!confirm(`Are you sure you want to delete ALL ${books.length} books from Firebase? This CANNOT be undone!`)) {
      return;
    }
    deleteAllBtn.disabled = true;
    deleteAllBtn.textContent = "Deleting...";
    try {
      for (const b of books) {
        await deleteBook(b.id || b.BK_ID);
      }
      logAuditAction({
        action: "ALL_BOOKS_DELETE",
        category: "Books",
        details: `${profile.name} (${profile.role}) purged all ${books.length} books from the catalogue.`,
        performedBy: profile
      });
      showToast("All books deleted successfully.");
      await loadBooks();
    } catch (err) {
      console.error(err);
      showToast("Error deleting books: " + err.message);
    } finally {
      deleteAllBtn.disabled = false;
      deleteAllBtn.textContent = "🗑️ Delete All Books";
    }
  });
}

qsa(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    qsa(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;

    const tabEl = (id) => qs(id);
    const setDisplay = (id, show) => { const el = tabEl(id); if (el) el.style.display = show ? "block" : "none"; };

    setDisplay("#tab-catalogue", currentTab === "catalogue");
    setDisplay("#tab-reviews", currentTab === "reviews");
    setDisplay("#tab-students", currentTab === "students");
    setDisplay("#tab-announcements", currentTab === "announcements");
    setDisplay("#tab-issues", currentTab === "issues");
    setDisplay("#tab-analytics", currentTab === "analytics");
    setDisplay("#tab-audit", currentTab === "audit");
    setDisplay("#tab-users", currentTab === "users");

    if (addBtn) {
      addBtn.style.display = currentTab === "catalogue" ? "inline-flex" : "none";
    }
    if (addAnnouncementBtn) {
      addAnnouncementBtn.style.display = (currentTab === "catalogue" || currentTab === "announcements") ? "inline-flex" : "none";
    }


    if (deleteAllBtn) {
      deleteAllBtn.style.display = currentTab === "catalogue" ? "inline-flex" : "none";
    }

    if (currentTab === "reviews") loadModerationList();
    if (currentTab === "students") loadStudents();
    if (currentTab === "announcements") loadAnnouncementsList();
    if (currentTab === "issues") loadManageIssues();
    if (currentTab === "analytics") loadManageAnalytics();
    if (currentTab === "audit") loadAuditLogs();
    if (currentTab === "users" && profile.role === "admin") loadUsers();
  });
});

/* ==========================================================================
   Catalogue Management
   ========================================================================== */
let books = [];
let allBookIssues = [];

async function loadBooks() {
  const [bList, iList] = await Promise.all([getAllBooks(), getBookIssues()]);
  books = bList;
  allBookIssues = iList;
  renderBooksTable();
}

function getBookIssueStatus(book) {
  const issues = allBookIssues.filter((i) => i.bookId === book.BK_ID || i.bookId === book.id);
  if (issues.some((i) => i.status === "approved")) {
    return `<span class="badge badge-approved">Issued</span>`;
  }
  if (issues.some((i) => i.status === "pending")) {
    return `<span class="badge badge-pending">Requested</span>`;
  }
  return `<span class="badge badge-not-started">Not Issued</span>`;
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
      <td>${getBookIssueStatus(b)}</td>
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
  // Hide any existing PDF link
  const pdfCurrentEl = qs("#f-pdf-current");
  if (pdfCurrentEl) pdfCurrentEl.style.display = "none";
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

  // Show existing PDF link if the book already has one
  const pdfCurrentEl = qs("#f-pdf-current");
  const pdfLinkEl = qs("#f-pdf-link");
  if (pdfCurrentEl && pdfLinkEl) {
    if (b.pdfUrl) {
      pdfLinkEl.href = b.pdfUrl;
      pdfCurrentEl.style.display = "block";
    } else {
      pdfCurrentEl.style.display = "none";
    }
  }

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

  const submitBtn = qs("#book-form button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {

  const characters = qs("#f-characters").value.split("\n").filter(Boolean).map((line) => {
    const parts = line.split("|").map((s) => (s || "").trim());
    return { 
      name: parts[0] || "", 
      role: parts[1] || "", 
      note: parts[2] || "" 
    };
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
    totalPages: parseInt(qs("#f-pages")?.value, 10) || 0,
    coverImage: ""
  };

  const coverFile = qs("#f-cover").files[0];
  if (coverFile) bookData.coverImage = await uploadImage(coverFile, "covers", bookData.BK_ID);

  const pdfFile = qs("#f-pdf")?.files[0];
  if (pdfFile) bookData.pdfUrl = await withTimeout(uploadFile(pdfFile, "pdfs", bookData.BK_ID), 30000, new Error("PDF upload timed out."));

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
  } catch (err) {
    console.error("Error saving book:", err);
    showToast("Error saving book: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save book";
    }
  }
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

function roleBadge(roleStr) {
  const role = (roleStr || "student").toLowerCase();
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

function formatTimestamp(timestamp) {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function showFullLogModal(log) {
  const modal = qs("#view-full-log-modal");
  const content = qs("#full-log-details-content");
  if (!modal || !content) return;

  let detailsHTML = `
    <div><strong>Time:</strong> <span class="mono">${formatTimestamp(log.timestamp)}</span></div>
    <div><strong>Category:</strong> ${categoryBadge(log.category)}</div>
    <div><strong>Action:</strong> <span class="mono">${escapeHTML(log.action || "—")}</span></div>
    <div style="border-top: 1px solid var(--glass-border); padding-top: var(--sp-2); margin-top: var(--sp-2);">
      <strong>Done By:</strong>
      <div style="margin-left: 12px; margin-top: 4px;">
        <div>Name: ${escapeHTML(log.performedBy?.name || "System")}</div>
        <div>Email: ${escapeHTML(log.performedBy?.email || "—")}</div>
        <div>Role: <span style="text-transform: capitalize;">${escapeHTML(log.performedBy?.role || "system")}</span></div>
        <div>UID: <span class="mono" style="font-size: 11px;">${escapeHTML(log.performedBy?.uid || "—")}</span></div>
      </div>
    </div>
    <div style="border-top: 1px solid var(--glass-border); padding-top: var(--sp-2); margin-top: var(--sp-2);"><strong>Details:</strong> ${escapeHTML(log.details)}</div>
  `;

  if (log.beforeEdit || log.afterEdit) {
    detailsHTML += `
      <div style="margin-top: 10px; border-top: 1px solid var(--glass-border); padding-top: var(--sp-2);">
        <strong>Before Edit:</strong>
        <pre style="background:var(--bg-sunken); padding:var(--sp-3); border-radius:var(--radius-sm); white-space:pre-wrap; font-family:var(--font-mono); font-size:11px; margin-top:4px; max-height:150px; overflow-y:auto; border:1px solid var(--glass-border);">${escapeHTML(log.beforeEdit || "—")}</pre>
      </div>
      <div style="margin-top: 10px;">
        <strong>After Edit:</strong>
        <pre style="background:var(--bg-sunken); padding:var(--sp-3); border-radius:var(--radius-sm); white-space:pre-wrap; font-family:var(--font-mono); font-size:11px; margin-top:4px; max-height:150px; overflow-y:auto; border:1px solid var(--glass-border);">${escapeHTML(log.afterEdit || "—")}</pre>
      </div>
    `;
  }

  if (log.deletedContent) {
    detailsHTML += `
      <div style="margin-top: 10px; border-top: 1px solid var(--glass-border); padding-top: var(--sp-2);">
        <strong>Deleted Content:</strong>
        <pre style="background:var(--bg-sunken); padding:var(--sp-3); border-radius:var(--radius-sm); white-space:pre-wrap; font-family:var(--font-mono); font-size:11px; margin-top:4px; max-height:150px; overflow-y:auto; border:1px solid var(--glass-border);">${escapeHTML(log.deletedContent || "—")}</pre>
      </div>
    `;
  }

  if (log.reason) {
    detailsHTML += `
      <div style="margin-top: 10px; border-top: 1px solid var(--glass-border); padding-top: var(--sp-2);">
        <strong>Reason for Action:</strong>
        <div style="background:rgba(251,191,36,0.05); padding:var(--sp-3); border:1px solid rgba(251,191,36,0.15); border-radius:var(--radius-sm); margin-top:4px; font-style:italic;">
          "${escapeHTML(log.reason)}"
        </div>
      </div>
    `;
  }

  content.innerHTML = detailsHTML;
  modal.classList.add("open");
}

// Close full log modal event listener
setTimeout(() => {
  const closeFullLogModalBtn = qs("#close-full-log-modal");
  if (closeFullLogModalBtn) {
    closeFullLogModalBtn.addEventListener("click", () => {
      qs("#view-full-log-modal").classList.remove("open");
    });
  }
}, 100);

function renderAuditLogsTable(list) {
  const tbody = qs("#audit-table-body");
  if (!tbody) return;
  tbody.innerHTML = list.length ? list.map((l) => `
    <tr>
      <td class="text-tertiary mono" style="font-size:var(--fs-tiny); white-space:nowrap;">${formatTimestamp(l.timestamp)}</td>
      <td>${categoryBadge(l.category)}</td>
      <td>${escapeHTML(l.details)}</td>
      <td>
        <strong style="font-size:var(--fs-small);">${escapeHTML(l.performedBy?.name || 'System')}</strong>
        <div class="text-tertiary" style="font-size:var(--fs-tiny);">${escapeHTML(l.performedBy?.email || '')} · ${escapeHTML(l.performedBy?.role || 'user')}</div>
      </td>
      <td>
        <button class="btn btn-ghost btn-sm view-full-log-btn" data-id="${l.id}">View Full Log</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-4);">No audit log entries recorded yet.</td></tr>`;

  qsa(".view-full-log-btn", tbody).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const log = list.find((l) => l.id === id);
      if (log) {
        showFullLogModal(log);
      }
    });
  });
}

async function loadAuditLogs() {
  const mount = qs("#audit-table-body");
  if (mount) mount.innerHTML = `<tr><td colspan="5"><div class="skeleton" style="height:60px;"></div></td></tr>`;
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

/* ==========================================================================
   Announcements
   ========================================================================== */
let editingAnnouncementId = null;
let originalAnnouncement = null;

function openAnnouncementModal(ann = null) {
  if (!qs("#announcement-modal")) {
    const m = document.createElement("div");
    m.id = "announcement-modal";
    m.className = "modal-overlay";
    m.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title" id="ann-modal-title">New Announcement</h2>
          <button class="btn btn-ghost btn-sm" id="ann-modal-close-x" style="padding:2px 8px; font-size:1.2rem; line-height:1;">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:var(--sp-4);">
          <div class="field">
            <label class="form-label" for="ann-title">Title</label>
            <input type="text" id="ann-title" placeholder="e.g. Library closed on Monday">
          </div>
          <div class="field">
            <label class="form-label" for="ann-body">Message</label>
            <textarea id="ann-body" rows="4" placeholder="Write the full announcement here…" style="resize:vertical;"></textarea>
          </div>
        </div>
        <div class="flex gap-3" style="margin-top:var(--sp-5);">
          <button class="btn btn-ghost btn-block" id="ann-modal-cancel">Cancel</button>
          <button class="btn btn-primary btn-block" id="ann-modal-save">📣 Post Announcement</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    const closeModal = () => m.classList.remove("open");
    qs("#ann-modal-close-x").addEventListener("click", closeModal);
    qs("#ann-modal-cancel").addEventListener("click", closeModal);
    m.addEventListener("click", (e) => { if (e.target === m) closeModal(); });

    qs("#ann-modal-save").addEventListener("click", handleSaveAnnouncement);
  }

  const titleEl = qs("#ann-title");
  const bodyEl = qs("#ann-body");
  const modalTitle = qs("#ann-modal-title");
  const saveBtn = qs("#ann-modal-save");

  if (ann) {
    editingAnnouncementId = ann.id;
    originalAnnouncement = ann;
    titleEl.value = ann.title || "";
    bodyEl.value = ann.body || "";
    modalTitle.textContent = "Edit Announcement";
    saveBtn.textContent = "📣 Save Changes";
  } else {
    editingAnnouncementId = null;
    originalAnnouncement = null;
    titleEl.value = "";
    bodyEl.value = "";
    modalTitle.textContent = "New Announcement";
    saveBtn.textContent = "📣 Post Announcement";
  }

  qs("#announcement-modal").classList.add("open");
}

async function handleSaveAnnouncement() {
  const titleVal = qs("#ann-title").value.trim();
  const bodyVal  = qs("#ann-body").value.trim();
  if (!titleVal) { showToast("Please enter a title."); return; }
  if (!bodyVal)  { showToast("Please enter a message."); return; }

  const saveBtn = qs("#ann-modal-save");
  saveBtn.disabled = true;
  saveBtn.textContent = editingAnnouncementId ? "Saving..." : "Posting...";

  try {
    if (editingAnnouncementId) {
      await updateAnnouncement(editingAnnouncementId, {
        title: titleVal,
        body: bodyVal
      });
      await logAuditAction({
        action: "ANNOUNCEMENT_EDIT",
        category: "Announcements",
        details: `"${titleVal}" edited by ${profile.name}`,
        performedBy: profile,
        targetId: editingAnnouncementId,
        beforeEdit: `Title: ${originalAnnouncement?.title}\nBody: ${originalAnnouncement?.body}`,
        afterEdit: `Title: ${titleVal}\nBody: ${bodyVal}`
      });
      showToast("Announcement updated successfully!");
    } else {
      await addAnnouncement({
        title: titleVal,
        body: bodyVal,
        authorName: profile.name || "Admin",
        authorRole: profile.role || "admin"
      });
      await logAuditAction({
        action: "ANNOUNCEMENT_ADD",
        category: "Announcements",
        details: `"${titleVal}" posted by ${profile.name}`,
        performedBy: profile
      });
      showToast("Announcement posted successfully!");
    }
    
    qs("#ann-title").value = "";
    qs("#ann-body").value = "";
    qs("#announcement-modal").classList.remove("open");
    
    if (currentTab === "announcements") {
      loadAnnouncementsList();
    }
  } catch (err) {
    console.error(err);
    showToast("Error saving announcement: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingAnnouncementId ? "📣 Save Changes" : "📣 Post Announcement";
  }
}

async function loadAnnouncementsList() {
  const mount = qs("#announcements-table-body");
  if (!mount) return;
  mount.innerHTML = `<tr><td colspan="5" class="text-tertiary" style="text-align:center;">Loading announcements...</td></tr>`;

  try {
    const list = await getAnnouncements();
    if (!list.length) {
      mount.innerHTML = `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-4);">No announcements found.</td></tr>`;
      return;
    }

    mount.innerHTML = list.map((a) => {
      const date = new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const escapedTitle = escapeHTML(a.title || "");
      const escapedBody = escapeHTML(a.body || "");
      const escapedAuthor = escapeHTML(`${a.authorName} (${a.authorRole})`);
      return `
        <tr data-id="${a.id}">
          <td><strong>${escapedTitle}</strong></td>
          <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapedBody}</td>
          <td>${escapedAuthor}</td>
          <td><span class="text-tertiary" style="font-size:var(--fs-tiny);">${date}</span></td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm edit-ann-btn">Edit</button>
              <button class="btn btn-danger btn-sm delete-ann-btn">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    qsa(".edit-ann-btn", mount).forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        openAnnouncementModal(list[idx]);
      });
    });

    qsa(".delete-ann-btn", mount).forEach((btn, idx) => {
      btn.addEventListener("click", async () => {
        const ann = list[idx];
        const reason = prompt(`Reason for deleting announcement "${ann.title}":`);
        if (reason === null) return; // cancelled
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
          showToast("Reason is required to delete announcements.", "error");
          return;
        }
        try {
          await deleteAnnouncement(ann.id);
          await logAuditAction({
            action: "ANNOUNCEMENT_DELETE",
            category: "Announcements",
            details: `"${ann.title}" deleted by ${profile.name}`,
            performedBy: profile,
            targetId: ann.id,
            deletedContent: `Title: ${ann.title}\nBody: ${ann.body}`,
            reason: trimmedReason
          });
          showToast("Announcement deleted.");
          loadAnnouncementsList();
        } catch (err) {
          console.error(err);
          showToast("Error deleting announcement: " + err.message);
        }
      });
    });

  } catch (err) {
    console.error(err);
    mount.innerHTML = `<tr><td colspan="5" class="text-danger" style="text-align:center;">Failed to load announcements: ${err.message}</td></tr>`;
  }
}

if (addAnnouncementBtn) {
  addAnnouncementBtn.addEventListener("click", () => openAnnouncementModal());
}

/* ==========================================================================
   Book Issues Management
   ========================================================================== */
async function loadManageIssues() {
  const mount = qs("#manage-issues-body");
  if (!mount) return;
  mount.innerHTML = `<tr><td colspan="7" class="text-tertiary" style="text-align:center;">Loading requests...</td></tr>`;

  try {
    const issues = await getBookIssues();
    mount.innerHTML = issues.length
      ? issues.map((i) => `
          <tr>
            <td><strong>${escapeHTML(i.userName)}</strong></td>
            <td><a href="book-details.html?id=${i.bookId}">${escapeHTML(i.bookName)}</a></td>
            <td>${escapeHTML(i.userClass || "—")}-${escapeHTML(i.userSection || "")}</td>
            <td class="mono" style="font-size:var(--fs-tiny);">${i.issueDate || "—"}</td>
            <td class="mono" style="font-size:var(--fs-tiny);">${i.returnDate || "—"}</td>
            <td><span class="badge badge-${i.status}">${i.status.charAt(0).toUpperCase() + i.status.slice(1)}</span></td>
            <td>
              ${i.status === "pending" ? `
                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm app-issue" data-id="${i.id}">Approve</button>
                  <button class="btn btn-danger btn-sm rej-issue" data-id="${i.id}">Reject</button>
                </div>` : `<span class="text-tertiary" style="font-size:var(--fs-tiny);">${timeAgo(i.updatedAt || i.requestedAt)}</span>`}
            </td>
          </tr>`).join("")
      : `<tr><td colspan="7" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No issue requests found.</td></tr>`;

    qsa(".app-issue").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await updateBookIssueStatus(btn.dataset.id, "approved");
        showToast("Request approved.");
        loadManageIssues();
      });
    });
    qsa(".rej-issue").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await updateBookIssueStatus(btn.dataset.id, "rejected");
        showToast("Request rejected.");
        loadManageIssues();
      });
    });
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<tr><td colspan="7" class="text-danger" style="text-align:center;">Failed to load issues: ${err.message}</td></tr>`;
  }
}

/* ==========================================================================
   Analytics (Visual bars & distribution)
   ========================================================================== */
async function loadManageAnalytics() {
  const genreMount = qs("#genre-chart-container");
  const statusMount = qs("#status-chart-container");
  const topBooksMount = qs("#top-books-chart-container");

  if (!genreMount) return;
  genreMount.innerHTML = `<div class="skeleton" style="height:120px;"></div>`;
  statusMount.innerHTML = `<div class="skeleton" style="height:120px;"></div>`;
  topBooksMount.innerHTML = `<div class="skeleton" style="height:120px;"></div>`;

  try {
    const allBooksList = await getAllBooks();
    const allReviewsList = (await Promise.all(allBooksList.map((b) => getReviewsForBook(b.BK_ID)))).flat();

    // 1. Genre breakdown
    const genreCounts = {};
    for (const b of allBooksList) {
      const g = b.genre || "Uncategorized";
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
    const maxGenre = Math.max(...Object.values(genreCounts), 1);
    genreMount.innerHTML = Object.entries(genreCounts).map(([genre, count]) => {
      const pct = Math.round((count / maxGenre) * 100);
      return `
        <div style="margin-bottom:var(--sp-3);">
          <div class="flex justify-between" style="font-size:var(--fs-small); margin-bottom:4px;">
            <span>${escapeHTML(genre)}</span>
            <strong>${count} book${count !== 1 ? "s" : ""}</strong>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }).join("") || `<p class="text-tertiary">No books in catalogue.</p>`;

    // 2. Rating breakdown
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of allReviewsList) {
      if (r.rating && ratingCounts[r.rating] !== undefined) ratingCounts[r.rating]++;
    }
    const totalRev = allReviewsList.length || 1;
    statusMount.innerHTML = [5, 4, 3, 2, 1].map((stars) => {
      const count = ratingCounts[stars];
      const pct = Math.round((count / totalRev) * 100);
      return `
        <div style="margin-bottom:var(--sp-2);">
          <div class="flex justify-between" style="font-size:var(--fs-small); margin-bottom:4px;">
            <span>${stars} Stars ⭐</span>
            <span>${count} (${pct}%)</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }).join("");

    // 3. Top books by review count
    const bookReviewCounts = allBooksList.map((b) => {
      const revs = allReviewsList.filter((r) => r.bookId === b.BK_ID);
      const avg = revs.length ? revs.reduce((s, r) => s + (r.rating || 0), 0) / revs.length : 0;
      return { ...b, reviewCount: revs.length, avgRating: avg };
    }).sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5);

    const maxBookRev = Math.max(...bookReviewCounts.map((b) => b.reviewCount), 1);
    topBooksMount.innerHTML = bookReviewCounts.map((b) => {
      const pct = Math.round((b.reviewCount / maxBookRev) * 100);
      return `
        <div style="margin-bottom:var(--sp-3);">
          <div class="flex justify-between" style="font-size:var(--fs-small); margin-bottom:4px;">
            <span><a href="book-details.html?id=${b.BK_ID}"><strong>${escapeHTML(b.bookName)}</strong></a> (${b.genre})</span>
            <span>${b.reviewCount} review${b.reviewCount !== 1 ? "s" : ""} · ${b.avgRating.toFixed(1)} ★</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }).join("") || `<p class="text-tertiary">No reviews yet.</p>`;

  } catch (err) {
    console.error("Analytics error:", err);
    genreMount.innerHTML = `<p class="text-danger">Failed to load analytics: ${err.message}</p>`;
  }
}
