import { requireAuth } from "../firebase/auth.js";
import { getAllBooks, getReviewsForBook, updateUserProfile } from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { spineColorFor, initials, showToast, qs, starString, timeAgo } from "../utils/helpers.js";

const profile = await requireAuth(); // any signed-in role may view; teachers/admins are redirected to their own dashboards below
if (profile.role !== "student") {
  window.location.href = profile.role === "teacher" ? "teacher-dashboard.html" : "admin-panel.html";
}
renderNavbar(profile, "student-dashboard.html");

// ---- Profile card ----
qs("#profile-avatar").textContent = initials(profile.name);
if (profile.profilePicture) {
  qs("#profile-avatar").innerHTML = `<img src="${profile.profilePicture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
}
qs("#profile-name").textContent = profile.name;
qs("#profile-class").textContent = `Class ${profile.className || "—"}-${profile.section || "—"} · Roll No. ${profile.rollNumber || "—"}`;
qs("#profile-bio").textContent = profile.bio || "No bio yet — tell others what you like to read.";
qs("#fav-genre-tag").innerHTML = `<span style="--spine-color:${spineColorFor(profile.favouriteGenre)};display:inline-block;width:3px;height:14px;border-radius:2px;background:${spineColorFor(profile.favouriteGenre)};margin-right:7px;"></span>${profile.favouriteGenre || "Not set"}`;

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

// ---- Edit profile modal ----
const modal = qs("#edit-modal");
qs("#edit-profile-btn").addEventListener("click", () => {
  qs("#edit-bio").value = profile.bio || "";
  qs("#edit-genre").value = profile.favouriteGenre || "Fiction";
  modal.classList.add("open");
});
qs("#cancel-edit").addEventListener("click", () => modal.classList.remove("open"));

qs("#edit-profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const changes = { bio: qs("#edit-bio").value, favouriteGenre: qs("#edit-genre").value };
  const file = qs("#edit-avatar").files[0];
  if (file) changes.profilePicture = await uploadImage(file, "avatars", profile.uid);
  await updateUserProfile(profile.uid, changes);
  showToast("Profile updated.");
  modal.classList.remove("open");
  setTimeout(() => window.location.reload(), 600);
});
