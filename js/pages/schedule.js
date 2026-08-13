// ==========================================================================
// Library Weekly Timetable Page (6 Days x 8 Periods)
// ==========================================================================

import { requireAuth } from "../firebase/auth.js";
import { renderNavbar } from "../components/navbar.js";
import { getSchedules, addSchedule, deleteSchedule, logAuditAction } from "../firebase/firestore.js";
import { escapeHTML, showToast, qs, qsa } from "../utils/helpers.js";

let profile = null;
let allSchedules = [];
let classFilter = "ALL";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5", "Period 6", "Period 7", "Period 8"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Helper: Calculate Monday of the week for a given date object
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(date.setDate(diff));
}

function formatDateISO(d) {
  return d.toISOString().split("T")[0];
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

function getDayFromDateStr(dateStr) {
  if (!dateStr) return "Monday";
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  if (!yyyy || !mm || !dd) return "Monday";
  const d = new Date(yyyy, mm - 1, dd);
  return DAYS_FULL[d.getDay()] || "Monday";
}

async function initSchedulePage() {
  profile = await requireAuth();
  renderNavbar(profile, "schedule.html");

  const addBtn = qs("#open-add-schedule-btn");
  if (addBtn && (profile.role === "teacher" || profile.role === "admin")) {
    addBtn.style.display = "inline-flex";
    addBtn.addEventListener("click", openAddModal);
  }

  setupEventListeners();
  await loadTimetableData();
}

async function loadTimetableData() {
  const activeTbody = qs("#active-timetable-body");
  if (activeTbody) {
    activeTbody.innerHTML = `<tr><td colspan="9" style="padding:30px; text-align:center; color:var(--text-tertiary);">Loading weekly timetable...</td></tr>`;
  }

  try {
    allSchedules = await getSchedules();
    renderActiveTimetable();
  } catch (err) {
    console.error(err);
    if (activeTbody) {
      activeTbody.innerHTML = `<tr><td colspan="9" style="padding:20px; text-align:center; color:var(--danger);">Failed to load timetable: ${err.message}</td></tr>`;
    }
  }
}

// Renders the Active Weekly Timetable (Current Week Monday – Saturday)
function renderActiveTimetable() {
  const tbody = qs("#active-timetable-body");
  const dateRangeEl = qs("#week-date-range");
  if (!tbody) return;

  const now = new Date();
  const currentMonday = getMonday(now);
  const currentSaturday = new Date(currentMonday);
  currentSaturday.setDate(currentMonday.getDate() + 5);

  const monStr = formatDateISO(currentMonday);
  const satStr = formatDateISO(currentSaturday);

  if (dateRangeEl) {
    dateRangeEl.innerHTML = `📅 <strong>Active Week:</strong> ${formatShortDate(monStr)} – ${formatShortDate(satStr)}`;
  }

  // Filter schedules that fall within the current week [monStr ... satStr]
  // Note: On Sunday of every week, currentMonday advances automatically to the new week, auto-clearing the table!
  const currentWeekSchedules = allSchedules.filter((s) => {
    return s.date >= monStr && s.date <= satStr;
  });

  tbody.innerHTML = buildTimetableRows(currentWeekSchedules);
  wireDeleteButtons(tbody);
}

// Builds 6 Rows (Days) x 8 Columns (Periods) HTML Table
function buildTimetableRows(scheduleList) {
  const isStaff = profile && (profile.role === "teacher" || profile.role === "admin");

  return DAYS.map((day) => {
    const periodCellsHTML = PERIODS.map((period) => {
      // Find matching items for this day & period
      let matches = scheduleList.filter((s) => {
        const sDay = (s.day || getDayFromDateStr(s.date)).trim();
        return sDay.toLowerCase() === day.toLowerCase() && (s.period || "").trim().toLowerCase() === period.toLowerCase();
      });

      if (classFilter !== "ALL") {
        matches = matches.filter((s) => String(s.className || "").trim() === String(classFilter).trim());
      }

      if (!matches.length) {
        return `<td><span class="text-tertiary" style="opacity: 0.3;">—</span></td>`;
      }

      const slotHTML = matches.map((s) => {
        const type = (s.type || s.status || "normal").toLowerCase();

        if (type === "holiday") {
          return `
            <div class="slot-box holiday ${isStaff ? 'clickable-slot' : ''}" data-id="${s.id}" style="${isStaff ? 'cursor:pointer;' : ''}">
              ${isStaff ? `<button class="btn btn-ghost btn-sm delete-slot-btn" data-id="${s.id}" style="color:var(--danger); position:absolute; top:2px; right:2px; padding:0 4px; font-size:10px;" title="Delete">✕</button>` : ''}
              <div style="font-weight:700; color:var(--danger); font-size:11px;">🏖️ Holiday</div>
              ${s.notes ? `<div style="font-size:9px; color:var(--text-tertiary); margin-top:2px;">${escapeHTML(s.notes)}</div>` : ''}
            </div>`;
        }

        if (type === "substitution") {
          return `
            <div class="slot-box substitution ${isStaff ? 'clickable-slot' : ''}" data-id="${s.id}" style="${isStaff ? 'cursor:pointer;' : ''}">
              ${isStaff ? `<button class="btn btn-ghost btn-sm delete-slot-btn" data-id="${s.id}" style="color:var(--danger); position:absolute; top:2px; right:2px; padding:0 4px; font-size:10px;" title="Delete">✕</button>` : ''}
              <div style="font-weight:700; color:var(--warning); font-size:11px;">🔄 Substitution</div>
              <strong style="font-size:11px; color:var(--text-primary); display:block; margin-top:2px;">Class ${escapeHTML(s.className || "")}${s.section ? "-" + escapeHTML(s.section) : ""}</strong>
              <div style="font-size:10px; color:var(--text-secondary);">${escapeHTML(s.teacher || "Sub Teacher")}</div>
              ${s.notes ? `<div style="font-size:9px; color:var(--text-tertiary); margin-top:2px;">${escapeHTML(s.notes)}</div>` : ''}
            </div>`;
        }

        // Regular period slot
        return `
          <div class="slot-box ${isStaff ? 'clickable-slot' : ''}" data-id="${s.id}" style="${isStaff ? 'cursor:pointer;' : ''}">
            ${isStaff ? `<button class="btn btn-ghost btn-sm delete-slot-btn" data-id="${s.id}" style="color:var(--danger); position:absolute; top:2px; right:2px; padding:0 4px; font-size:10px;" title="Delete">✕</button>` : ''}
            <strong style="font-size:11px; color:var(--text-primary); display:block;">Class ${escapeHTML(s.className || "")}${s.section ? "-" + escapeHTML(s.section) : ""}</strong>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:1px;">${escapeHTML(s.teacher || "Teacher")}</div>
            <div style="font-size:10px; color:var(--cyan-300); font-weight:600; margin-top:2px;">${escapeHTML(s.genre || "General")}</div>
            ${s.notes ? `<div style="font-size:9px; color:var(--text-tertiary); margin-top:2px; font-style:italic;">${escapeHTML(s.notes)}</div>` : ''}
          </div>`;
      }).join("");

      return `<td>${slotHTML}</td>`;
    }).join("");

    return `
      <tr>
        <td class="day-cell">${day}</td>
        ${periodCellsHTML}
      </tr>`;
  }).join("");
}

function wireDeleteButtons(containerEl) {
  qsa(".delete-slot-btn", containerEl).forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm("Delete this timetable slot?")) return;
      try {
        await deleteSchedule(id);
        await logAuditAction({
          action: "SCHEDULE_DELETE",
          category: "Schedule",
          details: `${profile.name} deleted a timetable slot.`,
          performedBy: profile,
          targetId: id
        });
        showToast("Slot deleted.", "info");
        await loadTimetableData();
      } catch (err) {
        showToast("Failed to delete slot: " + err.message, "error");
      }
    });
  });
}

// Opens Past Schedules Modal (Groups history by Week Start Date – Week End Date)
function openPastSchedulesModal() {
  const modal = qs("#past-schedules-modal");
  const container = qs("#past-planners-container");
  if (!modal || !container) return;

  const now = new Date();
  const currentMondayStr = formatDateISO(getMonday(now));

  // Past schedules: date < currentMondayStr
  const pastSchedules = allSchedules.filter((s) => (s.date || "") < currentMondayStr);

  if (!pastSchedules.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px 20px; color: var(--text-tertiary);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📜</div>
        <p>No previous weekly planners found in history.</p>
      </div>`;
    modal.classList.add("open");
    return;
  }

  // Group past schedules by Monday of their week
  const weekGroups = {};
  for (const s of pastSchedules) {
    if (!s.date) continue;
    const [yyyy, mm, dd] = s.date.split("-").map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    const mon = getMonday(d);
    const monKey = formatDateISO(mon);
    if (!weekGroups[monKey]) {
      const sat = new Date(mon);
      sat.setDate(mon.getDate() + 5);
      weekGroups[monKey] = {
        monday: monKey,
        saturday: formatDateISO(sat),
        items: []
      };
    }
    weekGroups[monKey].items.push(s);
  }

  // Sort weeks descending
  const sortedWeekKeys = Object.keys(weekGroups).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedWeekKeys.map((monKey) => {
    const group = weekGroups[monKey];
    const tableHTML = buildTimetableRows(group.items);

    return `
      <div class="past-planner-item">
        <h4 style="font-size: 1.1rem; color: var(--cyan-300); margin-bottom: 12px; font-family: var(--font-mono);">
          Week: ${formatShortDate(group.monday)} – ${formatShortDate(group.saturday)}
        </h4>
        <div class="timetable-wrap">
          <table class="timetable">
            <thead>
              <tr>
                <th style="width: 110px;">Day</th>
                <th>Period 1</th>
                <th>Period 2</th>
                <th>Period 3</th>
                <th>Period 4</th>
                <th>Period 5</th>
                <th>Period 6</th>
                <th>Period 7</th>
                <th>Period 8</th>
              </tr>
            </thead>
            <tbody>
              ${tableHTML}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  wireDeleteButtons(container);
  modal.classList.add("open");
}

function setupEventListeners() {
  const pastBtn = qs("#open-past-schedules-btn");
  pastBtn?.addEventListener("click", openPastSchedulesModal);

  const closePastBtn = qs("#close-past-modal");
  closePastBtn?.addEventListener("click", () => qs("#past-schedules-modal")?.classList.remove("open"));

  const filterSelect = qs("#filter-class");
  filterSelect?.addEventListener("change", (e) => {
    classFilter = e.target.value;
    renderActiveTimetable();
  });

  const modal = qs("#add-schedule-modal");
  const closeBtn = qs("#close-sched-modal");
  closeBtn?.addEventListener("click", () => modal.classList.remove("open"));
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

  // Date input auto-day detector & type toggles
  const dateInput = qs("#sched-date");
  const dayDisplay = qs("#auto-day-display");
  dateInput?.addEventListener("change", () => {
    if (dayDisplay && dateInput.value) {
      dayDisplay.textContent = `Day: ${getDayFromDateStr(dateInput.value)}`;
    }
  });

  const typeSelect = qs("#sched-type");
  const normalFields = qs("#normal-slot-fields");
  typeSelect?.addEventListener("change", () => {
    if (normalFields) {
      normalFields.style.display = typeSelect.value === "holiday" ? "none" : "block";
    }
  });

  const form = qs("#add-schedule-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = qs("#save-sched-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const dateVal = dateInput.value;
    const periodVal = qs("#sched-period").value;
    const typeVal = typeSelect.value;
    const classVal = qs("#sched-class").value.trim();
    const sectionVal = qs("#sched-section").value.trim();
    const teacherVal = qs("#sched-teacher").value.trim();
    const genreVal = qs("#sched-genre").value;
    const notesVal = qs("#sched-notes").value.trim();

    const payload = {
      date: dateVal,
      day: getDayFromDateStr(dateVal),
      period: periodVal,
      type: typeVal,
      className: typeVal === "holiday" ? "" : classVal,
      section: typeVal === "holiday" ? "" : sectionVal,
      teacher: typeVal === "holiday" ? "" : teacherVal,
      genre: typeVal === "holiday" ? "" : genreVal,
      notes: notesVal
    };

    try {
      if (editingScheduleId) {
        await updateSchedule(editingScheduleId, payload);
        await logAuditAction({
          action: "SCHEDULE_EDIT",
          category: "Schedule",
          details: `${profile.name} updated timetable slot (${typeVal}) for ${dateVal} (${periodVal}).`,
          performedBy: profile,
          targetId: editingScheduleId
        });
        showToast("Timetable slot updated!", "success");
      } else {
        await addSchedule(payload);
        await logAuditAction({
          action: "SCHEDULE_ADD",
          category: "Schedule",
          details: `${profile.name} added timetable slot (${typeVal}) for ${dateVal} (${periodVal}).`,
          performedBy: profile
        });
        showToast("Timetable slot saved!", "success");
      }

      form.reset();
      editingScheduleId = null;
      modal.classList.remove("open");
      await loadTimetableData();
    } catch (err) {
      showToast("Failed to save slot: " + err.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Timetable Slot";
    }
  });
}

function openAddModal(existingSlot = null) {
  const modal = qs("#add-schedule-modal");
  const form = qs("#add-schedule-form");
  const dateInput = qs("#sched-date");
  const dayDisplay = qs("#auto-day-display");
  const typeSelect = qs("#sched-type");
  const normalFields = qs("#normal-slot-fields");

  if (!modal || !form) return;

  form.reset();

  if (existingSlot) {
    editingScheduleId = existingSlot.id;
    qs("#sched-date").value = existingSlot.date || "";
    qs("#sched-period").value = existingSlot.period || "Period 1";
    typeSelect.value = existingSlot.type || existingSlot.status || "normal";
    qs("#sched-class").value = existingSlot.className || "";
    qs("#sched-section").value = existingSlot.section || "";
    qs("#sched-teacher").value = existingSlot.teacher || "";
    qs("#sched-genre").value = existingSlot.genre || "General Reading";
    qs("#sched-notes").value = existingSlot.notes || "";
    if (dayDisplay && existingSlot.date) dayDisplay.textContent = `Day: ${getDayFromDateStr(existingSlot.date)}`;
  } else {
    editingScheduleId = null;
    if (dateInput) {
      dateInput.value = new Date().toISOString().split("T")[0];
      if (dayDisplay) dayDisplay.textContent = `Day: ${getDayFromDateStr(dateInput.value)}`;
    }
  }

  if (normalFields && typeSelect) {
    normalFields.style.display = typeSelect.value === "holiday" ? "none" : "block";
  }

  modal.classList.add("open");
}

document.addEventListener("DOMContentLoaded", initSchedulePage);
