import { requireAuth } from "../firebase/auth.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, qs, qsa, ALL_GENRES } from "../utils/helpers.js";
import {
  getScheduleForCurrentWeek,
  addSchedulePeriod,
  deleteSchedulePeriod,
  getMondayDateString,
  logAuditAction
} from "../firebase/firestore.js";

const profile = await requireAuth();
renderNavbar(profile, "schedule.html");

const canEdit = profile.role === "teacher" || profile.role === "admin";
const addBtn = qs("#open-schedule-modal-btn");
if (canEdit && addBtn) {
  addBtn.classList.remove("hidden");
}

const modal = qs("#schedule-modal");
const form = qs("#schedule-form");

// Populate Genre dropdown in form
const genreSelect = qs("#p-genre");
if (genreSelect) {
  genreSelect.innerHTML = ALL_GENRES.map((g) => `<option value="${escapeHTML(g)}">${escapeHTML(g)}</option>`).join("");
}

// Set default date in form to today
const dateInput = qs("#p-date");
if (dateInput) {
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [
  "1st Period", "2nd Period", "3rd Period", "4th Period",
  "5th Period", "6th Period", "7th Period", "8th Period"
];

let currentSchedules = [];

async function loadAndRenderSchedule() {
  const tbody = qs("#schedule-tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align:center; padding:var(--sp-6);">
        <div class="skeleton" style="height:40px; margin-bottom:8px;"></div>
        <div class="skeleton" style="height:40px; margin-bottom:8px;"></div>
        <div class="skeleton" style="height:40px;"></div>
      </td>
    </tr>
  `;

  currentSchedules = await getScheduleForCurrentWeek();

  // Display week range text
  const mondayStr = getMondayDateString();
  const weekRangeEl = qs("#schedule-week-range");
  if (weekRangeEl) {
    weekRangeEl.textContent = `Current Week (Starts Mon, ${mondayStr}). Table automatically resets every Monday.`;
  }

  tbody.innerHTML = DAYS.map((day) => `
    <tr>
      <td>
        <div class="day-header-cell">${escapeHTML(day)}</div>
      </td>
      ${PERIODS.map((period) => {
        const item = currentSchedules.find((s) => s.day === day && s.period === period);
        if (item) {
          return `
            <td>
              <div class="period-card">
                <div>
                  <div class="flex items-center justify-between gap-1">
                    <span class="period-badge">${escapeHTML(item.gradeSection || item.grade || '')}</span>
                    ${canEdit ? `
                      <button class="delete-period-btn" data-id="${item.id}" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:0.75rem;" title="Delete Period">&times;</button>
                    ` : ''}
                  </div>
                  <div class="period-teacher">👤 ${escapeHTML(item.teacherName || '')}</div>
                  <div class="period-genre">📚 ${escapeHTML(item.shelfGenre || '')}</div>
                </div>
                ${item.activity ? `<div class="period-activity">📝 ${escapeHTML(item.activity)}</div>` : ''}
              </div>
            </td>
          `;
        }
        return `
          <td>
            <div class="schedule-cell-empty ${canEdit ? 'can-add' : ''}" data-day="${day}" data-period="${period}">
              ${canEdit ? '+ Add' : '—'}
            </div>
          </td>
        `;
      }).join("")}
    </tr>
  `).join("");

  // Attach cell click handlers for quick add
  if (canEdit) {
    qsa(".schedule-cell-empty.can-add", tbody).forEach((cell) => {
      cell.addEventListener("click", () => {
        const d = cell.dataset.day;
        const p = cell.dataset.period;
        openModalWith(d, p);
      });
    });

    qsa(".delete-period-btn", tbody).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm("Are you sure you want to delete this scheduled library period?")) {
          await deleteSchedulePeriod(id);
          await loadAndRenderSchedule();
        }
      });
    });
  }
}

function openModalWith(day = "Monday", period = "1st Period") {
  if (!modal) return;
  const daySelect = qs("#p-day");
  const periodSelect = qs("#p-period");
  if (daySelect) daySelect.value = day;
  if (periodSelect) periodSelect.value = period;
  modal.classList.remove("hidden");
}

function closeModal() {
  if (modal) modal.classList.add("hidden");
}

if (canEdit) {
  if (addBtn) {
    addBtn.addEventListener("click", () => openModalWith());
  }

  qsa(".close-modal", modal).forEach((b) => b.addEventListener("click", closeModal));

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const dateVal = qs("#p-date").value;
      const dayVal = qs("#p-day").value;
      const periodVal = qs("#p-period").value;
      const gradeVal = qs("#p-grade").value;
      const sectionVal = qs("#p-section").value;
      const teacherVal = qs("#p-teacher").value.trim();
      const genreVal = qs("#p-genre").value;
      const activityVal = qs("#p-activity").value.trim();

      const periodData = {
        date: dateVal,
        day: dayVal,
        period: periodVal,
        gradeSection: `${gradeVal}-${sectionVal}`,
        teacherName: teacherVal,
        shelfGenre: genreVal,
        activity: activityVal,
        createdById: profile.uid
      };

      try {
        await addSchedulePeriod(periodData);
        await logAuditAction({
          action: "ADD_SCHEDULE_PERIOD",
          category: "Schedule",
          details: `Scheduled ${periodData.gradeSection} for ${periodVal} on ${dayVal} with ${teacherVal}`,
          performedBy: profile
        });

        closeModal();
        form.reset();
        if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

        await loadAndRenderSchedule();
      } catch (err) {
        alert("Failed to save schedule period: " + err.message);
      }
    });
  }
}

// Initial load
loadAndRenderSchedule();
