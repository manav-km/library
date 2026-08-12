import { signUp, logIn, signInWithGoogle, watchAuthState, completeGoogleSignUp } from "../firebase/auth.js";
import { showToast, qs, qsa, initGenreChipPicker } from "../utils/helpers.js";

const TEACHER_EMAIL_SUFFIX = "_lko@jaipuria.edu.in";
const DEPARTMENTS = [
  "English", "Hindi", "Maths", "Social Science",
  "Science", "Computer / IT", "Sports", "Extra Curriculars"
];

function isTeacherEmail(email) {
  return (email || "").toLowerCase().trim().endsWith(TEACHER_EMAIL_SUFFIX);
}

function redirectByRole(profile) {
  window.location.href = "student-dashboard.html";
}

// ---- Tab switching & form elements ----
const tabs = qsa(".auth-tab");
const loginForm = qs("#login-form");
const signupForm = qs("#signup-form");
const accountTypeToggle = qs("#account-type-toggle");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.style.display = isLogin ? "block" : "none";
    signupForm.style.display = isLogin ? "none" : "block";
    accountTypeToggle.style.display = isLogin ? "none" : "flex";
    accountTypeToggle.style.justifyContent = "center";
  });
});

// ---- Student / Teacher toggle ----
let isTeacherMode = false;

const toggleStudentBtn = qs("#toggle-student");
const toggleTeacherBtn = qs("#toggle-teacher");
const studentOnlyFields = qs(".student-only-fields");
const teacherOnlyFields = qs(".teacher-only-fields");
const studentHint = qs(".student-hint");
const signupEmailInput = qs("#signup-email");
const signupClassSelect = qs("#signup-class");
const signupSectionSelect = qs("#signup-section");
const signupRollInput = qs("#signup-roll");
const signupSubmitBtn = qs("#signup-submit-btn");

function setStudentMode() {
  isTeacherMode = false;
  toggleStudentBtn.classList.add("active");
  toggleTeacherBtn.classList.remove("active");

  studentOnlyFields.style.display = "block";
  teacherOnlyFields.style.display = "none";
  studentHint.style.display = "block";
  signupSubmitBtn.textContent = "Create account with Email";

  // Re-enable required on student fields
  signupClassSelect.required = true;
  signupSectionSelect.required = true;
  signupRollInput.required = true;

  signupEmailInput.placeholder = "you@example.com";
}

function setTeacherMode() {
  isTeacherMode = true;
  toggleTeacherBtn.classList.add("active");
  toggleStudentBtn.classList.remove("active");

  studentOnlyFields.style.display = "none";
  teacherOnlyFields.style.display = "block";
  studentHint.style.display = "none";
  signupSubmitBtn.textContent = "Create teacher account";

  // Remove required from student-only fields
  signupClassSelect.required = false;
  signupSectionSelect.required = false;
  signupRollInput.required = false;

  signupEmailInput.placeholder = "you@example.com";
}

toggleStudentBtn.addEventListener("click", setStudentMode);
toggleTeacherBtn.addEventListener("click", setTeacherMode);

// ---- Initialize genre chip pickers ----
const signupGenrePicker = initGenreChipPicker(qs("#signup-genre-picker"));
const gsGenrePicker = initGenreChipPicker(qs("#gs-genre-picker"));

// ---- Favourite Subject multi-select picker (1-3 subjects) ----
const SUBJECTS = [
  "Technology", "Social Science", "Science", "Sanskrit",
  "English", "Hindi", "Maths", "Life Skills", "Art", "Library"
];

function initSubjectChipPicker(container) {
  if (!container) return { getSelected: () => [] };
  let selected = [];
  function render() {
    container.innerHTML = "";
    SUBJECTS.forEach((sub) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "genre-chip" + (selected.includes(sub) ? " selected" : "");
      chip.textContent = sub;
      chip.addEventListener("click", () => {
        if (selected.includes(sub)) {
          selected = selected.filter(s => s !== sub);
        } else {
          if (selected.length >= 3) {
            showToast("You can select up to 3 subjects.", "error");
            return;
          }
          selected.push(sub);
        }
        render();
      });
      container.appendChild(chip);
    });
  }
  render();
  return { getSelected: () => selected };
}

const signupSubjectPicker = initSubjectChipPicker(qs("#signup-subject-picker"));
const gsSubjectPicker = initSubjectChipPicker(qs("#gs-subject-picker"));

// ---- Department single-select chip picker ----
let selectedDept = "";
function initDeptPicker(container) {
  if (!container) return;
  container.innerHTML = "";
  DEPARTMENTS.forEach((dept) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "genre-chip" + (selectedDept === dept ? " selected" : "");
    chip.textContent = dept;
    chip.addEventListener("click", () => {
      // Single-select: deselect previous
      selectedDept = selectedDept === dept ? "" : dept;
      initDeptPicker(container); // re-render
    });
    container.appendChild(chip);
  });
}
initDeptPicker(qs("#signup-dept-picker"));

// ---- Redirect already signed-in users ----
watchAuthState((profile) => {
  if (profile) redirectByRole(profile);
});

function formatAuthError(err) {
  const code = err.code || "";
  if (code.includes("operation-not-allowed") || code.includes("admin-restricted-operation") || err.message?.includes("ADMIN_ONLY_OPERATION")) {
    return "Sign-in provider is disabled. Enable Email/Password and Google in Firebase Console -> Authentication -> Sign-in method.";
  }
  if (code.includes("invalid-api-key")) {
    return "Invalid API key or restricted key in Google Cloud Console. Check Firebase Console project settings.";
  }
  return err.message || "Authentication failed. Check your details.";
}

// ---- Google Sign-in handler ----
qsa(".google-signin-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      const result = await signInWithGoogle();
      if (result.isNewUser) {
        qs("#google-signup-modal").classList.add("open");
        qs("#gs-name").value = result.user.displayName || "";
      } else {
        const profile = result;
        showToast(`Signed in with Google — welcome back, ${profile.name.split(" ")[0]}.`);
        setTimeout(() => redirectByRole(profile), 500);
      }
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
});

// ---- Login form ----
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = qs("#login-email").value;
    const password = qs("#login-password").value;
    try {
      const profile = await logIn(email, password);
      showToast(`Welcome back, ${profile.name.split(" ")[0]}.`);
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}

// ---- Signup form ----
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = qs("#signup-email").value.trim();

    // Teacher mode: validate official email
    if (isTeacherMode) {
      if (!isTeacherEmail(email)) {
        showToast(`Only official Jaipuria teacher emails (ending in ${TEACHER_EMAIL_SUFFIX}) can register as a teacher.`, "error");
        setStudentMode();
        return;
      }
      if (!selectedDept) {
        showToast("Please select your department.", "error");
        return;
      }
    }

    const subjects = isTeacherMode ? [] : signupSubjectPicker.getSelected();
    if (!isTeacherMode && (!subjects || subjects.length === 0)) {
      showToast("Please select at least 1 Favourite Subject.", "error");
      return;
    }

    const payload = {
      name: qs("#signup-name").value,
      username: qs("#signup-username").value,
      className: isTeacherMode ? "" : qs("#signup-class").value,
      section: isTeacherMode ? "" : qs("#signup-section").value,
      rollNumber: isTeacherMode ? "" : qs("#signup-roll").value,
      classTeacher: isTeacherMode ? "" : (qs("#signup-class-teacher")?.value || ""),
      subject: isTeacherMode ? selectedDept : "",
      favouriteGenre: signupGenrePicker.getSelected(),
      favouriteSubjects: subjects,
      email,
      password: qs("#signup-password").value,
      // Pass teacher flag so auth.js can assign role
      _isTeacherSignup: isTeacherMode
    };

    try {
      const profile = await signUp(payload);
      showToast(isTeacherMode ? "Teacher account created — welcome!" : "Account created — welcome to the library.");
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}

// ---- Google Signup Modal ----
const googleSignupForm = qs("#google-signup-form");
if (googleSignupForm) {
  googleSignupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = qs("#gs-password").value;
    const confirm = qs("#gs-password-confirm").value;

    if (password !== confirm) {
      showToast("Passwords do not match.", "error");
      return;
    }

    const subjects = gsSubjectPicker.getSelected();
    if (!subjects || subjects.length === 0) {
      showToast("Please select at least 1 Favourite Subject.", "error");
      return;
    }

    const payload = {
      name: qs("#gs-name").value,
      username: qs("#gs-username").value,
      className: qs("#gs-class").value,
      section: qs("#gs-section").value,
      rollNumber: qs("#gs-roll").value,
      favouriteGenre: gsGenrePicker.getSelected(),
      favouriteSubjects: subjects,
      password: password
    };

    try {
      const profile = await completeGoogleSignUp(payload);
      qs("#google-signup-modal").classList.remove("open");
      showToast("Account created — welcome to the library.");
      setTimeout(() => redirectByRole(profile), 500);
    } catch (err) {
      console.error(err);
      showToast(formatAuthError(err), "error");
    }
  });
}
