import { requireAuth, changeUserPassword, deleteUserProfile } from "../firebase/auth.js";
import { getAllBooks, getReviewsForBook, updateUserProfile, logAuditAction, getReadingLists, getChallenges, getAllReadingProgress, getBookIssuesForUser } from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { spineColorFor, initials, showToast, qs, starString, timeAgo, initGenreChipPicker } from "../utils/helpers.js";
import { ALL_ACHIEVEMENTS, checkAndAwardAchievements } from "../utils/achievements.js";

const profile = await requireAuth();
// Role gate: teachers and admins go to their own dashboard
if (profile.role === "teacher" || profile.role === "admin") {
  window.location.href = "teacher-dashboard.html";
}
renderNavbar(profile, "student-dashboard.html");

// ---- Profile card ----
qs("#profile-avatar").textContent = initials(profile.name);
if (profile.profilePicture) {
  qs("#profile-avatar").innerHTML = `<img src="${profile.profilePicture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
}
qs("#profile-name").textContent = profile.name;

const roleBadge = qs("#profile-role");
if (roleBadge) {
  roleBadge.textContent = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
  roleBadge.className = `badge badge-role-${profile.role}`;
}

if (profile.role === "teacher") {
  qs("#profile-class").textContent = profile.subject ? `Subject: ${profile.subject}` : "Faculty Member";
} else if (profile.role === "admin") {
  qs("#profile-class").textContent = "Administrator";
} else {
  qs("#profile-class").textContent = `Class ${profile.className || "—"}-${profile.section || "—"} · Roll No. ${profile.rollNumber || "—"}`;
}

qs("#profile-bio").textContent = profile.bio || "No bio yet — tell others what you like to read.";
const favGenres = Array.isArray(profile.favouriteGenre) ? profile.favouriteGenre : (profile.favouriteGenre ? [profile.favouriteGenre] : []);
const displayGenre = favGenres.length > 0 ? favGenres.join(", ") : "Not set";
const firstGenre = favGenres.length > 0 ? favGenres[0] : null;
qs("#fav-genre-tag").innerHTML = `<span style="--spine-color:${spineColorFor(firstGenre)};display:inline-block;width:3px;height:14px;border-radius:2px;background:${spineColorFor(firstGenre)};margin-right:7px;"></span>${displayGenre}`;

if (profile.role === "teacher" || profile.role === "admin") {
  const quickAccessList = qs("#quick-access-list");
  if (quickAccessList) {
    const manageLink = document.createElement("a");
    manageLink.href = "manage.html";
    manageLink.className = "btn btn-primary btn-block";
    manageLink.textContent = "Manage library";
    quickAccessList.prepend(manageLink);
  }
}

// ---- Recently viewed (session-scoped; a book-details.html visit records into sessionStorage) ----
const viewedIds = JSON.parse(sessionStorage.getItem("sajs_recently_viewed") || "[]");
const allBooks = await getAllBooks();
const recentBooks = viewedIds.map((id) => allBooks.find((b) => b.BK_ID === id || b.id === id)).filter(Boolean);
qs("#stat-viewed").textContent = recentBooks.length;

const recentMount = qs("#recent-viewed");
recentMount.innerHTML = recentBooks.length
  ? recentBooks.map((b) => `
      <a href="book-details.html?id=${b.BK_ID}" class="book-card">
        <div class="book-cover" style="--spine-color:${spineColorFor(b.genre)}; display:flex;align-items:center;justify-content:center;padding:var(--sp-2);">
          <span class="mono" style="font-size:0.65rem;color:var(--text-tertiary);">${b.bookName}</span>
        </div>
        <span class="bk-id mono">${b.BK_ID}</span>
      </a>`).join("")
  : `<p class="text-tertiary">Books you open will show up here.</p>`;

// ---- Own reviews across all books ----
const allReviewLists = await Promise.all(allBooks.map((b) => getReviewsForBook(b.BK_ID)));
const myReviews = allReviewLists.flat().filter((r) => r.userId === profile.uid);
qs("#stat-reviews").textContent = myReviews.length;

const reviewsMount = qs("#my-reviews");
reviewsMount.innerHTML = myReviews.length
  ? myReviews.map((r) => {
      const book = allBooks.find((b) => b.BK_ID === r.bookId || b.id === r.bookId);
      return `
        <div class="review-item">
          <div class="review-head">
            <div>
              <a href="book-details.html?id=${r.bookId}"><strong>${book ? book.bookName : r.bookId}</strong></a>
              <div class="stars">${starString(r.rating)}</div>
            </div>
            <span class="text-tertiary" style="font-size:var(--fs-tiny);">${timeAgo(r.timestamp)}</span>
          </div>
          <p style="margin-top:var(--sp-2);">${r.reviewText}</p>
        </div>`;
    }).join("")
  : `<div class="empty-state"><h3>No reviews yet</h3><p>Open a book and share what you thought.</p></div>`;

// ---- Reading Lists / Shelves ----
const listData = await getReadingLists(profile.uid);
const shelves = listData.shelves || {};
const shelvesMount = qs("#my-shelves");
const shelfNames = Object.keys(shelves);
if (shelvesMount) {
  shelvesMount.innerHTML = shelfNames.length
    ? shelfNames.map((name) => {
        const bookIds = shelves[name] || [];
        const shelfBooks = bookIds.map((id) => allBooks.find((b) => b.BK_ID === id || b.id === id)).filter(Boolean);
        return `
          <div class="challenge-card" style="margin-bottom:var(--sp-3);">
            <div class="challenge-title">${name} <span class="badge badge-role-student" style="margin-left:4px;">${bookIds.length} book${bookIds.length !== 1 ? 's' : ''}</span></div>
            <div class="mini-book-row" style="margin-top:var(--sp-3);">
              ${shelfBooks.slice(0, 4).map((b) => `
                <a href="book-details.html?id=${b.BK_ID}" class="book-card" style="width:70px;">
                  <div class="book-cover" style="--spine-color:${spineColorFor(b.genre)}; display:flex; align-items:center; justify-content:center; padding:4px; min-height:90px;">
                    <span class="mono" style="font-size:0.55rem; color:var(--text-tertiary);">${b.bookName}</span>
                  </div>
                  <span class="bk-id mono">${b.BK_ID}</span>
                </a>`).join('')}
              ${bookIds.length > 4 ? `<span class="text-tertiary" style="font-size:var(--fs-tiny); align-self:center;">+${bookIds.length - 4} more</span>` : ''}
            </div>
          </div>`;
      }).join('')
    : `<p class="text-tertiary" style="font-size:var(--fs-small);">No shelves yet — add books to a list from any book page.</p>`;
}

// ---- Reading Challenges ----
const challenges = await getChallenges();
const now = Date.now();
const activeChallenges = challenges.filter((c) => c.active && (!c.endDate || new Date(c.endDate).getTime() > now));
const challengeMount = qs("#active-challenges");
if (challengeMount) {
  challengeMount.innerHTML = activeChallenges.length
    ? activeChallenges.map((c) => {
        const userProgress = c.goalType === "reviews" ? myReviews.length : recentBooks.length;
        const pct = Math.min(100, Math.round((userProgress / c.goal) * 100));
        const done = userProgress >= c.goal;
        return `
          <div class="challenge-card">
            <div class="challenge-title">${done ? '🎯 ' : ''}${c.title}</div>
            <div class="challenge-meta">
              Goal: ${c.goal} ${c.goalType === 'reviews' ? 'reviews' : 'books viewed'} · ${c.endDate ? 'Due ' + c.endDate : 'Ongoing'}
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
            <div class="flex justify-between" style="margin-top:4px; font-size:var(--fs-tiny); color:var(--text-tertiary);">
              <span>${userProgress} / ${c.goal}</span><span>${pct}%</span>
            </div>
            ${c.description ? `<p style="font-size:var(--fs-tiny); margin-top:var(--sp-2); color:var(--text-tertiary);">${c.description}</p>` : ''}
          </div>`;
      }).join('')
    : `<p class="text-tertiary" style="font-size:var(--fs-small);">No active challenges right now.</p>`;
}

// ---- Achievements ----
const shelfBookCount = shelfNames.reduce((s, n) => s + (shelves[n]?.length || 0), 0);
const viewedCount = recentBooks.length;
const shelfGenres = [...new Set(
  shelfNames.flatMap((n) => (shelves[n] || []).map((id) => allBooks.find((b) => b.BK_ID === id)?.genre).filter(Boolean))
)];

const completedChallenges = activeChallenges.filter((c) => {
  const progress = c.goalType === "reviews" ? myReviews.length : recentBooks.length;
  return progress >= c.goal;
}).length;

const [userProgressList, userIssuesList] = await Promise.all([
  getAllReadingProgress(profile.uid),
  getBookIssuesForUser(profile.uid)
]);

const totalPagesRead = userProgressList.reduce((sum, p) => sum + (Number(p.currentPage) || 0), 0);
const finishedBooks = userProgressList.filter((p) => p.status === "finished").length;
const hasFiveStarReview = myReviews.some((r) => r.rating === 5);
const issueCount = userIssuesList.length;

await checkAndAwardAchievements(profile, {
  reviewCount: myReviews.length,
  messageCount: 0,
  shelfBookCount,
  shelfGenreCount: shelfGenres.length,
  viewedCount,
  completedChallenges,
  totalPagesRead,
  finishedBooks,
  hasFiveStarReview,
  issueCount
});

// Re-read profile achievements array (which checkAndAwardAchievements updated locally)
const earnedIds = new Set(profile.achievements || []);

const countLabel = qs("#ach-count-label");
if (countLabel) countLabel.textContent = `${earnedIds.size} / ${ALL_ACHIEVEMENTS.length} Unlocked`;

const achMount = qs("#achievements-grid");
if (achMount) {
  achMount.innerHTML = ALL_ACHIEVEMENTS.map((a) => {
    const unlocked = earnedIds.has(a.id);
    return `
      <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}" title="${a.description}">
        <span class="ach-icon">${a.icon}</span>
        <span class="ach-title">${a.title}</span>
        <span class="ach-desc">${a.description}</span>
      </div>`;
  }).join("");
}

// ---- Edit profile modal ----
const modal = qs("#edit-modal");
let editGenrePicker = null;

qs("#edit-profile-btn").addEventListener("click", () => {
  qs("#edit-uid").value = profile.uid;
  qs("#edit-name").value = profile.name || "";
  qs("#edit-email").value = profile.email || "";
  qs("#edit-bio").value = profile.bio || "";

  // Pre-select class/section dropdowns
  const classEl = qs("#edit-class");
  const sectionEl = qs("#edit-section");
  if (classEl) classEl.value = profile.className || "";
  if (sectionEl) sectionEl.value = profile.section || "";
  if (qs("#edit-roll")) qs("#edit-roll").value = profile.rollNumber || "";
  if (qs("#edit-subject")) qs("#edit-subject").value = profile.subject || "";

  const studentFields = qs("#student-edit-fields");
  const teacherFields = qs("#teacher-edit-fields");
  if (studentFields) studentFields.style.display = profile.role === "teacher" ? "none" : "flex";
  if (teacherFields) teacherFields.style.display = profile.role === "teacher" ? "block" : "none";

  // Re-init genre chip picker with the user's saved genres pre-selected
  const savedGenres = Array.isArray(profile.favouriteGenre)
    ? profile.favouriteGenre
    : (profile.favouriteGenre ? [profile.favouriteGenre] : []);
  editGenrePicker = initGenreChipPicker(qs("#edit-genre-picker"), savedGenres);

  modal.classList.add("open");
});

qs("#cancel-edit").addEventListener("click", () => modal.classList.remove("open"));

qs("#edit-profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const changes = {
    name: qs("#edit-name").value,
    email: qs("#edit-email").value,
    bio: qs("#edit-bio").value,
    favouriteGenre: editGenrePicker ? editGenrePicker.getSelected() : []
  };

  if (qs("#edit-class")) changes.className = qs("#edit-class").value;
  if (qs("#edit-section")) changes.section = qs("#edit-section").value;
  if (qs("#edit-roll")) changes.rollNumber = qs("#edit-roll").value;
  if (qs("#edit-subject")) changes.subject = qs("#edit-subject").value;

  const file = qs("#edit-avatar").files[0];
  if (file) changes.profilePicture = await uploadImage(file, "avatars", profile.uid);

  await updateUserProfile(profile.uid, changes);
  logAuditAction({
    action: "PROFILE_UPDATE",
    category: "Profile",
    details: `${profile.name} (${profile.role}) updated their profile details.`,
    performedBy: profile,
    targetId: profile.uid
  });
  showToast("Profile updated.");
  modal.classList.remove("open");
  setTimeout(() => window.location.reload(), 600);
});

// ==========================================
// Account Settings Logic
// ==========================================

const cpModal = qs("#change-password-modal");
const dpModal = qs("#delete-profile-modal");

qs("#open-change-password-btn")?.addEventListener("click", () => {
  if (cpModal) {
    qs("#change-password-form").reset();
    cpModal.style.display = "flex";
  }
});

qs("#cancel-change-password")?.addEventListener("click", () => {
  if (cpModal) cpModal.style.display = "none";
});

qs("#change-password-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const oldPass = qs("#cp-old").value;
  const newPass = qs("#cp-new").value;
  const confirm = qs("#cp-confirm").value;

  if (newPass !== confirm) {
    showToast("New passwords do not match.", "error");
    return;
  }

  try {
    await changeUserPassword(oldPass, newPass);
    showToast("Password updated successfully.");
    if (cpModal) cpModal.style.display = "none";
  } catch (err) {
    console.error(err);
    showToast(err.message || "Failed to update password. Check your current password.", "error");
  }
});

qs("#open-delete-profile-btn")?.addEventListener("click", () => {
  if (dpModal) {
    qs("#delete-profile-form").reset();
    dpModal.style.display = "flex";
  }
});

qs("#cancel-delete-profile")?.addEventListener("click", () => {
  if (dpModal) dpModal.style.display = "none";
});

qs("#delete-profile-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = qs("#dp-username").value;
  const password = qs("#dp-password").value;

  if (!confirm("Are you absolutely sure you want to delete your profile? This cannot be undone.")) {
    return;
  }

  try {
    await deleteUserProfile(username, password);
    showToast("Profile deleted.");
    window.location.href = "login.html";
  } catch (err) {
    console.error(err);
    showToast(err.message || "Failed to delete profile. Please check username and password.", "error");
  }
});
