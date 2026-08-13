import { requireAuth } from "../firebase/auth.js";
import {
  getAllBooks, getAllUsers, getReviewsForBook, getAnnouncements, addAnnouncement, deleteAnnouncement,
  getChallenges, addChallenge, deleteChallenge,
  getBookIssues, updateBookIssueStatus, logAuditAction
} from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, timeAgo, initials, showToast, qs, qsa } from "../utils/helpers.js";

// Role gate: only teachers and admins
const profile = await requireAuth(["teacher", "admin"]);
renderNavbar(profile, "teacher-dashboard.html");

qs("#td-greeting").textContent = `Welcome back, ${profile.name.split(" ")[0]} 👋`;

// ---- Tab wiring ----
const tabs = qsa(".tab", qs("#td-tabs"));
function showTab(name) {
  qsa("section[id^='tab-']").forEach((s) => (s.style.display = "none"));
  const target = qs(`#tab-${name}`);
  if (target) { target.style.display = ""; }
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
}
tabs.forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
showTab("overview");

// ---- Load all data ----
const [allBooks, allUsers, allIssues, allChallenges, allAnnouncements] = await Promise.all([
  getAllBooks(), getAllUsers(), getBookIssues(), getChallenges(), getAnnouncements()
]);
const allReviewArrays = await Promise.all(allBooks.map((b) => getReviewsForBook(b.BK_ID)));
const allReviews = allReviewArrays.flat();

const studentUsers = allUsers.filter((u) => (u.role || "student") === "student");

const reviewCountByUser = {};
for (const r of allReviews) {
  reviewCountByUser[r.userId] = (reviewCountByUser[r.userId] || 0) + 1;
}

// ========== OVERVIEW TAB ==========
const totalBooks = allBooks.length;
const totalStudents = studentUsers.length;
const totalReviews = allReviews.length;
const pendingIssues = allIssues.filter((i) => i.status === "pending").length;

const statsGrid = qs("#td-stats-grid");
statsGrid.innerHTML = [
  { icon: "📚", value: totalBooks, label: "Books in Catalogue" },
  { icon: "🎓", value: totalStudents, label: "Students" },
  { icon: "⭐", value: totalReviews, label: "Total Reviews" },
  { icon: "📋", value: pendingIssues, label: "Pending Issue Requests", highlight: pendingIssues > 0 }
].map((s) => `
  <div class="stat-card" ${s.highlight ? 'style="border-color:rgba(251,191,36,0.4);"' : ""}>
    <span class="stat-icon">${s.icon}</span>
    <span class="stat-value">${s.value}</span>
    <span class="stat-label">${s.label}</span>
  </div>`).join("");

const now = Date.now();
const activeChallenges = allChallenges.filter((c) => c.active && (!c.endDate || new Date(c.endDate).getTime() > now));
qs("#td-overview-challenges").innerHTML = activeChallenges.length
  ? activeChallenges.map((c) => `
      <div class="challenge-card" style="margin-bottom:var(--sp-3);">
        <div class="challenge-title">${escapeHTML(c.title)}</div>
        <div class="challenge-meta">Goal: ${c.goal} ${c.goalType} · ${c.endDate ? "Due " + c.endDate : "Ongoing"}</div>
      </div>`).join("")
  : `<p class="text-tertiary" style="font-size:var(--fs-small);">No active challenges. Create one in the Challenges tab.</p>`;

const pendingList = allIssues.filter((i) => i.status === "pending").slice(0, 4);
qs("#td-overview-issues").innerHTML = pendingList.length
  ? pendingList.map((i) => `
      <div style="padding:var(--sp-3) 0; border-bottom:1px solid var(--glass-border); font-size:var(--fs-small);">
        <strong>${escapeHTML(i.userName)}</strong> → <em>${escapeHTML(i.bookName)}</em>
        <span class="badge badge-pending" style="margin-left:6px;">Pending</span>
        <div class="text-tertiary" style="font-size:var(--fs-tiny); margin-top:2px;">Return by: ${i.returnDate || "—"}</div>
      </div>`).join("")
  : `<p class="text-tertiary" style="font-size:var(--fs-small);">No pending requests.</p>`;

// ========== CHALLENGES TAB ==========
function renderChallengesList(challenges) {
  const mount = qs("#challenges-list");
  mount.innerHTML = challenges.length
    ? challenges.map((c) => `
        <div class="challenge-card" style="margin-bottom:var(--sp-3);">
          <div class="flex justify-between items-center" style="margin-bottom:var(--sp-2);">
            <div class="challenge-title">${escapeHTML(c.title)} ${!c.active ? '<span class="badge badge-rejected" style="margin-left:4px; font-size:0.65rem;">Inactive</span>' : ""}</div>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm toggle-challenge-btn" data-id="${c.id}" data-active="${c.active}">${c.active ? "Deactivate" : "Activate"}</button>
              <button class="btn btn-danger btn-sm delete-challenge-btn" data-id="${c.id}">Delete</button>
            </div>
          </div>
          <div class="challenge-meta">Goal: ${c.goal} ${c.goalType} · ${c.startDate ? c.startDate + " → " : ""}${c.endDate || "No end date"}</div>
          ${c.description ? `<p style="font-size:var(--fs-tiny); color:var(--text-secondary); margin-top:var(--sp-2);">${escapeHTML(c.description)}</p>` : ""}
        </div>`).join("")
    : `<div class="empty-state"><h3>No challenges yet</h3><p>Create one to motivate your students.</p></div>`;

  qsa(".delete-challenge-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this challenge?")) return;
      await deleteChallenge(btn.dataset.id);
      showToast("Challenge deleted.");
      renderChallengesList(await getChallenges());
    });
  });

  qsa(".toggle-challenge-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { updateChallenge } = await import("../firebase/firestore.js");
      const newActive = btn.dataset.active !== "true";
      await updateChallenge(btn.dataset.id, { active: newActive });
      showToast(`Challenge ${newActive ? "activated" : "deactivated"}.`);
      renderChallengesList(await getChallenges());
    });
  });
}
renderChallengesList(allChallenges);

const challengeModal = qs("#challenge-modal");
qs("#add-challenge-btn")?.addEventListener("click", () => {
  qs("#challenge-form").reset();
  challengeModal?.classList.add("open");
});
qs("#cancel-challenge")?.addEventListener("click", () => challengeModal?.classList.remove("open"));
challengeModal?.addEventListener("click", (e) => { if (e.target === challengeModal) challengeModal.classList.remove("open"); });

qs("#challenge-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
  try {
    await addChallenge({
      title: qs("#ch-title").value.trim(),
      description: qs("#ch-desc").value.trim(),
      goal: parseInt(qs("#ch-goal").value, 10),
      goalType: qs("#ch-type").value,
      startDate: qs("#ch-start").value,
      endDate: qs("#ch-end").value,
      createdBy: profile.name
    });
    logAuditAction({ action: "CHALLENGE_CREATE", category: "Challenges", details: `${profile.name} created challenge "${qs("#ch-title").value.trim()}"`, performedBy: profile });
    showToast("Challenge created!");
    challengeModal?.classList.remove("open");
    renderChallengesList(await getChallenges());
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Challenge"; }
  }
});

// ========== BOOK ISSUES TAB ==========
function renderIssuesTable(issues) {
  const tbody = qs("#issues-table-body");
  tbody.innerHTML = issues.length
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
                <button class="btn btn-ghost btn-sm approve-issue-btn" data-id="${i.id}">Approve</button>
                <button class="btn btn-danger btn-sm reject-issue-btn" data-id="${i.id}">Reject</button>
              </div>` : `<span class="text-tertiary" style="font-size:var(--fs-tiny);">Updated ${timeAgo(i.updatedAt || i.requestedAt)}</span>`}
          </td>
        </tr>`).join("")
    : `<tr><td colspan="7" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No book issue requests yet.</td></tr>`;

  qsa(".approve-issue-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateBookIssueStatus(btn.dataset.id, "approved");
      showToast("Issue request approved.");
      renderIssuesTable(await getBookIssues());
    });
  });
  qsa(".reject-issue-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateBookIssueStatus(btn.dataset.id, "rejected");
      showToast("Issue request rejected.");
      renderIssuesTable(await getBookIssues());
    });
  });
}
renderIssuesTable(allIssues);

// ========== STUDENT ACTIVITY TAB ==========
function renderStudentsTable(students) {
  const tbody = qs("#td-students-body");
  tbody.innerHTML = students.length
    ? students.map((u) => {
        const uid = u.uid || u.id;
        const reviewCount = reviewCountByUser[uid] || 0;
        const achCount = Array.isArray(u.achievements) ? u.achievements.length : 0;
        const avatarHTML = u.profilePicture
          ? `<img src="${escapeHTML(u.profilePicture)}" class="avatar avatar-sm" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`
          : `<div class="avatar avatar-sm" style="width:24px;height:24px;font-size:0.65rem;">${initials(u.name || "U")}</div>`;
        return `
          <tr>
            <td><div class="flex items-center gap-2">${avatarHTML}<strong>${escapeHTML(u.name || "—")}</strong></div></td>
            <td>${u.className ? `Class ${escapeHTML(u.className)}${u.section ? "-" + u.section : ""}` : "—"}</td>
            <td>${reviewCount}</td>
            <td>${u.achievements?.includes("book_explorer") ? "10+" : "—"}</td>
            <td>${achCount} / 10 🏅</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No students found.</td></tr>`;
}
renderStudentsTable(studentUsers);

qs("#td-student-search")?.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = studentUsers.filter((u) =>
    (u.name || "").toLowerCase().includes(term) ||
    String(u.className || "").toLowerCase().includes(term) ||
    (u.section || "").toLowerCase().includes(term)
  );
  renderStudentsTable(filtered);
});

// ========== ANNOUNCEMENTS TAB ==========
function renderAnnouncementsList(announcements) {
  const mount = qs("#td-announcements-list");
  mount.innerHTML = announcements.length
    ? announcements.map((a) => `
        <div class="card" style="margin-bottom:var(--sp-3);">
          <div class="flex justify-between items-start">
            <div>
              <strong>${escapeHTML(a.title)}</strong>
              <span class="text-tertiary" style="font-size:var(--fs-tiny); margin-left:8px;">${timeAgo(a.createdAt)}</span>
            </div>
            ${profile.role === "admin" ? `<button class="btn btn-danger btn-sm delete-ann-btn" data-id="${a.id}" style="flex-shrink:0;">Delete</button>` : ""}
          </div>
          <p style="margin-top:var(--sp-2); font-size:var(--fs-small); color:var(--text-secondary);">${escapeHTML(a.body)}</p>
        </div>`).join("")
    : `<p class="text-tertiary">No announcements yet.</p>`;

  qsa(".delete-ann-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteAnnouncement(btn.dataset.id);
      showToast("Announcement deleted.");
      renderAnnouncementsList(await getAnnouncements());
    });
  });
}
renderAnnouncementsList(allAnnouncements);

qs("#td-announce-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  if (btn) { btn.disabled = true; btn.textContent = "Posting..."; }
  try {
    await addAnnouncement({
      title: qs("#td-ann-title").value.trim(),
      body: qs("#td-ann-body").value.trim(),
      authorName: profile.name,
      authorRole: profile.role
    });
    showToast("Announcement posted!");
    qs("#td-announce-form").reset();
    renderAnnouncementsList(await getAnnouncements());
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Post Announcement"; }
  }
});
