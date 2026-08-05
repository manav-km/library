// ==========================================================================
// Book card component
// ==========================================================================

import { spineColorFor, escapeHTML } from "../utils/helpers.js";

export function bookCardHTML(book, canEdit = false) {
  const cover = book.coverImage
    ? `<img src="${book.coverImage}" alt="${escapeHTML(book.bookName)} cover" class="book-cover" style="--spine-color:${spineColorFor(book.genre)}">`
    : `<div class="book-cover" style="--spine-color:${spineColorFor(book.genre)};display:flex;align-items:center;justify-content:center;padding:var(--sp-3);text-align:center;">
         <span class="mono" style="font-size:0.7rem;color:var(--text-tertiary);">${escapeHTML(book.bookName)}</span>
       </div>`;

  return `
    <div class="book-card-wrap" style="position:relative;">
      <a href="book-details.html?id=${encodeURIComponent(book.BK_ID)}" class="book-card">
        ${cover}
        <div>
          <span class="bk-id mono">${book.BK_ID}</span>
          <h4 class="bk-title">${escapeHTML(book.bookName)}</h4>
          <p class="bk-author">${escapeHTML(book.author)}</p>
        </div>
      </a>
      ${canEdit ? `<button class="btn btn-ghost btn-sm edit-card-btn" data-bkid="${book.BK_ID}" style="position:absolute; top:8px; right:8px; z-index:5; padding:4px 8px; font-size:var(--fs-tiny); background:rgba(15,23,42,0.75); border:1px solid var(--glass-border); border-radius:var(--radius-sm); color:var(--text-primary);">✏️ Edit</button>` : ""}
    </div>
  `;
}

export function renderBookGrid(mountEl, books, canEdit = false) {
  if (!books.length) {
    mountEl.innerHTML = `<div class="empty-state"><h3>No books here yet</h3><p>Check back soon, or try a different filter.</p></div>`;
    return;
  }
  mountEl.innerHTML = books.map((b) => bookCardHTML(b, canEdit)).join("");
}
