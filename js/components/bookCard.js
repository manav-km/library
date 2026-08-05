// ==========================================================================
// Book card component
// ==========================================================================

import { spineColorFor, escapeHTML } from "../utils/helpers.js";

export function bookCardHTML(book) {
  const cover = book.coverImage
    ? `<img src="${book.coverImage}" alt="${escapeHTML(book.bookName)} cover" class="book-cover" style="--spine-color:${spineColorFor(book.genre)}">`
    : `<div class="book-cover" style="--spine-color:${spineColorFor(book.genre)};display:flex;align-items:center;justify-content:center;padding:var(--sp-3);text-align:center;">
         <span class="mono" style="font-size:0.7rem;color:var(--text-tertiary);">${escapeHTML(book.bookName)}</span>
       </div>`;

  return `
    <a href="book-details.html?id=${encodeURIComponent(book.BK_ID)}" class="book-card">
      ${cover}
      <div>
        <span class="bk-id mono">${book.BK_ID}</span>
        <h4 class="bk-title">${escapeHTML(book.bookName)}</h4>
        <p class="bk-author">${escapeHTML(book.author)}</p>
      </div>
    </a>
  `;
}

export function renderBookGrid(mountEl, books) {
  if (!books.length) {
    mountEl.innerHTML = `<div class="empty-state"><h3>No books here yet</h3><p>Check back soon, or try a different filter.</p></div>`;
    return;
  }
  mountEl.innerHTML = books.map(bookCardHTML).join("");
}
