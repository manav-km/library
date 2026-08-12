# SAJS Digital Library — Full System & Code Documentation

Welcome to the definitive system and code documentation for the **Seth Anandram Jaipuria School (SAJS) Digital Library**. This document is designed to serve as an exhaustive reference manual for developers, system administrators, and school educators. It provides a complete, line-of-sight description of the platform's architecture, database models, lifecycle operations, security rules, and user interfaces.

---

## 1. Executive Summary & Site Vision

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

## 2. Technical Stack & Infrastructure Architecture

The platform runs entirely as a serverless static web application (Jamstack) powered by standard web technologies on the frontend and Google Firebase on the backend.

### 2.1 Frontend Development Layer
*   **HTML5 Standard:** Uses modern semantic elements (`<main>`, `<section>`, `<aside>`, `<nav>`, `<header>`) ensuring optimized accessibility, structure, and browser rendering.
*   **CSS3 Styling Engine:** Built entirely around modular, component-driven CSS files. No bloated external utility frameworks (such as Tailwind) are used. Instead, a custom variable-based design token sheet (`variables.css`) coordinates the theme:
    *   **Colors:** Deep Indigo and Cyan brand palettes (`#4f46e5`, `#22d3ee`) styled with translucent glassmorphic card borders (`var(--glass-fill)`, `var(--glass-border)`).
    *   **Typography:** The structural font family uses **Space Grotesk** for headings and callouts, **Inter** for readable body text, and **JetBrains Mono** for alphanumeric identifiers (e.g. Call Numbers).
    *   **Responsiveness:** Fluid layouts built with Flexbox and CSS Grid, resizing smoothly across mobile screens, tablets, and desktop displays.
*   **Vanilla ES6 JavaScript Modules:** Uses native JavaScript import/export declarations (`type="module"`), avoiding compilation steps or node bundling overhead.

### 2.2 Backend Serverless Services (Firebase SDK v10.12.2)
*   **Firebase Authentication:** Implements client-side authentication token generation. It handles standard Email/Password credentials as well as single-sign-on (SSO) Google Popup flows.
*   **Cloud Firestore:** A document-oriented NoSQL database. Stores persistent documents (e.g., catalog details, student records, and audits).
*   **Firebase Realtime Database (RTDB):** A high-speed WebSocket database. Used to maintain low-latency, real-time message streams for open book discussions and custom user forums.
*   **Firebase Storage:** A cloud file-storage service. Used to host and serve uploaded media files, including cover images, book PDFs, and user avatars.

---

## 3. Exhaustive Database Schema & Data Models

### 3.1 Cloud Firestore Collections

#### 3.1.1 Collection: `users`
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

#### 3.1.2 Collection: `books`
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

#### 3.1.3 Collection: `reviews`
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

#### 3.1.4 Collection: `announcements`
*   **Document ID:** Random Firestore-generated hash.
*   **Structure:**
    *   `title` (string, required): Announcement heading.
    *   `body` (string, required): The details of the notice.
    *   `authorName` (string, required): The publisher's display name.
    *   `authorRole` (string, required): The publisher's user role.
    *   `createdAt` (number, required): Creation date timestamp.

#### 3.1.5 Collection: `audit_logs`
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

### 3.2 Firebase Realtime Database Paths

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

## 4. Javascript Page Scripts Lifecycle & App Control Flow

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

### 4.1 Global Session Watcher & Auth Guards (`auth.js`)
*   **`watchAuthState(callback)`**: Binds to Firebase Auth state listener `onAuthStateChanged`. When auth updates, it runs an asynchronous query against Firestore (`/users/{uid}`) to pull the user's role profile. It then triggers the page's render callback, passing the complete user object.
*   **`requireAuth(requiredRoles = [])`**: Acts as an active page router. If `watchAuthState` finds no active profile, it redirects the browser to `login.html`. If the user is logged in but their profile `role` does not match the page's requirements (e.g., a student trying to access `manage.html`), they are redirected to `student-dashboard.html`.

### 4.2 Home Page Script (`index.js`)
*   **Bookshelf Genre Render:** Calculates a list of the 8 most prominent genres from current library books and maps them onto visual book-spines on the page hero.
*   **Announcement Listing:** Pulls list of recent notices, formats timestamps, and appends them to the dashboard announcements list.

### 4.3 Guidelines Page Script (`guidelines.html` embedded script)
*   Calls `watchAuthState` to establish active profiles.
*   Triggers `renderNavbar` passing the active page reference `"guidelines.html"` to highlight the current navigation link.

### 4.4 Library Search & Filter (`library.js`)
*   **State Management:** Holds a global cache of the book catalogue (`let allBooks = []`).
*   **Dynamic Filtering:** Captures text query key-down events and checks for matches in title and author names.
*   **Multi-Select Genre Engine:** Monitors active genre chips. Clicking filter chips adds or removes genres from the active filter set, updating the catalog display in real-time.

### 4.5 Book Details & Accordions (`book-details.js`)
*   **URL Parameter Reader:** Evaluates `window.location.search` parameters to extract the target book's `id`.
*   **Structured UI Builders:** Renders detailed content templates (Setting, Plot, Moral, Conflict, Resolution) inside custom, smooth-folding CSS accordions.
*   **Review Validator:** Validates review inputs before write submissions. Prevents empty reviews, checks rating ranges, and splits review input into targeted structured database nodes.

### 4.6 Discussions Chat Engine (`discussions.js`)
*   **Active Thread Subscribers:** Binds Realtime Database listeners (`listenToThread`) to the current thread. Incoming messages automatically update the chat window.
*   **Automated Scroll Lock:** Calculates message panel height and calls `.scrollTo(0, scrollHeight)` to keep the message feed focused on the newest messages.

### 4.7 Discover Directory (`discover.js`)
*   **User Registry Queries:** Queries the `/users` Firestore collection to retrieve all registered accounts.
*   **Multi-Attribute Search:** Allows administrators and students to search users by Name, Username, Department, Class, Section, or Roll Number.

### 4.8 Personal Dashboard (`dashboard.js`)
*   **Reading History:** Queries the user's review documents and displays a list of books they've reviewed.
*   **Self-Profile Update Handlers:** Binds save listeners to the profile update form. Allows editing details like bio and favorite genres, and updates the profile changes back to the user's document in Firestore.

### 4.9 Administration Panel Control (`manage.js`)
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

## 5. Security Policies & Rules

### 5.1 Firestore Security Rules (`firestore.rules`)
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
                    && request.resource.data.userId == resource.data.userId
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

### 5.2 Storage Security Rules (`storage.rules` embedded)
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

### 5.3 Realtime Database Security Rules (`database.rules.json`)
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

## 6. Connectivity Fail-Safes & Performance Optimizations

### 6.1 Avoiding Database Write Freeze
A common issue in Firebase applications is the infinite promise hang. By default, write calls like `addDoc` or `set` do not time out; instead, they queue the action locally if a connection issue occurs.

To resolve this, we implement a **Promise Race Timeout wrapper** in [`helpers.js`](file:///d:/Personal/Websites/School%20Websites/Library/js/utils/helpers.js):
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

### 6.2 Eliminating Index Hanger Failures
Firestore queries that combine a filter (`where`) and sorting (`orderBy`) require composite indexes. If an index is missing, the query will fail or hang indefinitely.

To prevent this issue, the platform **performs all sorting operations on the client side**:
*   `getAllBooks()`: Fetches the books, then calls `.sort((a, b) => String(a.BK_ID).localeCompare(String(b.BK_ID)))`.
*   `getReviewsForBook()`: Fetches the reviews by book ID, then calls `.sort((a, b) => b.timestamp - a.timestamp)`.
*   `getAnnouncements()`: Fetches all announcements, then calls `.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)`.
*   `getAuditLogs()`: Fetches the logs, then calls `.sort((a, b) => b.timestamp - a.timestamp).slice(0, 150)`.

This approach ensures the website works seamlessly on empty collections and new databases without requiring composite index configurations.

---

## 7. Future Roadmap

1.  **Gamified Reading Milestones:** Introduce reading streaks, achievements, and customizable visual profile badges to boost student interaction and motivation.
2.  **AI-Generated Recommendations:** Suggest new library books based on a student's indicated Favorite Genres, Subjects, and previous ratings.
3.  **PDF Annotations:** Enhance the inline PDF reader to let students add private digital highlights, bookmarks, and vocabulary logs directly in the browser.
4.  **Advanced Parental Portal:** Grant parents read-only access to view their child's dashboard, reviews, and reading milestones.
5.  **Integration with Physical Inventory:** Sync with barcode scanners in the physical school library to track live borrowing statuses and checkouts.

---

## 8. Conclusion

The **SAJS Digital Library** bridges the gap between traditional reading logs and active, collaborative digital spaces. Built on high-performance serverless architecture, it ensures secure data storage, fast search indexing, and real-time community interaction. Designed with modular structures, it remains fully scalable to accommodate upcoming features and administrative requirements.
