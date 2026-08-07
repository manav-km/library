export const MAIN_FILTER_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Hindi",
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
  "Art",
  "Biography & Memoir",
  "Business",
  "Children's",
  "Classics",
  "Comedy",
  "Crafts & DIY",
  "Crime",
  "Drama & Romance",
  "Dystopian",
  "Fairy Tales",
  "Fantasy",
  "Fiction",
  "Finance",
  "Folklore",
  "Games & Gaming",
  "Graphic Novels & Comics",
  "Health & Wellness",
  "Hindi",
  "Historical Fiction",
  "History",
  "Horror",
  "Humor",
  "Inspirational",
  "Journalism",
  "Language Learning",
  "Manga",
  "Mathematics",
  "Music",
  "Mystery & Thriller",
  "Mythology",
  "Nature",
  "Non-Fiction",
  "Performing Arts",
  "Philosophy & Ethics",
  "Photography",
  "Poetry & Plays",
  "Reference",
  "Religion",
  "School Life",
  "Science & Technology",
  "Science Fiction",
  "Self-Help & Psychology",
  "Short Stories",
  "Social Science",
  "Space",
  "Spirituality",
  "Sports",
  "Survival",
  "Textbooks",
  "Travel",
  "War",
  "Western",
  "Wildlife",
  "Young Adult (YA)"
];

const GENRE_SPINES = {
  "Action": "var(--spine-action)",
  "Adventure": "var(--spine-adventure)",
  "Art": "var(--spine-art)",
  "Biography & Memoir": "var(--spine-biography)",
  "Business": "var(--spine-business)",
  "Children's": "var(--spine-children)",
  "Classics": "var(--spine-classics)",
  "Comedy": "var(--spine-comedy)",
  "Crafts & DIY": "var(--spine-crafts)",
  "Crime": "var(--spine-crime)",
  "Drama & Romance": "var(--spine-romance)",
  "Dystopian": "var(--spine-dystopian)",
  "Fairy Tales": "var(--spine-fairytales)",
  "Fantasy": "var(--spine-fantasy)",
  "Fiction": "var(--spine-fiction)",
  "Finance": "var(--spine-finance)",
  "Folklore": "var(--spine-folklore)",
  "Games & Gaming": "var(--spine-gaming)",
  "Graphic Novels & Comics": "var(--spine-graphic)",
  "Health & Wellness": "var(--spine-health)",
  "Hindi": "var(--spine-hindi)",
  "Historical Fiction": "var(--spine-historical)",
  "History": "var(--spine-history)",
  "Horror": "var(--spine-horror)",
  "Humor": "var(--spine-humor)",
  "Inspirational": "var(--spine-inspirational)",
  "Journalism": "var(--spine-journalism)",
  "Language Learning": "var(--spine-language)",
  "Manga": "var(--spine-manga)",
  "Mathematics": "var(--spine-math)",
  "Music": "var(--spine-music)",
  "Mystery & Thriller": "var(--spine-mystery)",
  "Mythology": "var(--spine-mythology)",
  "Nature": "var(--spine-nature)",
  "Non-Fiction": "var(--spine-nonfiction)",
  "Performing Arts": "var(--spine-arts)",
  "Philosophy & Ethics": "var(--spine-philosophy)",
  "Photography": "var(--spine-photo)",
  "Poetry & Plays": "var(--spine-poetry)",
  "Reference": "var(--spine-reference)",
  "Religion": "var(--spine-religion)",
  "School Life": "var(--spine-school)",
  "Science & Technology": "var(--spine-science)",
  "Science Fiction": "var(--spine-scifi)",
  "Self-Help & Psychology": "var(--spine-psychology)",
  "Short Stories": "var(--spine-short)",
  "Social Science": "var(--spine-social)",
  "Space": "var(--spine-space)",
  "Spirituality": "var(--spine-spirituality)",
  "Sports": "var(--spine-sports)",
  "Survival": "var(--spine-survival)",
  "Textbooks": "var(--spine-textbook)",
  "Travel": "var(--spine-travel)",
  "War": "var(--spine-war)",
  "Western": "var(--spine-western)",
  "Wildlife": "var(--spine-wildlife)",
  "Young Adult (YA)": "var(--spine-ya)"
};

const SPINE_PALETTE = [
  "var(--spine-action)", "var(--spine-adventure)", "var(--spine-alternate)",
  "var(--spine-anthology)", "var(--spine-art)", "var(--spine-biography)",
  "var(--spine-business)", "var(--spine-fiction)", "var(--spine-nonfiction)",
  "var(--spine-scifi)", "var(--spine-fantasy)", "var(--spine-history)",
  "var(--spine-historical)", "var(--spine-mystery)", "var(--spine-poetry)",
  "var(--spine-classics)", "var(--spine-philosophy)", "var(--spine-science)",
  "var(--spine-ya)", "var(--spine-graphic)", "var(--spine-psychology)",
  "var(--spine-romance)", "var(--spine-cyberpunk)", "var(--spine-manga)"
];

export function spineColorFor(genre) {
  if (!genre) return "var(--indigo-400)";
  if (GENRE_SPINES[genre]) return GENRE_SPINES[genre];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPINE_PALETTE.length;
  return SPINE_PALETTE[index];
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

export function populateGenreSelects(root = document) {
  const selects = root.querySelectorAll("select[id*='genre'], select[id$='genre']");
  selects.forEach((sel) => {
    const val = sel.value;
    sel.innerHTML = ALL_GENRES.map((g) => `<option value="${escapeHTML(g)}">${escapeHTML(g)}</option>`).join("");
    if (val && ALL_GENRES.includes(val)) sel.value = val;
  });
}
