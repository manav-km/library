import { requireAuth } from "../firebase/auth.js";
import { getBookById, updateBook, deleteBook, getReviewsForBook, addReview, updateReview, deleteReview, logAuditAction } from "../firebase/firestore.js";
import { uploadImage } from "../firebase/storage.js";
import { renderNavbar } from "../components/navbar.js";
import { spineColorFor, escapeHTML, starString, timeAgo, showToast, qs, qsa } from "../utils/helpers.js";

const currentProfile = await requireAuth();
renderNavbar(currentProfile, "library.html");

let currentBook = null;
let selectedRating = 0;
const canEdit = currentProfile && (currentProfile.role === "teacher" || currentProfile.role === "admin");

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
  if (canEdit) wireBookEditModal();
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
        ${canEdit ? `<button class="btn btn-ghost btn-sm" id="edit-book-details-btn">✏️ Edit book</button>` : ""}
      </div>
    </div>
  `;

  if (canEdit) {
    qs("#edit-book-details-btn")?.addEventListener("click", openEditModal);
  }
}

function openEditModal() {
  const modal = qs("#book-modal");
  const delBtn = qs("#delete-book-modal-btn");
  if (!modal || !currentBook) return;
  qs("#book-modal-title").textContent = "Edit book";
  qs("#book-doc-id").value = currentBook.id || currentBook.BK_ID;
  qs("#f-bkid").value = currentBook.BK_ID;
  qs("#f-name").value = currentBook.bookName || "";
  qs("#f-author").value = currentBook.author || "";
  qs("#f-year").value = currentBook.year || "";
  qs("#f-genre").value = currentBook.genre || "Fiction";
  qs("#f-mainidea").value = currentBook.mainIdea || "";
  qs("#f-themes").value = (currentBook.themes || []).join(", ");
  qs("#f-characters").value = (currentBook.characters || []).map((c) => `${c.name} | ${c.role} | ${c.note || ""}`).join("\n");
  qs("#f-setting").value = currentBook.setting || "";
  qs("#f-plot").value = currentBook.plot || "";
  qs("#f-conflict").value = currentBook.conflict || "";
  qs("#f-resolution").value = currentBook.resolution || "";
  qs("#f-moral").value = currentBook.moral || "";
  qs("#f-summary").value = currentBook.summary || "";
  if (delBtn) delBtn.style.display = "inline-flex";
  modal.classList.add("open");
}

function wireBookEditModal() {
  const modal = qs("#book-modal");
  const delBtn = qs("#delete-book-modal-btn");
  qs("#cancel-book-modal")?.addEventListener("click", () => modal.classList.remove("open"));

  if (delBtn) {
    delBtn.addEventListener("click", async () => {
      const docId = qs("#book-doc-id").value;
      const bkId = qs("#f-bkid").value;
      if (!docId) return;
      const reason = prompt(`Reason for deleting book "${bkId}":`);
      if (reason === null) return; // cancelled
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        showToast("Reason is required to delete books.", "error");
        return;
      }
      try {
        await deleteBook(docId);
        logAuditAction({
          action: "BOOK_DELETE",
          category: "Books",
          details: `${currentProfile.name} (${currentProfile.role}) deleted book '${bkId}'.`,
          performedBy: currentProfile,
          targetId: bkId,
          deletedContent: `Book ID: ${currentBook.BK_ID}\nTitle: ${currentBook.bookName}\nAuthor: ${currentBook.author}\nGenre: ${currentBook.genre}`,
          reason: trimmedReason
        });
        showToast("Book deleted.");
        window.location.href = "library.html";
      } catch (err) {
        showToast("Failed to delete book: " + err.message, "error");
      }
    });
  }

  qs("#book-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

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
      summary: qs("#f-summary").value
    };

    const coverFile = qs("#f-cover").files[0];
    if (coverFile) bookData.coverImage = await uploadImage(coverFile, "covers", bookData.BK_ID);

    const docId = qs("#book-doc-id").value;
    await updateBook(docId, bookData);
    logAuditAction({
      action: "BOOK_EDIT",
      category: "Books",
      details: `${currentProfile.name} (${currentProfile.role}) edited book '${bookData.bookName}' (${bookData.BK_ID}).`,
      performedBy: currentProfile,
      targetId: bookData.BK_ID,
      beforeEdit: `Title: ${currentBook.bookName}\nAuthor: ${currentBook.author}\nGenre: ${currentBook.genre}\nMain Idea: ${currentBook.mainIdea}`,
      afterEdit: `Title: ${bookData.bookName}\nAuthor: ${bookData.author}\nGenre: ${bookData.genre}\nMain Idea: ${bookData.mainIdea}`
    });
    showToast("Book updated.");
    modal.classList.remove("open");

    // Re-fetch & update UI
    currentBook = await getBookById(bookId);
    renderOverview(currentBook);
    renderSections(currentBook);
  });
}

function renderSections(b) {
  const fields = [
    { key: "mainIdea", textId: "#txt-mainidea", secId: "#sec-mainidea", href: "#sec-mainidea" },
    { key: "setting", textId: "#txt-setting", secId: "#sec-setting", href: "#sec-setting" },
    { key: "plot", textId: "#txt-plot", secId: "#sec-plot", href: "#sec-plot" },
    { key: "conflict", textId: "#txt-conflict", secId: "#sec-conflict", href: "#sec-conflict" },
    { key: "resolution", textId: "#txt-resolution", secId: "#sec-resolution", href: "#sec-resolution" },
    { key: "moral", textId: "#txt-moral", secId: "#sec-moral", href: "#sec-moral" },
    { key: "summary", textId: "#txt-summary", secId: "#sec-summary", href: "#sec-summary" }
  ];

  fields.forEach(({ key, textId, secId, href }) => {
    const val = (b[key] || "").trim();
    const secEl = qs(secId);
    const tocEl = qs(`#book-toc a[href="${href}"]`);

    if (val) {
      if (secEl) secEl.style.display = "block";
      if (tocEl) tocEl.style.display = "block";
      const txtEl = qs(textId);
      if (txtEl) txtEl.textContent = val;
    } else {
      if (secEl) secEl.style.display = "none";
      if (tocEl) tocEl.style.display = "none";
    }
  });

  // Characters section
  const chars = (b.characters || []).filter((c) => c && c.name && c.name.trim());
  const charSec = qs("#sec-characters");
  const charToc = qs(`#book-toc a[href="#sec-characters"]`);

  if (chars.length) {
    if (charSec) charSec.style.display = "block";
    if (charToc) charToc.style.display = "block";
    const charTxt = qs("#txt-characters");
    if (charTxt) {
      charTxt.innerHTML = chars.map((c) => `<div class="character-chip"><strong>${escapeHTML(c.name)}</strong> · ${escapeHTML(c.role || "")}</div>`).join("") +
        `<div class="stack" style="margin-top:var(--sp-3);">` +
        chars.map((c) => c.note ? `<p style="font-size:var(--fs-small);"><strong>${escapeHTML(c.name)}:</strong> ${escapeHTML(c.note)}</p>` : "").join("") +
        `</div>`;
    }
  } else {
    if (charSec) charSec.style.display = "none";
    if (charToc) charToc.style.display = "none";
  }
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
    btn.addEventListener("click", () => {
      const item = btn.closest(".review-item");
      const id = item.dataset.reviewId;
      const ownerId = item.dataset.owner;
      const review = reviews.find((r) => r.id === id);
      const original = review?.reviewText || "";
      const isMod = currentProfile && currentProfile.role !== "student" && ownerId !== currentProfile.uid;

      const textEl = item.querySelector(".review-text-content");
      
      textEl.innerHTML = `
        <div class="delete-review-box" style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 450px; background: rgba(239, 68, 68, 0.05); padding: var(--sp-3); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: var(--radius-md);">
          <p style="font-size: 13px; margin: 0; color: var(--danger); font-weight: 600;">
            ${isMod ? "Are you sure you want to remove this review as a Moderator?" : "Are you sure you want to delete your review?"}
          </p>
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 2px;">Reason for deletion</label>
            <input type="text" class="delete-review-reason" placeholder="e.g. Inappropriate content" style="width: 100%; padding: 6px; font-size: 12px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-main);">
          </div>
          <div class="flex gap-2" style="justify-content: flex-end;">
            <button class="btn btn-ghost btn-sm cancel-delete-review-btn" style="padding: 2px 8px; font-size: 11px;">Cancel</button>
            <button class="btn btn-danger btn-sm confirm-delete-review-btn" style="padding: 2px 8px; font-size: 11px;">Delete</button>
          </div>
        </div>
      `;

      item.querySelector(".cancel-delete-review-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        renderReviews();
      });

      item.querySelector(".confirm-delete-review-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const reason = item.querySelector(".delete-review-reason").value.trim();
        if (!reason) {
          showToast("Please enter a reason for deletion.", "error");
          return;
        }

        try {
          await deleteReview(id, ownerId, currentProfile.uid, currentProfile.role !== "student");
          await logAuditAction({
            action: isMod ? "REVIEW_MODERATE_DELETE" : "REVIEW_DELETE",
            category: "Reviews",
            details: `${currentProfile.name} ${isMod ? "(moderator) removed" : "deleted"} review on book "${currentBook.bookName}"`,
            performedBy: currentProfile,
            targetId: id,
            deletedContent: `User: ${review.userName}\nRating: ${review.rating} stars\nContent: ${original}`,
            reason: reason
          });
          showToast("Review deleted successfully.");
          renderReviews();
        } catch (err) {
          showToast("Failed to delete review: " + err.message, "error");
        }
      });
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
        <div class="edit-review-box" style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 450px;">
          <textarea rows="3" class="edit-review-textarea" style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-main); font-family: inherit; font-size: var(--fs-small); resize: vertical;">${escapeHTML(original)}</textarea>
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 2px;">Reason for edit</label>
            <input type="text" class="edit-review-reason" placeholder="e.g. Updated thoughts" style="width: 100%; padding: 6px; font-size: 12px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-main);">
          </div>
          <div class="flex gap-2" style="justify-content: flex-end;">
            <button class="btn btn-ghost btn-sm cancel-edit-btn" style="padding: 2px 8px; font-size: 11px;">Cancel</button>
            <button class="btn btn-primary btn-sm save-edit-btn" style="padding: 2px 8px; font-size: 11px;">Enter Edit</button>
          </div>
        </div>`;

      item.querySelector(".save-edit-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const newText = item.querySelector(".edit-review-textarea").value.trim();
        const reason = item.querySelector(".edit-review-reason").value.trim();
        if (!newText) {
          showToast("Review text cannot be empty.", "error");
          return;
        }
        if (!reason) {
          showToast("Please enter a reason for the edit.", "error");
          return;
        }

        try {
          await updateReview(id, review.userId, currentProfile.uid, { reviewText: newText });
          await logAuditAction({
            action: "REVIEW_EDIT",
            category: "Reviews",
            details: `${currentProfile.name} edited review on book "${currentBook.bookName}"`,
            performedBy: currentProfile,
            targetId: id,
            beforeEdit: original,
            afterEdit: newText,
            reason: reason
          });
          showToast("Review updated successfully.");
          renderReviews();
        } catch (err) {
          showToast("Failed to edit review: " + err.message, "error");
        }
      });
      
      item.querySelector(".cancel-edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        renderReviews();
      });
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
