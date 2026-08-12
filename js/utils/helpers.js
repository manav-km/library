export const MAIN_FILTER_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Dystopian",
  "Fantasy",
  "Mystery & Thriller",
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
  "Action & Adventure",
  "Biography & Memoir",
  "Children's & Middle Grade",
  "Classics",
  "Comics & Graphic Novels",
  "Drama & Romance",
  "Fantasy",
  "Fiction",
  "History & Politics",
  "Horror & Dark Fiction",
  "Humor & Satire",
  "Mystery & Thriller",
  "Non-Fiction",
  "Philosophy & Ethics",
  "Poetry & Plays",
  "Religion & Spirituality",
  "Science & Technology",
  "Dystopian",
  "Self-Help & Psychology",
  "Young Adult (YA)"
];

const GENRE_SPINES = {
  "Fiction": "var(--spine-fiction)",
  "Non-Fiction": "var(--spine-nonfiction)",
  "Dystopian": "var(--spine-scifi)",
  "Fantasy": "var(--spine-fantasy)",
  "Mystery & Thriller": "var(--spine-mystery)",
  "Mystery": "var(--spine-mystery)",
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

/**
 * Renders a genre chip picker inside `container`.
 * Main genres are shown upfront; remaining genres appear after "Show More".
 * Returns { getSelected } — call getSelected() to get the current array of chosen genres.
 * Pass `initialSelected` (array) to pre-select genres when editing a profile.
 */
export function initGenreChipPicker(container, initialSelected = []) {
  if (!container) return { getSelected: () => [] };

  const OTHER_GENRES = ALL_GENRES.filter((g) => !MAIN_FILTER_GENRES.includes(g));
  let expanded = false;
  const selected = new Set(initialSelected);

  function render() {
    const visible = expanded
      ? [...MAIN_FILTER_GENRES, ...OTHER_GENRES]
      : MAIN_FILTER_GENRES;

    container.innerHTML = "";

    visible.forEach((genre) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "genre-chip" + (selected.has(genre) ? " selected" : "");
      chip.textContent = genre;
      chip.addEventListener("click", () => {
        if (selected.has(genre)) {
          selected.delete(genre);
          chip.classList.remove("selected");
        } else {
          selected.add(genre);
          chip.classList.add("selected");
        }
      });
      container.appendChild(chip);
    });

    // Show More / Show Less toggle
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "genre-chip show-more-chip";
    toggle.textContent = expanded ? "Show Less ∧" : "Show More ∨";
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      render();
    });
    container.appendChild(toggle);
  }

  render();
  return { getSelected: () => [...selected] };
}

