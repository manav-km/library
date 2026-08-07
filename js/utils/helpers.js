export const MAIN_FILTER_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Science Fiction",
  "Fantasy",
  "Mystery & Thriller",
  "Historical Fiction",
  "Biography & Memoir",
  "History",
  "Poetry & Plays",
  "Classics",
  "Philosophy & Ethics",
  "Science & Technology",
  "Young Adult (YA)",
  "Graphic Novels & Comics",
  "Drama & Romance"
];

export const ALL_GENRES = [
  "Action",
  "Adventure",
  "Alternate History",
  "Anthology",
  "Art",
  "Biography",
  "Biography & Memoir",
  "Business",
  "Chick Lit",
  "Children's",
  "Classics",
  "Comedy",
  "Coming-of-Age",
  "Comics",
  "Contemporary",
  "Cookbook",
  "Crafts & DIY",
  "Crime",
  "Cyberpunk",
  "Dark Fiction",
  "Drama",
  "Drama & Romance",
  "Dystopian",
  "Education",
  "Espionage",
  "Essays",
  "Fairy Tales",
  "Family",
  "Fantasy",
  "Fashion",
  "Fiction",
  "Finance",
  "Folklore",
  "Food & Drink",
  "Games & Gaming",
  "Gardening",
  "Gay & Lesbian (LGBTQ+)",
  "General Non-Fiction",
  "Gothic",
  "Graphic Novels",
  "Graphic Novels & Comics",
  "Guidebooks",
  "Hard Science",
  "Health & Wellness",
  "Historical Fiction",
  "History",
  "Holiday",
  "Horror",
  "Humor",
  "Inspirational",
  "Journalism",
  "Juvenile Fiction",
  "Language Learning",
  "Legal",
  "Literary Fiction",
  "Manga",
  "Martial Arts",
  "Mathematics",
  "Medical",
  "Memoir",
  "Middle Grade",
  "Military",
  "Music",
  "Mystery",
  "Mystery & Thriller",
  "Mythology",
  "Nature",
  "New Adult",
  "Noir",
  "Non-Fiction",
  "Occult",
  "Paranormal",
  "Parenting",
  "Performing Arts",
  "Pets",
  "Philosophy",
  "Philosophy & Ethics",
  "Photography",
  "Plays",
  "Poetry",
  "Poetry & Plays",
  "Political",
  "Psychology",
  "Realistic Fiction",
  "Reference",
  "Religion",
  "Romance",
  "Satire",
  "School Life",
  "Science",
  "Science & Technology",
  "Science Fiction",
  "Screenplays",
  "Self-Help",
  "Self-Help & Psychology",
  "Short Stories",
  "Slice of Life",
  "Social Science",
  "Sociology",
  "Space",
  "Spirituality",
  "Sports",
  "Steampunk",
  "Survival",
  "Suspense",
  "Technology",
  "Textbooks",
  "Theatre",
  "Thriller",
  "Time Travel",
  "Travel",
  "True Crime",
  "Urban Fiction",
  "War",
  "Western",
  "Wildlife",
  "Women's Fiction",
  "Young Adult (YA)"
];

const GENRE_SPINES = {
  "Fiction": "var(--spine-fiction)",
  "Non-Fiction": "var(--spine-nonfiction)",
  "Science Fiction": "var(--spine-scifi)",
  "Fantasy": "var(--spine-fantasy)",
  "Mystery & Thriller": "var(--spine-mystery)",
  "Mystery": "var(--spine-mystery)",
  "Historical Fiction": "var(--spine-historical)",
  "Biography & Memoir": "var(--spine-biography)",
  "Biography": "var(--spine-biography)",
  "History": "var(--spine-history)",
  "Poetry & Plays": "var(--spine-poetry)",
  "Poetry": "var(--spine-poetry)",
  "Classics": "var(--spine-classics)",
  "Philosophy & Ethics": "var(--spine-philosophy)",
  "Science & Technology": "var(--spine-science)",
  "Young Adult (YA)": "var(--spine-ya)",
  "Graphic Novels & Comics": "var(--spine-graphic)",
  "Self-Help & Psychology": "var(--spine-psychology)",
  "Drama & Romance": "var(--spine-romance)"
};

export function spineColorFor(genre) {
  return GENRE_SPINES[genre] || "var(--indigo-400)";
}

export function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function starString(rating, max = 5) {
  let out = "";
  for (let i = 1; i <= max; i++) out += `<span class="${i <= rating ? "filled" : ""}">${i <= rating ? "★" : "☆"}</span>`;
  return out;
}

export function escapeHTML(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** Toast notifications — expects a <div class="toast-stack"> in the page. */
export function showToast(message, type = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
