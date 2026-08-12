# SAJS Library Site — Full System & Code Documentation

Welcome to the definitive system and code documentation for the **Seth Anandram Jaipuria School (SAJS) Library Site**. This document is designed to serve as an exhaustive reference manual for developers, system administrators, and school educators. It provides a complete, line-of-sight description of the platform's architecture, database models, lifecycle operations, security rules, and user interfaces.

---

## 1. Introduction

The **SAJS Digital Library** is an interactive web portal created for the Seth Anandram Jaipuria School community. Rather than operating as a simple read-only catalog, the platform integrates literary exploration with social learning. It serves three main user roles:

1.  **Students:** Discover physical library books, read digital previews (PDFs), submit structured reviews detailing educational takeaways, and engage in live, real-time discussions with class peers.
2.  **Teachers:** Add, update, and manage catalog books, review and delete user comments to ensure academic safety, publish official school announcements, and track student reading lists.
3.  **Administrators:** Execute full-tier governance including user role elevation (promoting students to teachers), system-wide audit monitoring, and database management.

```
+---------------------------------------------------------------------------------+
|                                 SAJS Web Client                                 |
+---------------------------------------------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         | (Auth state)               | (Reads/Writes)             | (Live Chat Logs)
         v                            v                            v
+------------------+         +------------------+         +------------------+
|  Firebase Auth   |         | Cloud Firestore  |         | Firebase RTDB    |
|  - Email/Pass    |         | - Catalog Doc    |         | - Book Chats     |
|  - Google OAuth  |         | - User Profiles  |         | - Custom Threads |
+------------------+         | - Audit Logs     |         +------------------+
                             +------------------+
```

---

## 2. Codebase Directory Layout

Below is the directory structure layout of the site's systems, demonstrating where styling, components, page controllers, and service layers are located.

```text
SAJS Library/
├── assets/                          # Static media assets (logos, images)
│   ├── image.jpeg                   # School brand logo
│   └── images.jpg                   # Alternative banner asset
├── css/                             # Styling layout layers
│   ├── base.css                     # Reset, core HTML definitions, typography base
│   ├── components.css               # Shared UI elements (badges, buttons, modals, dropdowns)
│   ├── layout.css                   # Grid/Flex grids, standard page layout containers
│   ├── pages.css                    # Visual layouts dedicated to specific HTML templates
│   └── variables.css                # Color tokens, fonts, spacings, and design constants
├── data/                            # Administrative data seeding utilities
│   ├── sample-books.json            # Template file for catalog backups
│   └── upload_books.py              # Script to upload JSON bulk catalogs to Firestore
├── firebase/                        # Firebase Security configurations
│   ├── database.rules.json          # Realtime Database rules (WebSocket permissions)
│   └── firestore.rules              # Cloud Firestore read/write roles and schemas
├── js/                              # Javascript codebase (Vanilla ES6 Modules)
│   ├── components/                  # Custom UI builders injected into web pages
│   │   ├── bookCard.js              # Spine calculations and HTML layouts for book grids
│   │   ├── navbar.js                # Top and side navigation panels, auth menu events
│   │   └── reviewModal.js           # Lazy-injected review dialog system
│   ├── firebase/                    # Firebase SDK service wrappers
│   │   ├── auth.js                  # Authentication operations and page route guards
│   │   ├── firebase-config.js       # Core Firebase Credentials configuration file
│   │   ├── firestore.js             # Firestore NoSQL reading/writing API layer
│   │   ├── realtime.js              # Realtime discussions forum connection helpers
│   │   └── storage.js               # Cloud storage profile/file upload services
│   ├── pages/                       # Scripts corresponding to individual HTML pages
│   │   ├── admin-panel.js           # Administrators view for all system users
│   │   ├── book-details.js          # Book specs, accordion items, and reviews
│   │   ├── discover.js              # Student directories for classmates/teachers
│   │   ├── discussions.js           # Low-latency chatrooms for book discussions
│   │   ├── index.js                 # Landing page sliders and announcements
│   │   ├── library.js               # Multi-genre filter catalog and search panels
│   │   ├── login.js                 # Student/teacher tabbed forms and OAuth signup flow
│   │   ├── manage.js                # Tabbed master admin & teacher settings console
│   │   ├── student-dashboard.js     # User statistics, reading history, and profiles edit
│   │   └── teacher-dashboard.js     # Teacher-level catalog and reviews mod tools
│   └── utils/                       # Shared utility logic
│       ├── filter.js                # Regex-based profanity validation & scrubbing
│       └── helpers.js               # Toast feeds, date formatters, and query wrappers
├── about.html                       # General library details page
├── admin-panel.html                 # Simple user verification dashboard for administrators
├── book-details.html                # Multi-tab book preview sheet and reviews feed
├── discover.html                    # Directory dashboard to search students & staff
├── guidelines.html                  # Library guidelines, policies, and terms of service
├── index.html                       # Main community landing board
├── library.html                     # Catalog filter browser
├── login.html                       # Multi-form authentication gateway
├── manage.html                      # System settings control panel
├── student-dashboard.html           # Personal profiles, ratings, and account settings
└── teacher-dashboard.html           # Teacher operations dashboard
```

---

## 3. Technical Stack & Infrastructure Architecture

The platform runs entirely as a serverless static web application (Jamstack) powered by standard web technologies on the frontend and Google Firebase on the backend.

### 3.1 Frontend Development Layer
*   **HTML5 Standard:** Uses modern semantic elements (`<main>`, `<section>`, `<aside>`, `<nav>`, `<header>`) ensuring optimized accessibility, structure, and browser rendering.
*   **CSS3 Styling Engine:** Built entirely around modular, component-driven CSS files located under the `css/` directory. No bloated external utility frameworks (such as Tailwind) are used. Instead, a custom variable-based design token sheet (`variables.css`) coordinates the theme:
    *   **Colors:** Deep Indigo and Cyan brand palettes (`#4f46e5`, `#22d3ee`) styled with translucent glassmorphic card borders (`var(--glass-fill)`, `var(--glass-border)`).
    *   **Typography:** The structural font family uses **Space Grotesk** for headings and callouts, **Inter** for readable body text, and **JetBrains Mono** for alphanumeric identifiers (e.g. Call Numbers).
    *   **Responsiveness:** Fluid layouts built with Flexbox and CSS Grid, resizing smoothly across mobile screens, tablets, and desktop displays.
*   **Vanilla ES6 JavaScript Modules:** Uses native JavaScript import/export declarations (`type="module"`), avoiding compilation steps or node bundling overhead.

### 3.2 Backend Serverless Services (Firebase SDK v10.12.2)
*   **Firebase Authentication:** Implements client-side authentication token generation. It handles standard Email/Password credentials as well as single-sign-on (SSO) Google Popup flows.
*   **Cloud Firestore:** A document-oriented NoSQL database. Stores persistent documents (e.g., catalog details, student records, and audits).
*   **Firebase Realtime Database (RTDB):** A high-speed WebSocket database. Used to maintain low-latency, real-time message streams for open book discussions and custom user forums.
*   **Firebase Storage:** A cloud file-storage service. Used to host and serve uploaded media files, including cover images, book PDFs, and user avatars.

---

## 4. Exhaustive Database Schema & Data Models

### 4.1 Cloud Firestore Collections

#### 4.1.1 Collection: `users`
*   **Document ID:** Keyed by the Firebase Authentication Unique User Identifier (`uid`).
*   **Structure:**
    *   `uid` (string, required): The authenticated Firebase UID.
    *   `name` (string, required): Full display name of the user.
    *   `username` (string, required): Unique handles (e.g., `ananya_s`).
    *   `email` (string, required): The registered email address.
    *   `role` (string, required): Determines system access level. Can be `"student"`, `"teacher"`, or `"admin"`.
    *   `className` (string, student-only): Academic grade level, formatted in Roman Numerals (e.g., `"IX"`, `"XII"`).
    *   `section` (string, student-only): Class section identifier, ranging from `"A"` to `"G"`.
    *   `rollNumber` (string, student-only): The student's class roll ID.
    *   `classTeacher` (string, student-only): The student's assigned classroom tutor (e.g., `"Mrs. Priya Sharma"`).
    *   `subject` (string, teacher-only): The department the teacher is assigned to (e.g. `"Computer / IT"`, `"Social Science"`).
    *   `favouriteGenre` (array of strings, optional): List of chosen genres (e.g., `["Dystopian", "Fantasy"]`).
    *   `favouriteSubjects` (array of strings, student-only): Up to 3 selected academic subjects.
    *   `bio` (string, optional): Personal reading profile statement.
    *   `profilePicture` (string, optional): Storage-hosted URL to the profile picture.
    *   `createdAt` (number, required): Epoch timestamp of profile creation.
    *   `lastOnline` (number, required): Epoch timestamp of last active session.

#### 4.1.2 Collection: `books`
*   **Document ID:** Random Firestore-generated hash.
*   **Structure:**
    *   `BK_ID` (string, required): Permanent catalog ID, matching pattern `^SAJS-[0-9]{3,}$` (e.g. `"SAJS-005"`).
    *   `bookName` (string, required): Title of the book.
    *   `author` (string, required): Name of the writer.
    *   `year` (number, required): Year of publication.
    *   `genre` (string, required): Primary genre tag.
    *   `coverImage` (string, optional): Firebase Storage image URL.
    *   `pdfUrl` (string, optional): Firebase Storage link to the book's PDF document.
    *   `mainIdea` (string, optional): The core message of the book.
    *   `themes` (array of strings, optional): Prominent thematic keywords.
    *   `characters` (array of maps, optional): A list of characters:
        *   `name` (string): Character's name.
        *   `role` (string): Primary role in the story.
        *   `note` (string): Explanatory notes about them.
    *   `setting` (string, optional): The geographical/time period setting.
    *   `plot` (string, optional): Narrative arc details.
    *   `conflict` (string, optional): The main conflict.
    *   `resolution` (string, optional): The climax resolution.
    *   `moral` (string, optional): The underlying life lesson.
    *   `summary` (string, optional): Expository overview of the book.
    *   `createdAt` (FieldValue, required): Server timestamp tracking when the book was cataloged.

#### 4.1.3 Collection: `reviews`
*   **Document ID:** Random Firestore-generated hash.
*   **Structure:**
    *   `bookId` (string, required): The target book's `BK_ID`.
    *   `userId` (string, required): The reviewer's user ID.
    *   `userName` (string, required): Display name of the reviewer.
    *   `rating` (number, required): Rating integer from `1` to `5`.
    *   `reviewText` (string, required): The full unified text block.
    *   `whyLiked` (string, optional): Specific details on why the reader enjoyed the book.
    *   `whatLearnt` (string, optional): Core lessons the reader learned.
    *   `canBeImproved` (string, optional): Constructive criticism of the book.
    *   `timestamp` (number, required): Date of submission.

#### 4.1.4 Collection: `announcements`
*   **Document ID:** Random Firestore-generated hash.
*   **Structure:**
    *   `title` (string, required): Announcement heading.
    *   `body` (string, required): The details of the notice.
    *   `authorName` (string, required): The publisher's display name.
    *   `authorRole` (string, required): The publisher's user role.
    *   `createdAt` (number, required): Creation date timestamp.

#### 4.1.5 Collection: `audit_logs`
*   **Document ID:** Random Firestore-generated hash.
*   **Structure:**
    *   `action` (string, required): Event tag (e.g. `"BOOK_ADD"`, `"ANNOUNCEMENT_DELETE"`, `"USER_ROLE_PROMOTION"`).
    *   `category` (string, required): Domain (e.g. `"Books"`, `"Users"`, `"Announcements"`).
    *   `details` (string, required): Full description of the action taken.
    *   `performedBy` (map, required): Account details of the user who performed the action:
        *   `uid` (string): User UID.
        *   `name` (string): Name of the user.
        *   `role` (string): User role.
        *   `email` (string): Email address of the user.
    *   `targetId` (string, optional): Affected item ID (e.g. book BK_ID).
    *   `timestamp` (number, required): Log submission date.

### 4.2 Firebase Realtime Database Paths

#### `discussions/{bookId}/messages/{messageId}`
*   Contains the message history for book-specific threads.
*   **Data Structure:**
    *   `sender` (string, required): Sender's name.
    *   `senderUid` (string, required): Sender's UID.
    *   `message` (string, required): Text of the message.
    *   `timestamp` (number, required): Epoch timestamp.

#### `custom_threads/{threadId}`
*   Contains user-created forum topics.
*   **Data Structure:**
    *   `id` (string, required): Unique thread identifier (matches `{threadId}`).
    *   `title` (string, required): Title of the forum topic.
    *   `creatorName` (string, required): Thread creator's name.
    *   `creatorUid` (string, required): Thread creator's UID.
    *   `createdAt` (number, required): Creation timestamp.

---

## 5. Reusable Web Components

To avoid redundant code and establish a scalable frontend design, modular components are dynamically injected and managed via scripts in the [`js/components/`](./js/components/) directory.

### 5.1 Responsive Header Navigation ([navbar.js](./js/components/navbar.js))
*   **Description:** Constructs the unified responsive navbar structure on both desktop and mobile screens.
*   **Dynamic Role Filtering:** Automatically renders dashboard links according to user profile status (e.g. directing to the custom student dashboard or exposing the "Manage" portal to teachers and administrators).
*   **UI Interactions:**
    *   **Dropdown menu:** Renders a nested hover/click submenu for profile settings, password changes, and signout logs.
    *   **Hamburger:** Leverages an `aria-expanded` toggle state to display a full-width overlay side drawer on mobile viewports.
    *   **Initials Fallback:** Displays user's name initials (`initials()`) inside the avatar button if no profile picture upload URL is found in Firestore.

### 5.2 Dynamic Catalog Card Grid ([bookCard.js](./js/components/bookCard.js))
*   **Description:** Generates standard glassmorphic book card components used in the search catalog and dashboard screens.
*   **Theme Integrations:** Automatically calculates a specialized book-spine color code using the genre attribute (e.g., Green for Sci-Fi, Dark Blue for Classics) to style borders or cover placeholders.
*   **Actions & Context:** Shows a floating edit button (`✏️ Edit`) in the card overlay if the logged-in user is a teacher or administrator. Additionally, embeds review modal buttons that launch the leave-review workflow directly from the catalogue list.

### 5.3 Review Injector Modal ([reviewModal.js](./js/components/reviewModal.js))
*   **Description:** Manages the modal overlay form used by students to write and submit library reviews.
*   **Lazy DOM Injection:** Injects the modal HTML markup directly to `document.body` upon the first click event, minimizing startup payload.
*   **Form Validations:**
    *   Ensures a star rating value of 1–5 is selected before allowing submit.
    *   Verifies text lengths and validates inputs against banned words using the profanity check system.
    *   Submits the review directly to Firestore and logs a `REVIEW_ADD` audit record in real-time.

---

## 6. Javascript Page Scripts Lifecycle & App Control Flow

Each page utilizes modular scripting logic that executes standard lifecycles to verify user permissions, render responsive UI, and manage data.

```
[Page Load] 
     |
     v
[watchAuthState] ---> (No Profile) ---> Redirect to login.html
     |
     v (Profile Loaded)
[renderNavbar(profile)] ---> Displays tailored links (Dashboard, Manage)
     |
     v
[init() Page Logic] ---> Fetch database collections ---> Render responsive views
```

### 6.1 Global Session Watcher & Auth Guards ([auth.js](./js/firebase/auth.js))
*   **`watchAuthState(callback)`**: Binds to Firebase Auth state listener `onAuthStateChanged`. When auth updates, it runs an asynchronous query against Firestore (`/users/{uid}`) to pull the user's role profile. It then triggers the page's render callback, passing the complete user object.
*   **`requireAuth(requiredRoles = [])`**: Acts as an active page router. If `watchAuthState` finds no active profile, it redirects the browser to `login.html`. If the user is logged in but their profile `role` does not match the page's requirements (e.g., a student trying to access `manage.html`), they are redirected to `student-dashboard.html`.

### 6.2 Sign In & Registration Management ([login.js](./js/pages/login.js))
*   **Tab toggle configurations:** Manages form layouts for "Sign In" vs "Create Account".
*   **Role Setup Verification:** Shows or hides academic fields (e.g. Class, Roll Number for students; Department selection for teachers) depending on the form toggle.
*   **Teacher Domain Restrictor:** Validates if a user attempting to sign up as a teacher has an email ending with the official `_lko@jaipuria.edu.in` school suffix. If not, signup is restricted to prevent unauthorized database elevation.
*   **Google OAuth flows:** Integrates Google Popup sign-in. If the authenticated email is not found in the `users` collection, a signup modal is triggered, prompting the user to complete their profile setup with required parameters.

### 6.3 Home Page Script ([index.js](./js/pages/index.js))
*   **Bookshelf Genre Render:** Calculates a list of the 8 most prominent genres from current library books and maps them onto visual book-spines on the page hero.
*   **Announcement Listing:** Pulls list of recent notices, formats timestamps, and appends them to the dashboard announcements list.

### 6.4 Guidelines Page Script (`guidelines.html` embedded script)
*   Calls `watchAuthState` to establish active profiles.
*   Triggers `renderNavbar` passing the active page reference `"guidelines.html"` to highlight the current navigation link.

### 6.5 Library Search & Filter ([library.js](./js/pages/library.js))
*   **State Management:** Holds a global cache of the book catalogue (`let allBooks = []`).
*   **Dynamic Filtering:** Captures text query key-down events and checks for matches in title and author names.
*   **Multi-Select Genre Engine:** Monitors active genre chips. Clicking filter chips adds or removes genres from the active filter set, updating the catalog display in real-time.

### 6.6 Book Details & Accordions ([book-details.js](./js/pages/book-details.js))
*   **URL Parameter Reader:** Evaluates `window.location.search` parameters to extract the target book's `id`.
*   **Structured UI Builders:** Renders detailed content templates (Setting, Plot, Moral, Conflict, Resolution) inside custom, smooth-folding CSS accordions.
*   **Review Validator:** Validates review inputs before write submissions. Prevents empty reviews, checks rating ranges, and splits review input into targeted structured database nodes.

### 6.7 Discussions Chat Engine ([discussions.js](./js/pages/discussions.js))
*   **Active Thread Subscribers:** Binds Realtime Database listeners (`listenToThread`) to the current thread. Incoming messages automatically update the chat window.
*   **Automated Scroll Lock:** Calculates message panel height and calls `.scrollTo(0, scrollHeight)` to keep the message feed focused on the newest messages.

### 6.8 Discover Directory ([discover.js](./js/pages/discover.js))
*   **User Registry Queries:** Queries the `/users` Firestore collection to retrieve all registered accounts.
*   **Multi-Attribute Search:** Allows administrators and students to search users by Name, Username, Department, Class, Section, or Roll Number.

### 6.9 Personal Dashboard & Settings ([student-dashboard.js](./js/pages/student-dashboard.js))
*   **Profile Counters:** Fetches user-specific counts for written reviews and recently viewed books.
*   **Session-scoped views tracker:** Stores recently viewed book IDs in `sessionStorage` and displays preview links on the dashboard.
*   **Password Adjustments:** Integrates password update flows via reauthentication with EmailAuthProvider credentials.
*   **Account Deletions:** Integrates account teardown logic. Validates confirmation credentials and deletes the user profile data from Auth and Firestore.

### 6.10 Teacher Operations Console ([teacher-dashboard.js](./js/pages/teacher-dashboard.js))
*   **Catalog Table Rendering:** Renders a list of all cataloged items with easy access edit/delete hooks.
*   **Automatic Sequential IDs:** Generates the next sequential ID automatically (e.g. `SAJS-006` if `SAJS-005` is the highest found) using the custom ID calculations engine.
*   **Review Moderation Hub:** Aggregates a review feed across all books. Exposes review removal tools (`Remove`) allowing teachers to flag and delete reviews violating guidelines.

### 6.11 Administrators Console ([admin-panel.js](./js/pages/admin-panel.js))
*   **User Profile Audits:** Displays user listings (Name, Email, Role, Class) inside a responsive table.
*   **Management Overlays:** Allows searching profiles and viewing deep user configurations via detail alerts.

### 6.12 Administration Panel Control ([manage.js](./js/pages/manage.js))
*   **Dynamic Tab Switcher:** Captures tab-bar clicks and updates tab visibility accordingly (`#tab-catalogue`, `#tab-reviews`, `#tab-students`, `#tab-announcements`, `#tab-audit`, `#tab-users`).
*   **Catalog Call Number Generator:** Evaluates catalog items, extracts numbers from the `SAJS-###` key structure, calculates the maximum value, and returns the next sequential Call ID (e.g. `SAJS-006`).
*   **Characters Array Parser:** Captures list text areas, splits them by line breaks (`\n`), splits each line by a pipe delimiter (`|`), and maps them to a structured list of character maps:
    ```javascript
    const characters = qs("#f-characters").value.split("\n").filter(Boolean).map((line) => {
      const parts = line.split("|").map((s) => (s || "").trim());
      return { 
        name: parts[0] || "", 
        role: parts[1] || "", 
        note: parts[2] || "" 
      };
    });
    ```
    This ensures that even if a user leaves out the role or notes (e.g., just entering `"Hamlet"` instead of `"Hamlet | Prince | Protagonist"`), the system writes empty strings (`""`) rather than `undefined` values, preventing database write crashes.

---

## 7. Core Shared Utility Modules

To centralize structural logic, the system utilizes general utilities placed in the [`js/utils/`](./js/utils/) folder.

### 7.1 Helper Modules ([helpers.js](./js/utils/helpers.js))
*   **Genre Constants (`MAIN_FILTER_GENRES`, `ALL_GENRES`):** Centralizes all valid catalog genres for search filtering chips and add forms.
*   **`timeAgo(ts)`:** Converts millisecond timestamps into relative strings (e.g. `5m ago`, `2d ago`).
*   **`starString(rating)`:** Converts ratings into star character arrays (`★`/`☆`) and wraps them with filled classes.
*   **`showToast(msg, type)`:** Dynamically manages a vertical notification feed layout on the screen.
*   **`initGenreChipPicker(container, preSelected)`:** A multi-select genre selection component displaying common items upfront, with secondary options available via "Show More" expansion controls.

### 7.2 Profanity & Content Filtering ([filter.js](./js/utils/filter.js))
*   **`BANNED_WORDS` Set:** Contains core banned words, inappropriate terms, and slurs used to moderate forums.
*   **`hasBadWords(text)`:** Normalizes capitalization, replaces punctuation marks, divides strings into isolated words, and checks word presence against the Set. Returns a Boolean value.
*   **`cleanProfanity(text)`:** Replaces matched profanities with asterisks corresponding to the original word length.

---

## 8. Security Policies & Rules

### 8.1 Firestore Security Rules ([firestore.rules](./firebase/firestore.rules))
Firestore enforces granular rules to keep the database secure and verify data integrity on the server side:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isAdminEmail() { return request.auth.token.email == "manavgmishra@gmail.com"; }
    function userDoc(uid) { return get(/databases/$(database)/documents/users/$(uid)).data; }
    function myRole() { return userDoc(request.auth.uid).role; }
    
    function isAdmin() { return isSignedIn() && (myRole() == "admin" || isAdminEmail()); }
    function isTeacherOrAdmin() {
      return isSignedIn() && (myRole() == "teacher" || myRole() == "admin" || isAdminEmail());
    }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }

    // Users Collection
    match /users/{uid} {
      allow read: if true;
      allow create: if isOwner(uid)
                    && (
                      request.resource.data.role == "student"
                      || (
                        request.resource.data.role == "teacher"
                        && request.auth.token.email.matches(".*_lko@jaipuria\\.edu\\.in$")
                      )
                    )
                    && request.resource.data.uid == uid
                    && request.resource.data.name is string
                    && request.resource.data.name.size() > 0
                    && request.resource.data.email is string
                    && (!('classTeacher' in request.resource.data) || request.resource.data.classTeacher is string)
                    && (!('subject' in request.resource.data) || request.resource.data.subject is string)
                    && (!('favouriteSubjects' in request.resource.data) || request.resource.data.favouriteSubjects is list);

      allow update: if isOwner(uid)
                    && request.resource.data.role == resource.data.role
                    && request.resource.data.uid == resource.data.uid
                    && (
                      !('username' in request.resource.data)
                      || !('username' in resource.data)
                      || request.resource.data.username == resource.data.username
                    );
      allow update, delete: if isAdmin();
    }

    // Books Collection
    match /books/{docId} {
      allow read: if true;
      allow create: if isTeacherOrAdmin()
                    && request.resource.data.BK_ID is string
                    && request.resource.data.BK_ID.matches("^SAJS-[0-9]{3,}$")
                    && request.resource.data.bookName is string
                    && request.resource.data.bookName.size() > 0
                    && request.resource.data.author is string
                    && request.resource.data.author.size() > 0
                    && request.resource.data.genre is string
                    && request.resource.data.genre.size() > 0;
      allow update: if isTeacherOrAdmin() && request.resource.data.BK_ID == resource.data.BK_ID;
      allow delete: if isTeacherOrAdmin();
    }

    // Reviews Collection
    match /reviews/{docId} {
      allow read: if true;
      allow create: if isSignedIn()
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.bookId is string
                    && request.resource.data.bookId.size() > 0
                    && request.resource.data.rating is int
                    && request.resource.data.rating >= 1
                    && request.resource.data.rating <= 5
                    && request.resource.data.reviewText is string
                    && request.resource.data.reviewText.size() > 0
                    && request.resource.data.reviewText.size() <= 2000;
      allow update: if isSignedIn()
                    && resource.data.userId == request.auth.uid
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.bookId == resource.data.bookId;
      allow delete: if isSignedIn() && (resource.data.userId == request.auth.uid || isTeacherOrAdmin());
    }

    // Announcements Collection
    match /announcements/{docId} {
      allow read: if true;
      allow create: if isTeacherOrAdmin()
                    && request.resource.data.title is string
                    && request.resource.data.title.size() > 0
                    && request.resource.data.body is string
                    && request.resource.data.body.size() > 0;
      allow update, delete: if isTeacherOrAdmin();
    }

    // Audit Logs Collection
    match /audit_logs/{docId} {
      allow read: if isTeacherOrAdmin();
      allow create: if isSignedIn()
                    && request.resource.data.action is string
                    && request.resource.data.category is string;
    }
  }
}
```

### 8.2 Storage Security Rules (Firebase Console Configured)
Controls media upload sizes and formats:

```javascript
service firebase.storage {
  match /b/{bucket}/o {
    // Book cover images - 5MB max, image MIME check
    match /covers/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    // Book PDFs - 50MB max, application/pdf type only
    match /pdfs/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 50 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';
    }
    // Profile avatars - 5MB max, image check
    match /avatars/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 8.3 Realtime Database Security Rules ([database.rules.json](./firebase/database.rules.json))
Controls real-time message streams:

```json
{
  "rules": {
    "discussions": {
      "$bookId": {
        "messages": {
          ".read": "auth != null",
          ".write": "auth != null",
          ".indexOn": ["timestamp"],
          "$messageId": {
            ".validate": "newData.hasChildren(['sender', 'senderUid', 'message', 'timestamp'])"
          }
        }
      }
    },
    "custom_threads": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["createdAt"],
      "$threadId": {
        ".validate": "newData.hasChildren(['id', 'title', 'creatorName', 'creatorUid', 'createdAt'])"
      }
    }
  }
}
```

---

## 9. Connectivity Fail-Safes & Performance Optimizations

### 9.1 Avoiding Database Write Freeze
A common issue in Firebase applications is the infinite promise hang. By default, write calls like `addDoc` or `set` do not time out; instead, they queue the action locally if a connection issue occurs.

To resolve this, we implement a **Promise Race Timeout wrapper** in [`helpers.js`](./js/utils/helpers.js):
```javascript
export function withTimeout(promise, ms = 8000, timeoutError = new Error("Request timed out.")) {
  return Promise.race([
    promise, 
    new Promise((_, reject) => setTimeout(() => reject(timeoutError), ms))
  ]);
}
```
All major catalog edits, book updates, and discussion thread posts are wrapped with `withTimeout()`. If a request doesn't complete within the timeout duration (8s for text databases, 15s for cover uploads, 30s for PDF uploads), it automatically fails, triggers the `catch` block, shows a clear error toast to the user, and re-enables the submission buttons.

For the Realtime Database, before trying to initialize threads or post messages, the system queries the `.info/connected` status node with a 5-second timeout, failing fast with a descriptive error message if the database is unreachable.

### 9.2 Eliminating Index Hanger Failures
Firestore queries that combine a filter (`where`) and sorting (`orderBy`) require composite indexes. If an index is missing, the query will fail or hang indefinitely.

To prevent this issue, the platform **performs all sorting operations on the client side**:
*   `getAllBooks()`: Fetches the books, then calls `.sort((a, b) => String(a.BK_ID).localeCompare(String(b.BK_ID)))`.
*   `getReviewsForBook()`: Fetches the reviews by book ID, then calls `.sort((a, b) => b.timestamp - a.timestamp)`.
*   `getAnnouncements()`: Fetches all announcements, then calls `.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)`.
*   `getAuditLogs()`: Fetches the logs, then calls `.sort((a, b) => b.timestamp - a.timestamp).slice(0, 150)`.

This approach ensures the website works seamlessly on empty collections and new databases without requiring composite index configurations.

---

## 10. Future Roadmap

1.  **Gamified Reading Milestones:** Introduce reading streaks, achievements, and customizable visual profile badges to boost student interaction and motivation.
2.  **AI-Generated Recommendations:** Suggest new library books based on a student's indicated Favorite Genres, Subjects, and previous ratings.
3.  **PDF Annotations:** Enhance the inline PDF reader to let students add private digital highlights, bookmarks, and vocabulary logs directly in the browser.
4.  **Advanced Parental Portal:** Grant parents read-only access to view their child's dashboard, reviews, and reading milestones.
5.  **Integration with Physical Inventory:** Sync with barcode scanners in the physical school library to track live borrowing statuses and checkouts.

---

## 11. Conclusion

The **SAJS Digital Library** bridges the gap between traditional reading logs and active, collaborative digital spaces. Built on high-performance serverless architecture, it ensures secure data storage, fast search indexing, and real-time community interaction. Designed with modular structures, it remains fully scalable to accommodate upcoming features and administrative requirements.
