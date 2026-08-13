import { requireAuth } from "../firebase/auth.js";
import { getAllBooks, getReviewsForBook, getAllUsers } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, starString, initials, qs, qsa } from "../utils/helpers.js";

const profile = await requireAuth();
renderNavbar(profile, "leaderboard.html");

// ---- Tab wiring ----
const tabs = qsa(".tab", qs("#lb-tabs"));
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    qsa("section[id^='tab-']").forEach((s) => (s.style.display = "none"));
    const target = qs(`#tab-${tab.dataset.tab}`);
    if (target) target.style.display = "block";
  });
});

function rankClass(i) {
  if (i === 0) return "gold";
  if (i === 1) return "silver";
  if (i === 2) return "bronze";
  return "";
}

function medalEmoji(i) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "";
}

async function init() {
  const [allBooks, allUsers] = await Promise.all([getAllBooks(), getAllUsers()]);
  const allReviewArrays = await Promise.all(allBooks.map((b) => getReviewsForBook(b.BK_ID)));
  const allReviews = allReviewArrays.flat();

  // ---- Top Reviewers ----
  const userReviewMap = {};
  for (const r of allReviews) {
    if (!r.userId) continue;
    if (!userReviewMap[r.userId]) userReviewMap[r.userId] = { count: 0, totalRating: 0 };
    userReviewMap[r.userId].count++;
    userReviewMap[r.userId].totalRating += r.rating || 0;
  }

  const reviewers = allUsers
    .filter((u) => userReviewMap[u.uid || u.id])
    .map((u) => {
      const uid = u.uid || u.id;
      const data = userReviewMap[uid];
      return { ...u, reviewCount: data.count, avgGiven: data.count ? data.totalRating / data.count : 0 };
    })
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 20);

  const reviewersBody = qs("#reviewers-body");
  reviewersBody.innerHTML = reviewers.length
    ? reviewers.map((u, i) => {
        const avatarHTML = u.profilePicture
          ? `<img src="${escapeHTML(u.profilePicture)}" class="avatar avatar-sm" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
          : `<div class="avatar avatar-sm">${initials(u.name || "U")}</div>`;
        return `
          <tr>
            <td><span class="leaderboard-rank ${rankClass(i)}">${medalEmoji(i) || (i + 1)}</span></td>
            <td>
              <div class="flex items-center gap-3">
                ${avatarHTML}
                <div>
                  <strong>${escapeHTML(u.name || "User")}</strong>
                  ${u.role === "teacher" ? `<div><span class="badge badge-role-teacher" style="font-size:0.65rem;">Teacher</span></div>` : ""}
                </div>
              </div>
            </td>
            <td class="text-tertiary">${u.className ? `Class ${escapeHTML(u.className)}${u.section ? "-" + u.section : ""}` : "—"}</td>
            <td><strong>${u.reviewCount}</strong></td>
            <td><div class="stars">${starString(Math.round(u.avgGiven))}</div></td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No reviews have been written yet.</td></tr>`;

  // ---- Most Read Books (by review count as proxy) ----
  const booksWithStats = allBooks.map((b, i) => {
    const bReviews = allReviewArrays[i];
    const avg = bReviews.length ? bReviews.reduce((s, r) => s + (r.rating || 0), 0) / bReviews.length : 0;
    return { ...b, reviewCount: bReviews.length, avgRating: avg };
  }).sort((a, b) => b.reviewCount - a.reviewCount);

  const readBody = qs("#read-body");
  readBody.innerHTML = booksWithStats.length
    ? booksWithStats.slice(0, 20).map((b, i) => `
        <tr>
          <td><span class="leaderboard-rank ${rankClass(i)}">${medalEmoji(i) || (i + 1)}</span></td>
          <td><a href="book-details.html?id=${b.BK_ID}" style="font-weight:600;">${escapeHTML(b.bookName)}</a><div class="mono text-tertiary" style="font-size:var(--fs-tiny);">${b.BK_ID}</div></td>
          <td><span class="text-tertiary">${escapeHTML(b.genre || "—")}</span></td>
          <td><strong>${b.reviewCount}</strong></td>
          <td><div class="stars">${starString(Math.round(b.avgRating))}</div></td>
        </tr>`).join("")
    : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No books in the catalogue yet.</td></tr>`;

  // ---- Highest Rated Books (min 1 review) ----
  const ratedBooks = booksWithStats
    .filter((b) => b.reviewCount > 0)
    .sort((a, b) => b.avgRating - a.avgRating);

  const ratedBody = qs("#rated-body");
  ratedBody.innerHTML = ratedBooks.length
    ? ratedBooks.slice(0, 20).map((b, i) => `
        <tr>
          <td><span class="leaderboard-rank ${rankClass(i)}">${medalEmoji(i) || (i + 1)}</span></td>
          <td><a href="book-details.html?id=${b.BK_ID}" style="font-weight:600;">${escapeHTML(b.bookName)}</a><div class="mono text-tertiary" style="font-size:var(--fs-tiny);">${b.BK_ID}</div></td>
          <td><span class="text-tertiary">${escapeHTML(b.genre || "—")}</span></td>
          <td><div class="stars">${starString(Math.round(b.avgRating))} <span class="text-tertiary" style="font-size:var(--fs-tiny); margin-left:4px;">${b.avgRating.toFixed(1)}</span></div></td>
          <td>${b.reviewCount}</td>
        </tr>`).join("")
    : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No rated books yet.</td></tr>`;
}

init();
