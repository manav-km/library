import { requireAuth } from "../firebase/auth.js";
import { getAllUsers } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, timeAgo, initials, qs, qsa } from "../utils/helpers.js";

const profile = await requireAuth();
renderNavbar(profile, "discover.html");

let allUsers = [];

function roleBadge(role = "student") {
  return `<span class="badge badge-role-${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`;
}

function renderPeopleTable(list) {
  const tbody = qs("#people-table-body");
  const countEl = qs("#people-count");
  if (countEl) countEl.textContent = `Showing ${list.length} ${list.length === 1 ? "person" : "people"}`;
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-tertiary" style="text-align:center; padding:var(--sp-4);">No users found matching your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((u) => {
    const userId = u.id || u.uid;
    const userInitials = initials(u.name || "U");
    const avatarHTML = u.profilePicture
      ? `<img src="${escapeHTML(u.profilePicture)}" class="avatar avatar-sm" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
      : `<div class="avatar avatar-sm">${escapeHTML(userInitials)}</div>`;

    const lastOnlineText = u.lastOnline
      ? timeAgo(u.lastOnline)
      : (u.createdAt ? timeAgo(u.createdAt) : "Recently");

    return `
      <tr data-uid="${userId}">
        <td>
          <div class="flex items-center gap-3">
            ${avatarHTML}
            <div>
              <strong>${escapeHTML(u.name || "Unnamed User")}</strong>
              <div style="margin-top:2px;">${roleBadge(u.role || "student")}</div>
            </div>
          </div>
        </td>
        <td>${escapeHTML(u.className || "—")}</td>
        <td>${escapeHTML(u.section || "—")}</td>
        <td><span class="spine-tag">${escapeHTML(u.favouriteGenre || "Fiction")}</span></td>
        <td><span class="text-tertiary" style="font-size:var(--fs-tiny);">${lastOnlineText}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm view-profile-btn" data-uid="${userId}">View full profile</button>
        </td>
      </tr>
    `;
  }).join("");

  qsa(".view-profile-btn", tbody).forEach((btn) => {
    btn.addEventListener("click", () => openProfileModal(btn.dataset.uid));
  });
}

function openProfileModal(uid) {
  const targetUser = allUsers.find((u) => u.id === uid || u.uid === uid);
  if (!targetUser) return;

  const container = qs("#user-profile-content");
  if (!container) return;

  const role = targetUser.role || "student";
  const userInitials = initials(targetUser.name || "U");
  const avatarHTML = targetUser.profilePicture
    ? `<img src="${escapeHTML(targetUser.profilePicture)}" class="avatar avatar-lg" alt="${escapeHTML(targetUser.name)}">`
    : `<div class="avatar avatar-lg">${escapeHTML(userInitials)}</div>`;

  const formattedDate = targetUser.createdAt
    ? new Date(targetUser.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const lastOnlineText = targetUser.lastOnline
    ? timeAgo(targetUser.lastOnline)
    : (targetUser.createdAt ? timeAgo(targetUser.createdAt) : "Recently");

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: var(--sp-4);">
      <div style="display: flex; justify-content: center; margin-bottom: var(--sp-3);">
        ${avatarHTML}
      </div>
      <h3 style="margin: 0 0 4px 0; font-size: var(--fs-h3);">${escapeHTML(targetUser.name || "Unnamed User")}</h3>
      <div style="margin-bottom: var(--sp-2);">${roleBadge(role)}</div>
      <p class="text-tertiary" style="margin: 0; font-size: var(--fs-small);">${escapeHTML(targetUser.email || "No email")}</p>
    </div>

    <div class="card" style="background: rgba(255,255,255,0.02); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3);">
      ${targetUser.className ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Class & Section</span>
          <strong>Class ${escapeHTML(targetUser.className)}-${escapeHTML(targetUser.section || "—")}</strong>
        </div>
      ` : ""}
      ${targetUser.rollNumber ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Roll Number</span>
          <strong class="mono">${escapeHTML(targetUser.rollNumber)}</strong>
        </div>
      ` : ""}
      ${targetUser.favouriteGenre ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Favourite Genre</span>
          <span class="spine-tag">${escapeHTML(targetUser.favouriteGenre)}</span>
        </div>
      ` : ""}
      ${targetUser.subject ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
          <span class="text-tertiary">Subject</span>
          <strong>${escapeHTML(targetUser.subject)}</strong>
        </div>
      ` : ""}
      <div class="flex justify-between items-center" style="font-size: var(--fs-small);">
        <span class="text-tertiary">Last Online</span>
        <span>${lastOnlineText}</span>
      </div>
      ${targetUser.bio ? `
        <div style="font-size: var(--fs-small); border-top: 1px solid var(--glass-border); padding-top: var(--sp-2); margin-top: var(--sp-1);">
          <span class="text-tertiary" style="display:block; margin-bottom: 4px;">Bio</span>
          <p style="margin:0; font-style: italic;">"${escapeHTML(targetUser.bio)}"</p>
        </div>
      ` : ""}
      ${formattedDate ? `
        <div class="flex justify-between items-center" style="font-size: var(--fs-tiny); color: var(--text-tertiary); border-top: 1px solid var(--glass-border); padding-top: var(--sp-2); margin-top: var(--sp-1);">
          <span>Joined</span>
          <span>${formattedDate}</span>
        </div>
      ` : ""}
    </div>
  `;

  qs("#user-profile-modal").classList.add("open");
}

const searchInput = qs("#people-search");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = allUsers.filter((u) => {
      const nameMatch = (u.name || "").toLowerCase().includes(term);
      const emailMatch = (u.email || "").toLowerCase().includes(term);
      const classMatch = (u.className || "").toLowerCase().includes(term);
      const secMatch = (u.section || "").toLowerCase().includes(term);
      const genreMatch = (u.favouriteGenre || "").toLowerCase().includes(term);
      const roleMatch = (u.role || "").toLowerCase().includes(term);
      return nameMatch || emailMatch || classMatch || secMatch || genreMatch || roleMatch;
    });
    renderPeopleTable(filtered);
  });
}

qs("#close-user-profile-x")?.addEventListener("click", () => qs("#user-profile-modal").classList.remove("open"));
qs("#close-user-profile-btn")?.addEventListener("click", () => qs("#user-profile-modal").classList.remove("open"));
qs("#user-profile-modal")?.addEventListener("click", (e) => {
  if (e.target === qs("#user-profile-modal")) {
    qs("#user-profile-modal").classList.remove("open");
  }
});

async function init() {
  allUsers = await getAllUsers();
  renderPeopleTable(allUsers);
}

init();
