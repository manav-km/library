import { requireAuth } from "../firebase/auth.js";
import { getAllUsers, setUserRole } from "../firebase/firestore.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, showToast, qs, qsa } from "../utils/helpers.js";

const profile = await requireAuth(["admin"]);
renderNavbar(profile, "admin-panel.html");

let users = [];

function roleBadge(role) {
  return `<span class="badge badge-role-${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`;
}

function renderTable(list) {
  const tbody = qs("#users-table-body");
  if (!tbody) return;
  tbody.innerHTML = list.map((u) => `
    <tr data-uid="${u.uid || u.id}">
      <td>${escapeHTML(u.name)}</td>
      <td>${escapeHTML(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.className ? `${u.className}-${u.section}` : "—"}</td>
      <td>
        <button class="btn btn-ghost btn-sm view-profile-btn" data-uid="${u.uid || u.id}">View profile</button>
      </td>
    </tr>
  `).join("");

  qsa(".view-profile-btn").forEach((btn) => btn.addEventListener("click", () => {
    const uid = btn.dataset.uid;
    const targetUser = users.find((u) => u.uid === uid || u.id === uid);
    if (targetUser) {
      alert(`User Profile:\nName: ${targetUser.name}\nEmail: ${targetUser.email}\nRole: ${targetUser.role}\nClass: ${targetUser.className || "N/A"}-${targetUser.section || "N/A"}`);
    }
  }));
}

const userSearch = qs("#user-search");
if (userSearch) {
  userSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    renderTable(users.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)));
  });
}

async function init() {
  users = await getAllUsers();
  renderTable(users);
}

init();
