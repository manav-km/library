# Technical Elaboration & Reference — SAJS Digital Library

This document provides a comprehensive technical breakdown of how **HTML5**, **CSS3**, and **JavaScript (ES6+)** tags, properties, functions, and architecture are used across the SAJS Digital Library web application.

---

## Table of Contents
1. [HTML5: Structure & Semantics](#1-html5-structure--semantics)
2. [CSS3: Styling, Tokens & Layout Systems](#2-css3-styling-tokens--layout-systems)
3. [JavaScript (ES6+): Logic, State & Firebase Architecture](#3-javascript-es6-logic-state--firebase-architecture)
4. [File Mapping & Feature Matrix](#4-file-mapping--feature-matrix)

---

## 1. HTML5: Structure & Semantics

HTML5 forms the structural foundation of the SAJS Digital Library, emphasizing semantic clarity, accessibility, and dynamic data binding.

### Key HTML5 Tags & Usage

| HTML Tag / Attribute | Usage in Project | File Locations |
| :--- | :--- | :--- |
| `<main class="app-main">` | Primary page container enforcing consistent top padding under the fixed navbar. | All HTML pages (`index.html`, `library.html`, etc.) |
| `<section>` | Groups distinct content areas such as Hero, Quick Actions, Catalogue Grid, and Audit Logs. | `index.html`, `library.html`, `manage.html` |
| `<form>` | Handles authentication, book uploads/edits, review submissions, and profile updates. | `login.html`, `library.html`, `student-dashboard.html` |
| `<input>` & `<textarea>` | Accepts text, numbers, file uploads (`accept="image/*"`), and multiline book summaries. | Forms across all pages |
| `<select>` & `<option>` | Dropdowns for selecting genres, user roles, class sections, and subjects. | `login.html`, `manage.html`, `student-dashboard.html` |
| `<table>`, `<thead>`, `<tbody>` | Data tables displaying book catalogues, user directories, and audit logs. | `manage.html` |
| `data-*` attributes | Custom data attributes (`data-tab`, `data-bkid`, `data-genre`, `data-uid`) for JS event delegation. | `navbar.js`, `bookCard.js`, `manage.html`, `discussions.html` |
| `aria-*` attributes | Accessibility attributes (`aria-hidden="true"`, `aria-haspopup="true"`, `aria-expanded="false"`). | `index.html`, `navbar.js` |

### Key Code Example: Dynamic Data Binding & Tabs in HTML
```html
<!-- Tab Bar with data-tab attributes -->
<div class="tabs" id="manage-tabs">
  <div class="tab active" data-tab="catalogue">Catalogue</div>
  <div class="tab" data-tab="reviews">Review moderation</div>
  <div class="tab" data-tab="students">Student management</div>
  <div class="tab" data-tab="audit">Audit logs</div>
  <div class="tab" data-tab="users" id="tab-users-nav" style="display:none;">User management</div>
</div>
```

---

## 2. CSS3: Styling, Tokens & Layout Systems

The CSS architecture relies on **Vanilla CSS3** using modern custom properties (CSS variables), Flexbox, CSS Grid, glassmorphism visual effects, and fluid typography.

### Core CSS Concepts & Properties

#### A. CSS Custom Properties / Design Tokens (`css/variables.css`)
Centralized design variables enable consistent dark-mode styling and signature genre colors.
```css
:root {
  --bg-base:        #080B14;   /* Base dark background */
  --bg-elevated:    #0D1220;   /* Lifted card background */
  --glass-fill:     rgba(23, 31, 51, 0.55);
  --glass-border:   rgba(120, 154, 255, 0.14);
  --indigo-500:     #5B6EF5;
  --cyan-400:       #22D3EE;

  /* Signature Genre Spine Color Tokens */
  --spine-fiction:  #7C8CF8;
  --spine-scifi:    #A78BFA;
  --spine-fantasy:  #C084FC;
  --spine-history:  #FBBF24;

  /* Typography Scale */
  --font-display:   'Space Grotesk', sans-serif;
  --font-body:      'Inter', sans-serif;
  --font-mono:      'JetBrains Mono', monospace;
}
```

#### B. Glassmorphism & Vertical Spine Typography (`css/pages.css`)
```css
/* Glassmorphic Container */
.hero-shelf {
  position: relative;
  height: 340px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: var(--glass-fill);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(16px);
  border-radius: var(--radius-lg);
}

/* Vertical Spine Text & Keyframe Animation */
.hero-shelf .spine {
  flex: 1;
  background: var(--spine-color, var(--indigo-500));
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: var(--font-display);
  font-weight: 600;
  text-transform: uppercase;
  color: rgba(8, 11, 20, 0.9);
  animation: spine-rise var(--dur-slow) var(--ease-standard) both;
  transition: transform var(--dur-base) ease, filter var(--dur-base) ease;
}

.hero-shelf .spine:hover {
  transform: translateY(-8px);
  filter: brightness(1.15);
}

@keyframes spine-rise {
  from { transform: translateY(24px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
```

#### C. Responsive Layouts: Flexbox & CSS Grid
- **CSS Grid** (`css/pages.css`): `.books-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--sp-5); }`
- **Flexbox** (`css/layout.css`): `.navbar-inner { display: flex; align-items: center; justify-content: space-between; }`

---

## 3. JavaScript (ES6+): Logic, State & Firebase Architecture

JavaScript manages page authentication, Firestore database CRUD, Realtime Database chat threads, modal dialogs, and Audit Logging.

### Modern JavaScript Features Used

| ES6+ Feature | Purpose in Project | Code Snippet Example |
| :--- | :--- | :--- |
| **ES Modules** | Modular code imports across components & pages. | `import { getAllBooks } from "../firebase/firestore.js";` |
| **Async / Await** | Asynchronous operations for Firebase & APIs. | `const books = await getAllBooks();` |
| **Spread Operator `...`** | Set deduplication & object merging. | `[...new Set([...ALL_GENRES, ...bookGenres])];` |
| **Array Methods** | Filtering, mapping, and searching data. | `books.filter(b => b.genre === activeGenre).map(b => ...)` |
| **Template Literals** | Dynamic HTML generation. | `` `<div class="card">${escapeHTML(b.bookName)}</div>` `` |
| **Destructuring** | Extracting payload values cleanly. | `const { name, email, role } = profile;` |

### Key Project Modules & Functions

#### A. Centralized Audit Logging (`js/firebase/firestore.js`)
Captures platform events into the `audit_logs` Firestore collection.
```javascript
export async function logAuditAction({ action, category, details, performedBy, targetId = "" }) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      action: action || "ACTION",
      category: category || "General",
      details: details || "",
      performedBy: {
        uid: performedBy?.uid || "system",
        name: performedBy?.name || "System User",
        role: performedBy?.role || "student",
        email: performedBy?.email || ""
      },
      targetId: targetId || "",
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn("Failed to log audit action:", err);
  }
}
```

#### B. Authentication & Role-Based Guard (`js/firebase/auth.js`)
Enforces role-based permissions (`student`, `teacher`, `admin`).
```javascript
export function requireAuth(requiredRoles = []) {
  return new Promise((resolve) => {
    watchAuthState((profile) => {
      if (!profile) {
        window.location.href = "login.html";
        return;
      }
      if (requiredRoles.length && !requiredRoles.includes(profile.role)) {
        window.location.href = "student-dashboard.html";
        return;
      }
      resolve(profile);
    });
  });
}
```

#### C. Shared Utilities (`js/utils/helpers.js`)
Utility functions for toasts, HTML escaping, star strings, and relative timestamps.
```javascript
export function escapeHTML(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
```

---

## 4. File Mapping & Feature Matrix

| File Path | Primary Responsibilities | Key Technologies |
| :--- | :--- | :--- |
| `index.html` / `js/pages/index.js` | Home hero, featured books, quick links, genre shelf animation. | HTML5, CSS Grid, ES Modules |
| `library.html` / `js/pages/library.js` | Full catalogue, 16 genre filter chips, upload book (teachers/admins). | Async JS, Firestore query |
| `manage.html` / `js/pages/manage.js` | Management portal: Catalogue, Reviews, Student Directory, **Audit Logs**, Admin Roles. | Tab switching, Firestore CRUD, Audit logs |
| `discussions.html` / `js/pages/discussions.js` | Real-time community discussion threads & genre filters. | Firebase Realtime Database (`onValue`) |
| `student-dashboard.html` / `js/pages/student-dashboard.js` | User dashboard & profile editing (all fields except UID). | Profile state, Firebase Storage upload |
| `book-details.html` / `js/pages/book-details.js` | Book metadata, empty field hiding, leave review, edit/delete book. | DOM manipulation, Firestore reviews |
| `js/components/reviewModal.js` | Global Leave Review modal overlay (1–5 stars + structured feedback). | Event delegation, Audit logging |
| `js/components/navbar.js` | Navigation header & profile dropdown (Dashboard, My Profile, Manage, Sign out). | Responsive navbar, Auth state listener |
