// ==========================================================================
// Reusable Leave Review Modal component
// ==========================================================================

import { addReview } from "../firebase/firestore.js";
import { showToast, qs, qsa, escapeHTML } from "../utils/helpers.js";

let modalInjected = false;
let selectedRating = 0;

export function ensureReviewModal(currentProfile, onSuccess = null) {
  if (!modalInjected) {
    const modalHTML = `
      <div class="modal-overlay" id="leave-review-modal" style="z-index: 10000;">
        <div class="modal" style="max-width:540px; max-height:88vh; overflow-y:auto;">
          <h3 id="review-modal-heading" style="margin-bottom:4px;">Leave a Review</h3>
          <p class="text-tertiary" id="review-modal-subheading" style="margin-top:0; font-size:var(--fs-small); margin-bottom:var(--sp-4);">Share your thoughts with the Jaipuria community.</p>
          
          <form id="leave-review-form">
            <input type="hidden" id="review-book-id">
            
            <div class="field">
              <label>Your Rating (1–5 Stars)</label>
              <div class="star-input" id="modal-star-input" style="font-size:1.6rem; cursor:pointer;">
                <span data-val="1">★</span><span data-val="2">★</span><span data-val="3">★</span><span data-val="4">★</span><span data-val="5">★</span>
              </div>
            </div>

            <div class="field">
              <label for="review-why-liked">Why did you like it?</label>
              <textarea id="review-why-liked" rows="2" placeholder="Tell us what you enjoyed most about this book..." required></textarea>
            </div>

            <div class="field">
              <label for="review-what-learnt">What did you learn from it?</label>
              <textarea id="review-what-learnt" rows="2" placeholder="Share key takeaways or lessons..." required></textarea>
            </div>

            <div class="field">
              <label for="review-can-improved">What could be improved?</label>
              <textarea id="review-can-improved" rows="2" placeholder="Any suggestions or aspects that could be better?..."></textarea>
            </div>

            <div class="flex gap-3" style="margin-top:var(--sp-5);">
              <button type="button" class="btn btn-ghost btn-block" id="cancel-leave-review">Cancel</button>
              <button type="submit" class="btn btn-primary btn-block">Submit Review</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    modalInjected = true;

    wireModalInteractions(currentProfile, onSuccess);
  } else {
    wireModalInteractions(currentProfile, onSuccess);
  }

  wireReviewButtons(currentProfile);
}

function wireModalInteractions(currentProfile, onSuccess) {
  const modal = qs("#leave-review-modal");
  const form = qs("#leave-review-form");
  const cancelBtn = qs("#cancel-leave-review");
  const stars = qsa("#modal-star-input span");

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.val, 10);
      stars.forEach((s) => s.classList.toggle("active", parseInt(s.dataset.val, 10) <= selectedRating));
    });
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("open");
    });
  }

  if (form) {
    // Prevent duplicate submission handlers
    form.replaceWith(form.cloneNode(true));
    const newForm = qs("#leave-review-form");

    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedRating) {
        showToast("Please choose a star rating first.", "error");
        return;
      }
      const bookId = qs("#review-book-id").value;
      const whyLiked = qs("#review-why-liked").value.trim();
      const whatLearnt = qs("#review-what-learnt").value.trim();
      const canBeImproved = qs("#review-can-improved").value.trim();

      if (!whyLiked || !whatLearnt) {
        showToast("Please fill in what you liked and what you learnt.", "error");
        return;
      }

      await addReview({
        bookId,
        userId: currentProfile.uid,
        userName: currentProfile.name,
        rating: selectedRating,
        whyLiked,
        whatLearnt,
        canBeImproved
      });

      showToast("Review submitted! Thank you for sharing.");
      modal.classList.remove("open");
      newForm.reset();
      selectedRating = 0;
      qsa("#modal-star-input span").forEach((s) => s.classList.remove("active"));

      if (onSuccess) onSuccess(bookId);
    });
  }
}

export function openReviewModalForBook(bookId, bookTitle) {
  const modal = qs("#leave-review-modal");
  if (!modal) return;

  qs("#review-book-id").value = bookId;
  qs("#review-modal-heading").textContent = `Review: ${bookTitle}`;
  qs("#leave-review-form")?.reset();
  selectedRating = 0;
  qsa("#modal-star-input span").forEach((s) => s.classList.remove("active"));

  modal.classList.add("open");
}

export function wireReviewButtons(currentProfile) {
  qsa(".leave-review-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openReviewModalForBook(btn.dataset.bkid, btn.dataset.title);
    });
  });
}
