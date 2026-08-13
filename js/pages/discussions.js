import { requireAuth } from "../firebase/auth.js";
import { getAllBooks, getAllUsers, logAuditAction } from "../firebase/firestore.js";
import { listenToThread, sendMessage, deleteMessage, updateMessage, deleteDiscussion, createCustomThread, listenToCustomThreads } from "../firebase/realtime.js";
import { renderNavbar } from "../components/navbar.js";
import { initials, timeAgo, escapeHTML, showToast, qs, qsa, ALL_GENRES, MAIN_FILTER_GENRES, withTimeout } from "../utils/helpers.js";

const currentProfile = await requireAuth();
renderNavbar(currentProfile, "discussions.html");

let activeThread = null;
let unsubscribe = null;
let books = [];
let customThreads = [];
let usersCache = new Map();
let loadedMessagesList = [];
let isSelectionMode = false;
let selectedMsgIds = new Set();

const params = new URLSearchParams(window.location.search);
const preselectId = params.get("book");

let activeGenre = "all";

async function init() {
  books = await getAllBooks();

  // Load all users to cache profile pictures and roles
  try {
    const allUsers = await getAllUsers();
    allUsers.forEach((u) => {
      usersCache.set(u.uid, u);
    });
  } catch (err) {
    console.warn("Failed to load users for discussions cache:", err);
  }

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
  wireModerationControls();
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

  const canModerate = currentProfile && (currentProfile.role === "teacher" || currentProfile.role === "admin");
  const actionsContainer = qs("#thread-actions-container");
  if (actionsContainer) {
    actionsContainer.style.display = canModerate ? "flex" : "none";
  }

  // Reset bulk selection
  isSelectionMode = false;
  selectedMsgIds.clear();
  const bulkConfirmBtn = qs("#disc-bulk-confirm-btn");
  if (bulkConfirmBtn) bulkConfirmBtn.style.display = "none";
  const bulkDeleteBtn = qs("#disc-bulk-delete-btn");
  if (bulkDeleteBtn) {
    bulkDeleteBtn.style.background = "";
    bulkDeleteBtn.style.color = "";
  }

  if (unsubscribe) unsubscribe();
  unsubscribe = listenToThread(thread.id, renderMessages);
}

function renderMessages(messages) {
  console.log("💬 [Discussions] Received messages for active thread:", messages);
  loadedMessagesList = messages;
  const scroll = qs("#chat-scroll");
  if (!scroll) return;
  const canModerate = currentProfile && (currentProfile.role === "teacher" || currentProfile.role === "admin");

  scroll.innerHTML = messages.length ? messages.map((m) => {
    const isOwn = currentProfile && m.senderUid === currentProfile.uid;
    const cachedUser = usersCache.get(m.senderUid);
    const photoUrl = cachedUser?.profilePicture || "";

    const avatarHTML = photoUrl 
      ? `<img src="${escapeHTML(photoUrl)}" class="avatar avatar-sm" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
      : `<div class="avatar avatar-sm" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-sunken);font-size:12px;font-weight:600;">${initials(m.sender)}</div>`;

    const checkboxHTML = isSelectionMode 
      ? `<input type="checkbox" class="msg-select-chk" data-id="${m.id}" ${selectedMsgIds.has(m.id) ? 'checked' : ''} style="margin-right:12px; width:18px; height:18px; cursor:pointer; align-self:center;">`
      : '';

    return `
      <div class="chat-msg ${isOwn ? "own" : ""}" data-msg-id="${m.id}" data-text="${escapeHTML(m.message)}">
        ${checkboxHTML}
        ${avatarHTML}
        <div class="chat-body">
          <div class="chat-meta">
            <span class="chat-name">${escapeHTML(m.sender)}</span>
            <span class="chat-time">${timeAgo(m.timestamp)}</span>
          </div>
          <div class="chat-bubble-container" style="position:relative; display:flex; flex-direction:column; width:100%; align-items:${isOwn ? 'flex-end' : 'flex-start'}; max-width:80%;">
            <div class="chat-bubble" style="word-break:break-word; max-width:100%;">
              ${escapeHTML(m.message)}
            </div>
            ${isOwn && !isSelectionMode ? `
              <div class="msg-actions" style="display:none; gap:6px; margin-top:4px; justify-content:flex-end; width:100%;">
                <button class="btn btn-ghost btn-sm edit-msg-btn" style="padding:2px 6px; font-size:11px;" title="Edit message">✏️</button>
                <button class="btn btn-ghost btn-sm delete-msg-btn" style="padding:2px 6px; font-size:11px;" title="Delete message">🗑️</button>
              </div>
            ` : ""}
            ${!isOwn && canModerate && !isSelectionMode ? `<button class="btn btn-danger btn-sm mod-remove-msg" data-id="${m.id}" style="margin-top:4px; padding:2px 8px;">Remove</button>` : ""}
          </div>
        </div>
      </div>`;
  }).join("") : `<div class="chat-msg system-msg"><div class="chat-bubble">No messages yet — start the conversation.</div></div>`;

  if (!isSelectionMode) {
    scroll.scrollTop = scroll.scrollHeight;
  }

  // Wire up checkbox selection handlers
  qsa(".msg-select-chk", scroll).forEach((chk) => {
    chk.addEventListener("change", () => {
      const id = chk.dataset.id;
      if (chk.checked) {
        selectedMsgIds.add(id);
      } else {
        selectedMsgIds.delete(id);
      }
      const bulkConfirmBtn = qs("#disc-bulk-confirm-btn");
      if (bulkConfirmBtn) {
        bulkConfirmBtn.textContent = `Delete Selected (${selectedMsgIds.size})`;
      }
    });
  });

  // Wire up student Edit action
  qsa(".edit-msg-btn", scroll).forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".chat-msg");
      const msgId = item.dataset.msgId;
      const originalText = item.dataset.text;
      const bubble = item.querySelector(".chat-bubble");
      const actions = item.querySelector(".msg-actions");
      if (actions) actions.style.display = "none";

      bubble.innerHTML = `
        <div class="edit-msg-box" style="margin-top: 4px; display: flex; flex-direction: column; gap: 8px; width: 100%; min-width: 250px;">
          <textarea class="edit-msg-textarea" style="width: 100%; min-height: 60px; padding: 8px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-main); font-family: inherit; font-size: var(--fs-small); resize: vertical;">${escapeHTML(originalText)}</textarea>
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 2px;">Reason for edit</label>
            <input type="text" class="edit-msg-reason" placeholder="e.g. Corrected spelling" style="width: 100%; padding: 4px 6px; font-size: 12px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-main);">
          </div>
          <div class="flex gap-2" style="justify-content: flex-end;">
            <button class="btn btn-ghost btn-sm cancel-msg-edit-btn" style="padding: 2px 8px; font-size: 11px;">Cancel</button>
            <button class="btn btn-primary btn-sm save-msg-edit-btn" style="padding: 2px 8px; font-size: 11px;">Enter Edit</button>
          </div>
        </div>
      `;

      bubble.querySelector(".cancel-msg-edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        renderMessages(messages);
      });

      bubble.querySelector(".save-msg-edit-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const newText = bubble.querySelector(".edit-msg-textarea").value.trim();
        const reason = bubble.querySelector(".edit-msg-reason").value.trim();

        if (!newText) {
          showToast("Message content cannot be empty.", "error");
          return;
        }
        if (!reason) {
          showToast("Please enter a reason for the edit.", "error");
          return;
        }

        try {
          await updateMessage(activeThread.id, msgId, newText);
          await logAuditAction({
            action: "MESSAGE_EDIT",
            category: "Discussions",
            details: `${currentProfile.name} edited message in discussion "${activeThread.title}"`,
            performedBy: currentProfile,
            targetId: msgId,
            beforeEdit: originalText,
            afterEdit: newText,
            reason: reason
          });
          showToast("Message updated successfully.");
        } catch (err) {
          showToast("Failed to edit message: " + err.message, "error");
        }
      });
    });
  });

  // Wire up student Delete action
  qsa(".delete-msg-btn", scroll).forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".chat-msg");
      const msgId = item.dataset.msgId;
      const originalText = item.dataset.text;
      const bubble = item.querySelector(".chat-bubble");
      const actions = item.querySelector(".msg-actions");
      if (actions) actions.style.display = "none";

      bubble.innerHTML = `
        <div class="delete-msg-box" style="margin-top: 4px; display: flex; flex-direction: column; gap: 8px; width: 100%; min-width: 250px;">
          <p style="font-size: 12px; margin: 0; color: var(--danger); font-weight:600;">Are you sure you want to delete this message?</p>
          <div>
            <label style="font-size: 11px; color: var(--text-tertiary); display: block; margin-bottom: 2px;">Reason for deletion</label>
            <input type="text" class="delete-msg-reason" placeholder="e.g. Posted in wrong thread" style="width: 100%; padding: 4px 6px; font-size: 12px; background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-main);">
          </div>
          <div class="flex gap-2" style="justify-content: flex-end;">
            <button class="btn btn-ghost btn-sm cancel-msg-delete-btn" style="padding: 2px 8px; font-size: 11px;">Cancel</button>
            <button class="btn btn-danger btn-sm confirm-msg-delete-btn" style="padding: 2px 8px; font-size: 11px;">Delete</button>
          </div>
        </div>
      `;

      bubble.querySelector(".cancel-msg-delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        renderMessages(messages);
      });

      bubble.querySelector(".confirm-msg-delete-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const reason = bubble.querySelector(".delete-msg-reason").value.trim();

        if (!reason) {
          showToast("Please enter a reason for deletion.", "error");
          return;
        }

        try {
          await deleteMessage(activeThread.id, msgId);
          await logAuditAction({
            action: "MESSAGE_DELETE",
            category: "Discussions",
            details: `${currentProfile.name} deleted message in discussion "${activeThread.title}"`,
            performedBy: currentProfile,
            targetId: msgId,
            deletedContent: originalText,
            reason: reason
          });
          showToast("Message deleted successfully.");
        } catch (err) {
          showToast("Failed to delete message: " + err.message, "error");
        }
      });
    });
  });

  // Wire up teacher mod single remove
  qsa(".mod-remove-msg", scroll).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".chat-msg");
      const msgId = btn.dataset.id;
      const originalText = item.dataset.text;
      const reason = prompt("Enter reason for removing this message (moderator):");
      if (reason === null) return; // cancelled
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        showToast("Reason is required to remove messages.", "error");
        return;
      }
      try {
        await deleteMessage(activeThread.id, msgId);
        await logAuditAction({
          action: "MESSAGE_MODERATE_DELETE",
          category: "Discussions",
          details: `${currentProfile.name} (moderator) removed message in discussion "${activeThread.title}"`,
          performedBy: currentProfile,
          targetId: msgId,
          deletedContent: originalText,
          reason: trimmedReason
        });
        showToast("Message removed by moderator.");
      } catch (err) {
        showToast("Failed to remove message: " + err.message, "error");
      }
    });
  });
}

function wireModerationControls() {
  const membersBtn = qs("#disc-members-btn");
  const bulkDeleteBtn = qs("#disc-bulk-delete-btn");
  const bulkConfirmBtn = qs("#disc-bulk-confirm-btn");
  const deleteDiscBtn = qs("#disc-delete-btn");

  const membersModal = qs("#discussion-members-modal");
  const closeMembersBtn = qs("#close-members-modal");
  const deleteDiscModal = qs("#delete-discussion-modal");
  const cancelDeleteDiscBtn = qs("#cancel-delete-disc-modal");
  const deleteDiscForm = qs("#delete-discussion-form");

  if (membersBtn) {
    membersBtn.addEventListener("click", () => {
      // Find unique senders from loadedMessagesList
      const uniqueUids = new Set();
      const uniqueUsers = [];
      loadedMessagesList.forEach((m) => {
        if (m.senderUid && !uniqueUids.has(m.senderUid)) {
          uniqueUids.add(m.senderUid);
          const cachedUser = usersCache.get(m.senderUid);
          uniqueUsers.push({
            uid: m.senderUid,
            name: m.sender || "Member",
            role: cachedUser?.role || "student",
            className: cachedUser?.className || "",
            section: cachedUser?.section || "",
            subject: cachedUser?.subject || "",
            profilePicture: cachedUser?.profilePicture || ""
          });
        }
      });

      const listContainer = qs("#discussion-members-list");
      if (listContainer) {
        listContainer.innerHTML = uniqueUsers.length ? uniqueUsers.map((u) => {
          const avatarHTML = u.profilePicture
            ? `<img src="${escapeHTML(u.profilePicture)}" class="avatar avatar-sm" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
            : `<div class="avatar avatar-sm" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-sunken);font-size:12px;font-weight:600;">${initials(u.name)}</div>`;
          return `
            <div class="flex items-center gap-3" style="padding:var(--sp-2) 0; border-bottom:1px solid var(--glass-border);">
              ${avatarHTML}
              <div>
                <strong>${escapeHTML(u.name)}</strong>
                <div class="text-tertiary" style="font-size:var(--fs-tiny); text-transform:capitalize;">
                  ${escapeHTML(u.role)} ${u.className ? `· Class ${escapeHTML(u.className)}-${escapeHTML(u.section)}` : ""} ${u.subject ? `· ${escapeHTML(u.subject)}` : ""}
                </div>
              </div>
            </div>
          `;
        }).join("") : `<p class="text-tertiary" style="text-align:center;">No members have sent messages in this thread yet.</p>`;
      }

      membersModal.classList.add("open");
    });
  }

  if (closeMembersBtn) {
    closeMembersBtn.addEventListener("click", () => {
      membersModal.classList.remove("open");
    });
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener("click", () => {
      isSelectionMode = !isSelectionMode;
      selectedMsgIds.clear();
      bulkDeleteBtn.style.background = isSelectionMode ? "rgba(239, 68, 68, 0.2)" : "";
      bulkDeleteBtn.style.color = isSelectionMode ? "var(--danger)" : "";
      bulkConfirmBtn.style.display = isSelectionMode ? "inline-flex" : "none";
      bulkConfirmBtn.textContent = `Delete Selected (0)`;
      renderMessages(loadedMessagesList); // re-render to show/hide checkboxes
    });
  }

  if (bulkConfirmBtn) {
    bulkConfirmBtn.addEventListener("click", async () => {
      if (selectedMsgIds.size === 0) {
        showToast("No messages selected.", "error");
        return;
      }
      const reason = prompt(`Reason for deleting ${selectedMsgIds.size} messages:`);
      if (reason === null) return; // cancelled
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        showToast("Reason is required to delete messages.", "error");
        return;
      }

      try {
        const deletedMsgsDetails = [];
        for (const msgId of selectedMsgIds) {
          const msgObj = loadedMessagesList.find(m => m.id === msgId);
          if (msgObj) {
            deletedMsgsDetails.push(`[${msgObj.sender}]: ${msgObj.message}`);
            await deleteMessage(activeThread.id, msgId);
          }
        }

        // Log the bulk delete
        await logAuditAction({
          action: "MESSAGE_BULK_DELETE",
          category: "Discussions",
          details: `${currentProfile.name} bulk deleted ${selectedMsgIds.size} messages in thread "${activeThread.title}"`,
          performedBy: currentProfile,
          deletedContent: deletedMsgsDetails.join("\n"),
          reason: trimmedReason
        });

        showToast(`${selectedMsgIds.size} messages deleted successfully.`);
        isSelectionMode = false;
        selectedMsgIds.clear();
        bulkDeleteBtn.style.background = "";
        bulkDeleteBtn.style.color = "";
        bulkConfirmBtn.style.display = "none";
      } catch (err) {
        showToast("Failed to delete messages: " + err.message, "error");
      }
    });
  }

  if (deleteDiscBtn) {
    deleteDiscBtn.addEventListener("click", () => {
      qs("#delete-disc-name-placeholder").textContent = activeThread.title;
      qs("#delete-disc-reason-input").value = "";
      qs("#delete-disc-heading-input").value = "";
      deleteDiscModal.classList.add("open");
    });
  }

  if (cancelDeleteDiscBtn) {
    cancelDeleteDiscBtn.addEventListener("click", () => {
      deleteDiscModal.classList.remove("open");
    });
  }

  if (deleteDiscForm) {
    deleteDiscForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const reason = qs("#delete-disc-reason-input").value.trim();
      const typedHeading = qs("#delete-disc-heading-input").value.trim();

      if (typedHeading !== activeThread.title) {
        showToast("The typed title does not match the discussion heading exactly.", "error");
        return;
      }

      const deletingThread = activeThread;
      try {
        await deleteDiscussion(deletingThread.id);
        
        await logAuditAction({
          action: "DISCUSSION_DELETE",
          category: "Discussions",
          details: `Discussion thread "${deletingThread.title}" deleted by ${currentProfile.name}`,
          performedBy: currentProfile,
          targetId: deletingThread.id,
          deletedContent: `Title: ${deletingThread.title}\nSubtitle: ${deletingThread.subtitle}`,
          reason: reason
        });

        showToast("Discussion thread deleted.");
        deleteDiscModal.classList.remove("open");

        // Clear active thread and redirect / refresh list
        activeThread = null;
        qs("#thread-title").textContent = "Select a discussion thread";
        qs("#thread-subtitle").textContent = "";
        qs("#chat-input").disabled = true;
        qs("#chat-send-btn").disabled = true;
        qs("#chat-scroll").innerHTML = "";
        qs("#thread-actions-container").style.display = "none";
      } catch (err) {
        showToast("Failed to delete discussion: " + err.message, "error");
      }
    });
  }
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
