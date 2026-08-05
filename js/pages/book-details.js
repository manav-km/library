import { requireAuth } from "../firebase/auth.js";
import { getBookById, getReviewsForBook, addReview, updateReview, deleteReview } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { spineColorFor, escapeHTML, starString, timeAgo, showToast, qs, qsa } from "../utils/helpers.js";

const currentProfile = await requireAuth();
renderNavbar(currentProfile, "library.html");

let currentBook = null;
let selectedRating = 0;

const params = new URLSearchParams(window.location.search);
const bookId = params.get("id");

async function init() {
  if (!bookId) {
    qs("#sec-overview").innerHTML = `<div class="empty-state"><h3>No book selected</h3><p><a href="library.html">Return to the library</a>.</p></div>`;
    return;
  }

  currentBook = await getBookById(bookId);
  if (!currentBook) {
    qs("#sec-overview").innerHTML = `<div class="empty-state"><h3>Book not found</h3><p><a href="library.html">Return to the library</a>.</p></div>`;
    return;
  }

  // Track for the student dashboard's "Recently viewed" row
  const viewed = JSON.parse(sessionStorage.getItem("sajs_recently_viewed") || "[]");
  sessionStorage.setItem("sajs_recently_viewed", JSON.stringify([bookId, ...viewed.filter((id) => id !== bookId)].slice(0, 8)));

  renderOverview(currentBook);
  renderSections(currentBook);
  const discLink = qs("#discussion-link");
  if (discLink) discLink.href = `discussions.html?book=${encodeURIComponent(bookId)}`;

  await renderReviews();
  wireStarInput();
  wireReviewForm();
  wireScrollSpy();
}

function renderOverview(b) {
  const spine = spineColorFor(b.genre);
  qs("#sec-overview").innerHTML = `
    <div class="book-cover" style="--spine-color:${spine}; display:flex; align-items:center; justify-content:center; padding:var(--sp-4); text-align:center;">
      <span class="mono" style="font-size:0.85rem; color:var(--text-tertiary); font-weight:600;">${escapeHTML(b.bookName)}</span>
    </div>
    <div>
      <span class="bk-id mono text-tertiary">${b.BK_ID}</span>
      <h1 style="margin:6px 0 4px;">${escapeHTML(b.bookName)}</h1>
      <p style="font-size:1.05rem; margin-bottom:var(--sp-3);">by ${escapeHTML(b.author)} · ${b.year}</p>
      <div class="book-meta-row">
        <span class="spine-tag" style="--spine-color:${spine};">${b.genre}</span>
        ${(b.themes || []).slice(0, 3).map((t) => `<span class="spine-tag">${escapeHTML(t)}</span>`).join("")}
      </div>
      <p>${escapeHTML(b.mainIdea || "")}</p>
      <div class="flex gap-3" style="margin-top:var(--sp-4);">
        <a href="#sec-reviews" class="btn btn-primary btn-sm">Read reviews</a>
        <a href="discussions.html?book=${b.BK_ID}" class="btn btn-ghost btn-sm">Join the discussion</a>
      </div>
    </div>
  `;
}

function renderSections(b) {
  qs("#txt-mainidea").textContent = b.mainIdea || "Not documented yet.";
  qs("#txt-setting").textContent = b.setting || "Not documented yet.";
  qs("#txt-plot").textContent = b.plot || "Not documented yet.";
  qs("#txt-conflict").textContent = b.conflict || "Not documented yet.";
  qs("#txt-resolution").textContent = b.resolution || "Not documented yet.";
  qs("#txt-moral").textContent = b.moral || "Not documented yet.";
  qs("#txt-summary").textContent = b.summary || "Not documented yet.";

  const chars = b.characters || [];
  qs("#txt-characters").innerHTML = chars.length
    ? chars.map((c) => `<div class="character-chip"><strong>${escapeHTML(c.name)}</strong> · ${escapeHTML(c.role)}</div>`).join("") +
      `<div class="stack" style="margin-top:var(--sp-3);">` +
      chars.map((c) => c.note ? `<p style="font-size:var(--fs-small);"><strong>${escapeHTML(c.name)}:</strong> ${escapeHTML(c.note)}</p>` : "").join("") +
      `</div>`
    : `<p>Not documented yet.</p>`;
}

async function renderReviews() {
  const reviews = await getReviewsForBook(bookId);
  const mount = qs("#reviews-list");
  if (!mount) return;
  const canModerate = currentProfile && (currentProfile.role === "teacher" || currentProfile.role === "admin");

  mount.innerHTML = reviews.length ? reviews.map((r) => {
    const isOwner = currentProfile && r.userId === currentProfile.uid;
    return `
      <div class="review-item" data-review-id="${r.id}" data-owner="${r.userId}">
        <div class="review-head">
          <div>
            <strong>${escapeHTML(r.userName)}</strong>
            <div class="stars">${starString(r.rating)}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-tertiary" style="font-size:var(--fs-tiny);">${timeAgo(r.timestamp)}</span>
            ${isOwner ? `
              <div class="review-actions">
                <button class="btn btn-ghost btn-sm edit-review-btn">Edit</button>
                <button class="btn btn-danger btn-sm delete-review-btn">Delete</button>
              </div>` : ""}
            ${!isOwner && canModerate ? `<button class="btn btn-danger btn-sm mod-delete-btn">Remove</button>` : ""}
          </div>
        </div>
        <p class="review-text-content" style="margin-top:var(--sp-2);">${escapeHTML(r.reviewText)}</p>
      </div>`;
  }).join("") : `<div class="empty-state"><h3>No reviews yet</h3><p>Be the first to share what you thought.</p></div>`;

  wireReviewItemActions(reviews);
}

function wireReviewItemActions(reviews) {
  qsa(".delete-review-btn, .mod-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".review-item");
      const id = item.dataset.reviewId;
      const ownerId = item.dataset.owner;
      try {
        await deleteReview(id, ownerId, currentProfile.uid, currentProfile.role !== "student");
        showToast("Review removed.");
        renderReviews();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  qsa(".edit-review-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".review-item");
      const id = item.dataset.reviewId;
      const review = reviews.find((r) => r.id === id);
      const textEl = item.querySelector(".review-text-content");
      const original = review.reviewText;

      textEl.innerHTML = `
        <textarea rows="3" class="edit-review-textarea">${escapeHTML(original)}</textarea>
        <div class="flex gap-2" style="margin-top:var(--sp-2);">
          <button class="btn btn-primary btn-sm save-edit-btn">Save</button>
          <button class="btn btn-ghost btn-sm cancel-edit-btn">Cancel</button>
        </div>`;

      item.querySelector(".save-edit-btn").addEventListener("click", async () => {
        const newText = item.querySelector(".edit-review-textarea").value.trim();
        if (!newText) return;
        await updateReview(id, review.userId, currentProfile.uid, { reviewText: newText });
        showToast("Review updated.");
        renderReviews();
      });
      item.querySelector(".cancel-edit-btn").addEventListener("click", () => renderReviews());
    });
  });
}

function wireStarInput() {
  const stars = qsa("#star-input span");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.val, 10);
      stars.forEach((s) => s.classList.toggle("active", parseInt(s.dataset.val, 10) <= selectedRating));
    });
  });
}

function wireReviewForm() {
  const form = qs("#review-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedRating) {
      showToast("Choose a star rating first.", "error");
      return;
    }
    const text = qs("#review-text").value.trim();
    if (!text) return;

    await addReview({ bookId, userId: currentProfile.uid, userName: currentProfile.name, rating: selectedRating, reviewText: text });
    qs("#review-text").value = "";
    selectedRating = 0;
    qsa("#star-input span").forEach((s) => s.classList.remove("active"));
    showToast("Review posted.");
    renderReviews();
  });
}

function wireScrollSpy() {
  const links = qsa("#book-toc a");
  const sections = links.map((l) => document.getElementById(l.getAttribute("href").slice(1))).filter(Boolean);
  window.addEventListener("scroll", () => {
    let currentId = sections[0]?.id;
    for (const sec of sections) {
      if (sec.getBoundingClientRect().top < 140) currentId = sec.id;
    }
    links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${currentId}`));
  }, { passive: true });
}

init();
