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
  "Alternate History",
  "Anthology",
  "Art",
  "Biography & Memoir",
  "Business",
  "Children's",
  "Classics",
  "Comedy",
  "Coming-of-Age",
  "Contemporary",
  "Cookbook",
  "Crafts & DIY",
  "Crime",
  "Cyberpunk",
  "Dark Fiction",
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
  "Gothic",
  "Graphic Novels & Comics",
  "Guidebooks",
  "Hard Science",
  "Health & Wellness",
  "Hindi",
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
  "Middle Grade",
  "Military",
  "Music",
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
  "Philosophy & Ethics",
  "Photography",
  "Poetry & Plays",
  "Political",
  "Realistic Fiction",
  "Reference",
  "Religion",
  "Satire",
  "School Life",
  "Science & Technology",
  "Science Fiction",
  "Screenplays",
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
  "Time Travel",
  "Travel",
  "Urban Fiction",
  "War",
  "Western",
  "Wildlife",
  "Women's Fiction",
  "Young Adult (YA)"
];

const GENRE_SPINES = {
  "Action": "var(--spine-action)",
  "Adventure": "var(--spine-adventure)",
  "Alternate History": "var(--spine-alternate)",
  "Anthology": "var(--spine-anthology)",
  "Art": "var(--spine-art)",
  "Biography & Memoir": "var(--spine-biography)",
  "Business": "var(--spine-business)",
  "Children's": "var(--spine-children)",
  "Classics": "var(--spine-classics)",
  "Comedy": "var(--spine-comedy)",
  "Coming-of-Age": "var(--spine-comingofage)",
  "Contemporary": "var(--spine-contemporary)",
  "Cookbook": "var(--spine-cookbook)",
  "Crafts & DIY": "var(--spine-crafts)",
  "Crime": "var(--spine-crime)",
  "Cyberpunk": "var(--spine-cyberpunk)",
  "Dark Fiction": "var(--spine-dark)",
  "Drama & Romance": "var(--spine-romance)",
  "Dystopian": "var(--spine-dystopian)",
  "Education": "var(--spine-education)",
  "Espionage": "var(--spine-espionage)",
  "Essays": "var(--spine-essays)",
  "Fairy Tales": "var(--spine-fairytales)",
  "Family": "var(--spine-family)",
  "Fantasy": "var(--spine-fantasy)",
  "Fashion": "var(--spine-fashion)",
  "Fiction": "var(--spine-fiction)",
  "Finance": "var(--spine-finance)",
  "Folklore": "var(--spine-folklore)",
  "Food & Drink": "var(--spine-food)",
  "Games & Gaming": "var(--spine-gaming)",
  "Gardening": "var(--spine-gardening)",
  "Gothic": "var(--spine-gothic)",
  "Graphic Novels & Comics": "var(--spine-graphic)",
  "Guidebooks": "var(--spine-guidebooks)",
  "Hard Science": "var(--spine-science)",
  "Health & Wellness": "var(--spine-health)",
  "Hindi": "var(--spine-hindi)",
  "Historical Fiction": "var(--spine-historical)",
  "History": "var(--spine-history)",
  "Holiday": "var(--spine-holiday)",
  "Horror": "var(--spine-horror)",
  "Humor": "var(--spine-humor)",
  "Inspirational": "var(--spine-inspirational)",
  "Journalism": "var(--spine-journalism)",
  "Juvenile Fiction": "var(--spine-juvenile)",
  "Language Learning": "var(--spine-language)",
  "Legal": "var(--spine-legal)",
  "Literary Fiction": "var(--spine-literary)",
  "Manga": "var(--spine-manga)",
  "Martial Arts": "var(--spine-martial)",
  "Mathematics": "var(--spine-math)",
  "Medical": "var(--spine-medical)",
  "Middle Grade": "var(--spine-middle)",
  "Military": "var(--spine-military)",
  "Music": "var(--spine-music)",
  "Mystery & Thriller": "var(--spine-mystery)",
  "Mythology": "var(--spine-mythology)",
  "Nature": "var(--spine-nature)",
  "New Adult": "var(--spine-newadult)",
  "Noir": "var(--spine-noir)",
  "Non-Fiction": "var(--spine-nonfiction)",
  "Occult": "var(--spine-occult)",
  "Paranormal": "var(--spine-paranormal)",
  "Parenting": "var(--spine-parenting)",
  "Performing Arts": "var(--spine-arts)",
  "Pets": "var(--spine-pets)",
  "Philosophy & Ethics": "var(--spine-philosophy)",
  "Photography": "var(--spine-photo)",
  "Poetry & Plays": "var(--spine-poetry)",
  "Political": "var(--spine-political)",
  "Realistic Fiction": "var(--spine-realistic)",
  "Reference": "var(--spine-reference)",
  "Religion": "var(--spine-religion)",
  "Satire": "var(--spine-satire)",
  "School Life": "var(--spine-school)",
  "Science & Technology": "var(--spine-science)",
  "Science Fiction": "var(--spine-scifi)",
  "Screenplays": "var(--spine-screenplay)",
  "Self-Help & Psychology": "var(--spine-psychology)",
  "Short Stories": "var(--spine-short)",
  "Slice of Life": "var(--spine-slice)",
  "Social Science": "var(--spine-social)",
  "Sociology": "var(--spine-sociology)",
  "Space": "var(--spine-space)",
  "Spirituality": "var(--spine-spirituality)",
  "Sports": "var(--spine-sports)",
  "Steampunk": "var(--spine-steampunk)",
  "Survival": "var(--spine-survival)",
  "Suspense": "var(--spine-suspense)",
  "Technology": "var(--spine-tech)",
  "Textbooks": "var(--spine-textbook)",
  "Theatre": "var(--spine-arts)",
  "Time Travel": "var(--spine-timetravel)",
  "Travel": "var(--spine-travel)",
  "Urban Fiction": "var(--spine-urban)",
  "War": "var(--spine-war)",
  "Western": "var(--spine-western)",
  "Wildlife": "var(--spine-wildlife)",
  "Women's Fiction": "var(--spine-womens)",
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
