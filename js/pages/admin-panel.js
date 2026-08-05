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
        ${u.role === "admin" ? `<span class="text-tertiary" style="font-size:var(--fs-tiny);">Cannot modify</span>` : `
          <div class="flex gap-2">
            ${u.role === "student"
              ? `<button class="btn btn-primary btn-sm promote-btn">Make teacher</button>`
              : `<button class="btn btn-ghost btn-sm demote-btn">Revoke teacher</button>`}
          </div>
        `}
      </td>
    </tr>
  `).join("");

  qsa(".promote-btn").forEach((btn) => btn.addEventListener("click", () => changeRole(btn.closest("tr").dataset.uid, "teacher")));
  qsa(".demote-btn").forEach((btn) => btn.addEventListener("click", () => changeRole(btn.closest("tr").dataset.uid, "student")));
}

async function changeRole(uid, role) {
  await setUserRole(uid, role);
  showToast(role === "teacher" ? "Teacher access granted." : "Teacher access revoked.");
  users = users.map((u) => (u.uid === uid || u.id === uid ? { ...u, role } : u));
  renderTable(users);
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
