import { watchAuthState } from "../firebase/auth.js";
import { getAllBooks } from "../firebase/firestore.js";
import { listenToThread, sendMessage, deleteMessage } from "../firebase/realtime.js";
import { renderNavbar } from "../components/navbar.js";
import { initials, timeAgo, escapeHTML, qs, qsa } from "../utils/helpers.js";

let currentProfile = null;
let activeBook = null;
let unsubscribe = null;
let books = [];

watchAuthState((profile) => {
  currentProfile = profile;
  renderNavbar(profile, "discussions.html");
});

const params = new URLSearchParams(window.location.search);
const preselectId = params.get("book");

async function init() {
  books = await getAllBooks();
  renderThreadList();

  const initial = books.find((b) => b.BK_ID === preselectId) || books[0];
  if (initial) openThread(initial);
}

function renderThreadList() {
  const mount = qs("#thread-list");
  if (!mount) return;
  mount.innerHTML = books.map((b) => `
    <div class="thread-item" data-id="${b.BK_ID}">
      <strong style="font-size:var(--fs-small);">${escapeHTML(b.bookName)}</strong>
      <div class="text-tertiary mono" style="font-size:var(--fs-tiny); margin-top:2px;">${b.BK_ID}</div>
    </div>
  `).join("");

  qsa(".thread-item", mount).forEach((item) => {
    item.addEventListener("click", () => {
      const book = books.find((b) => b.BK_ID === item.dataset.id);
      openThread(book);
    });
  });
}

function openThread(book) {
  activeBook = book;
  qsa(".thread-item").forEach((el) => el.classList.toggle("active", el.dataset.id === book.BK_ID));
  qs("#thread-title").textContent = book.bookName;
  qs("#thread-subtitle").textContent = `${book.BK_ID} · discussing with the class`;

  const input = qs("#chat-input");
  const sendBtn = qs("#chat-send-btn");
  if (input && sendBtn) {
    input.disabled = !currentProfile;
    sendBtn.disabled = !currentProfile;
    input.placeholder = currentProfile ? "Write a message..." : "Sign in to join the discussion";
  }

  if (unsubscribe) unsubscribe();
  unsubscribe = listenToThread(book.BK_ID, renderMessages);
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
    btn.addEventListener("click", () => deleteMessage(activeBook.BK_ID, btn.dataset.id));
  });
}

function send() {
  const input = qs("#chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text || !currentProfile || !activeBook) return;
  sendMessage(activeBook.BK_ID, { sender: currentProfile.name, senderUid: currentProfile.uid, message: text });
  input.value = "";
}

const sendBtn = qs("#chat-send-btn");
if (sendBtn) sendBtn.addEventListener("click", send);
const chatInput = qs("#chat-input");
if (chatInput) chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

init();
