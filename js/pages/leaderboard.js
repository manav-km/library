import { requireAuth } from "../firebase/auth.js";
import { getAllBooks, getReviewsForBook, getAllUsers } from "../firebase/firestore.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../firebase/firebase-config.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, starString, initials, qs, qsa } from "../utils/helpers.js";
import { ALL_ACHIEVEMENTS } from "../utils/achievements.js";

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
  const [allBooks, rawUsers] = await Promise.all([getAllBooks(), getAllUsers()]);
  // Exclude teachers and admins from student leaderboards
  const allUsers = rawUsers.filter((u) => !u.role || u.role === "student");
  const allReviewArrays = await Promise.all(allBooks.map((b) => getReviewsForBook(b.BK_ID)));
  const allReviews = allReviewArrays.flat();

  // Fetch all reading progress entries to calculate finished books per reader
  let allProgressDocs = [];
  try {
    const snap = await getDocs(collection(db, "readingProgress"));
    allProgressDocs = snap.docs.map((d) => d.data());
  } catch (err) {
    console.warn("Reading progress fetch failed:", err);
  }

  // ---- 1. Top Reviewers ----
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

  // ---- 2. Most Achievements ----
  const achRankedUsers = [...allUsers]
    .map((u) => ({
      ...u,
      achList: Array.isArray(u.achievements) ? u.achievements : [],
      achCount: Array.isArray(u.achievements) ? u.achievements.length : 0
    }))
    .sort((a, b) => b.achCount - a.achCount)
    .slice(0, 20);

  const achievementsBody = qs("#achievements-body");
  achievementsBody.innerHTML = achRankedUsers.length
    ? achRankedUsers.map((u, i) => {
        const avatarHTML = u.profilePicture
          ? `<img src="${escapeHTML(u.profilePicture)}" class="avatar avatar-sm" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
          : `<div class="avatar avatar-sm">${initials(u.name || "U")}</div>`;
        
        const badgeIcons = u.achList.map((id) => {
          const found = ALL_ACHIEVEMENTS.find((a) => a.id === id);
          return found ? `<span title="${escapeHTML(found.title)}">${found.icon}</span>` : "";
        }).join(" ");

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
            <td><strong>${u.achCount} / ${ALL_ACHIEVEMENTS.length} 🏅</strong></td>
            <td style="font-size:1.1rem;">${badgeIcons || '<span class="text-tertiary" style="font-size:var(--fs-tiny);">None yet</span>'}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No achievement progress recorded yet.</td></tr>`;

  // ---- 3. Most Books Read (Readers ranked by finished books & pages read) ----
  const readerStats = {};
  for (const doc of allProgressDocs) {
    if (!doc.uid) continue;
    if (!readerStats[doc.uid]) readerStats[doc.uid] = { finished: 0, pages: 0 };
    if (doc.status === "finished") readerStats[doc.uid].finished++;
    readerStats[doc.uid].pages += Number(doc.currentPage) || 0;
  }

  const topReaders = allUsers
    .map((u) => {
      const uid = u.uid || u.id;
      const stats = readerStats[uid] || { finished: 0, pages: 0 };
      // Fallback: if student has written reviews, treat them as read books if no readingProgress doc exists
      const revCount = (userReviewMap[uid]?.count) || 0;
      const effectiveFinished = Math.max(stats.finished, revCount);
      return { ...u, finishedBooks: effectiveFinished, totalPages: stats.pages };
    })
    .sort((a, b) => b.finishedBooks - a.finishedBooks || b.totalPages - a.totalPages)
    .slice(0, 20);

  const readBody = qs("#read-body");
  readBody.innerHTML = topReaders.length
    ? topReaders.map((u, i) => {
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
            <td><strong>${u.finishedBooks} book${u.finishedBooks !== 1 ? 's' : ''}</strong></td>
            <td>${u.totalPages ? `${u.totalPages} pages` : '—'}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5" class="text-tertiary" style="text-align:center; padding:var(--sp-5);">No books read yet.</td></tr>`;

  // ---- 4. Highest Rated Books (min 1 review) ----
  const booksWithStats = allBooks.map((b, i) => {
    const bReviews = allReviewArrays[i];
    const avg = bReviews.length ? bReviews.reduce((s, r) => s + (r.rating || 0), 0) / bReviews.length : 0;
    return { ...b, reviewCount: bReviews.length, avgRating: avg };
  });

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
