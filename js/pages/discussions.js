import { requireAuth } from "../firebase/auth.js";
import { getAllBooks } from "../firebase/firestore.js";
import { listenToThread, sendMessage, deleteMessage, createCustomThread, listenToCustomThreads } from "../firebase/realtime.js";
import { renderNavbar } from "../components/navbar.js";
import { initials, timeAgo, escapeHTML, showToast, qs, qsa, ALL_GENRES, MAIN_FILTER_GENRES, withTimeout } from "../utils/helpers.js";

const currentProfile = await requireAuth();
renderNavbar(currentProfile, "discussions.html");

let activeThread = null;
let unsubscribe = null;
let books = [];
let customThreads = [];

const params = new URLSearchParams(window.location.search);
const preselectId = params.get("book");

let activeGenre = "all";

async function init() {
  books = await getAllBooks();

  renderGenreChips();

  listenToCustomThreads((threads) => {
    customThreads = threads;
    renderThreadList();
  });

  renderThreadList();

  const initialBook = books.find((b) => b.BK_ID === preselectId);
  if (initialBook) {
    openThread({ id: initialBook.BK_ID, title: initialBook.bookName, subtitle: `${initialBook.BK_ID} · Book Discussion` });
  } else if (books.length) {
    openThread({ id: books[0].BK_ID, title: books[0].bookName, subtitle: `${books[0].BK_ID} · Book Discussion` });
  }

  wireCreateThreadModal();
}

let isExpandedGenres = false;

function renderGenreChips() {
  const chipRow = qs("#discussion-genre-chips");
  if (!chipRow) return;
  const bookGenres = books.map((b) => b.genre).filter(Boolean);
  const extraGenres = bookGenres.filter((g) => !MAIN_FILTER_GENRES.includes(g));

  const allAvailableGenres = [...new Set([...ALL_GENRES, ...extraGenres])];
  const otherGenres = allAvailableGenres.filter((g) => !MAIN_FILTER_GENRES.includes(g));

  const visibleGenres = isExpandedGenres ? [...MAIN_FILTER_GENRES, ...otherGenres] : MAIN_FILTER_GENRES;

  let html = `<button class="genre-chip ${activeGenre === 'all' ? 'active' : ''}" data-genre="all">All discussions</button>`;
  html += visibleGenres.map((g) => `<button class="genre-chip ${activeGenre === g ? 'active' : ''}" data-genre="${g}">${g}</button>`).join("");

  if (isExpandedGenres) {
    html += `<button class="genre-chip show-more-chip" id="toggle-show-more-disc">Show Less ∧</button>`;
  } else {
    html += `<button class="genre-chip show-more-chip" id="toggle-show-more-disc">Show More ∨</button>`;
  }

  chipRow.innerHTML = html;

  qsa(".genre-chip:not(.show-more-chip)", chipRow).forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa(".genre-chip", chipRow).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeGenre = chip.dataset.genre;
      renderThreadList();
    });
  });

  const toggleBtn = qs("#toggle-show-more-disc", chipRow);
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isExpandedGenres = !isExpandedGenres;
      renderGenreChips();
    });
  }
}

function renderThreadList() {
  const mount = qs("#thread-list");
  if (!mount) return;

  const filteredBooks = books.filter((b) => activeGenre === "all" || b.genre === activeGenre);

  const bookItems = filteredBooks.map((b) => `
    <div class="thread-item" data-id="${b.BK_ID}" data-title="${escapeHTML(b.bookName)}" data-subtitle="${b.BK_ID} · ${b.genre}">
      <strong style="font-size:var(--fs-small);">${escapeHTML(b.bookName)}</strong>
      <div class="text-tertiary mono" style="font-size:var(--fs-tiny); margin-top:2px;">${b.BK_ID} · ${b.genre}</div>
    </div>
  `).join("");

  const customItems = (activeGenre === "all" ? customThreads : []).map((t) => `
    <div class="thread-item" data-id="${t.id}" data-title="${escapeHTML(t.title)}" data-subtitle="Started by ${escapeHTML(t.creatorName || 'Member')}">
      <strong style="font-size:var(--fs-small);">${escapeHTML(t.title)}</strong>
      <div class="text-tertiary" style="font-size:var(--fs-tiny); margin-top:2px;">By ${escapeHTML(t.creatorName || 'Member')} · Topic</div>
    </div>
  `).join("");

  mount.innerHTML = `
    ${activeGenre === "all" ? `
      <div style="font-size:var(--fs-tiny); text-transform:uppercase; letter-spacing:0.06em; color:var(--text-tertiary); margin-bottom:var(--sp-2);">Community Topics</div>
      ${customItems.length ? customItems : `<p class="text-tertiary" style="font-size:var(--fs-tiny); margin-bottom:var(--sp-3);">No custom topics yet — start one!</p>`}
    ` : ""}
    <div style="font-size:var(--fs-tiny); text-transform:uppercase; letter-spacing:0.06em; color:var(--text-tertiary); margin:${activeGenre === "all" ? 'var(--sp-4)' : '0'} 0 var(--sp-2) 0;">Book Discussions (${filteredBooks.length})</div>
    ${bookItems.length ? bookItems : `<p class="text-tertiary" style="font-size:var(--fs-tiny);">No books in this genre yet.</p>`}
  `;

  qsa(".thread-item", mount).forEach((item) => {
    item.addEventListener("click", () => {
      openThread({
        id: item.dataset.id,
        title: item.dataset.title,
        subtitle: item.dataset.subtitle
      });
    });
  });

  if (activeThread) {
    qsa(".thread-item", mount).forEach((el) => el.classList.toggle("active", el.dataset.id === activeThread.id));
  }
}

function openThread(thread) {
  activeThread = thread;
  qsa(".thread-item").forEach((el) => el.classList.toggle("active", el.dataset.id === thread.id));
  qs("#thread-title").textContent = thread.title;
  qs("#thread-subtitle").textContent = thread.subtitle;

  const input = qs("#chat-input");
  const sendBtn = qs("#chat-send-btn");
  if (input && sendBtn) {
    input.disabled = false;
    sendBtn.disabled = false;
    input.placeholder = "Write a message...";
  }

  if (unsubscribe) unsubscribe();
  unsubscribe = listenToThread(thread.id, renderMessages);
}

function renderMessages(messages) {
  const scroll = qs("#chat-scroll");
  if (!scroll) return;
  const canModerate = currentProfile && (currentProfile.role === "teacher" || currentProfile.role === "admin");

  scroll.innerHTML = messages.length ? messages.map((m) => {
    const isOwn = currentProfile && m.senderUid === currentProfile.uid;
    return `
      <div class="chat-msg ${isOwn ? "own" : ""}">
        <div class="avatar avatar-sm">${initials(m.sender)}</div>
        <div>
          <div class="chat-meta">
            <span class="chat-name">${escapeHTML(m.sender)}</span>
            <span class="chat-time">${timeAgo(m.timestamp)}</span>
          </div>
          <div class="chat-bubble">
            ${escapeHTML(m.message)}
            ${canModerate ? `<button class="btn btn-danger btn-sm mod-remove-msg" data-id="${m.id}" style="margin-left:8px; padding:2px 8px;">Remove</button>` : ""}
          </div>
        </div>
      </div>`;
  }).join("") : `<div class="chat-msg system-msg"><div class="chat-bubble">No messages yet — start the conversation.</div></div>`;

  scroll.scrollTop = scroll.scrollHeight;

  qsa(".mod-remove-msg", scroll).forEach((btn) => {
    btn.addEventListener("click", () => deleteMessage(activeThread.id, btn.dataset.id));
  });
}

async function send() {
  const input = qs("#chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text || !currentProfile || !activeThread) return;
  try {
    await sendMessage(activeThread.id, { sender: currentProfile.name, senderUid: currentProfile.uid, message: text });
    input.value = "";
  } catch (err) {
    console.error("Failed to send message:", err);
    showToast(err.message || "Could not send message.", "error");
  }
}

function wireCreateThreadModal() {
  const modal = qs("#create-thread-modal");
  const createBtn = qs("#create-thread-btn");
  const cancelBtn = qs("#cancel-thread-modal");
  const form = qs("#create-thread-form");

  if (createBtn) {
    createBtn.addEventListener("click", () => {
      form.reset();
      modal.classList.add("open");
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => modal.classList.remove("open"));
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = qs("#thread-topic-title").value.trim();
      const firstMessage = qs("#thread-first-msg").value.trim();
      if (!title || !firstMessage) return;

      const submitBtn = qs("#create-thread-form button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Posting...";
      }

      try {
        const newThread = await withTimeout(createCustomThread({
          title,
          creatorName: currentProfile.name,
          creatorUid: currentProfile.uid,
          firstMessage
        }));

        showToast("Discussion created.");
        modal.classList.remove("open");
        openThread({ id: newThread.id, title: newThread.title, subtitle: `Started by ${currentProfile.name}` });
      } catch (err) {
        console.error("Error creating discussion:", err);
        showToast("Failed to create discussion: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Post discussion";
        }
      }
    });
  }
}

const sendBtn = qs("#chat-send-btn");
if (sendBtn) sendBtn.addEventListener("click", send);
const chatInput = qs("#chat-input");
if (chatInput) chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

init();
