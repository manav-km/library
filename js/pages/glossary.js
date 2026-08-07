import { requireAuth } from "../firebase/auth.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, qs, qsa } from "../utils/helpers.js";
import { GLOSSARY_DATA } from "../data/glossaryData.js";

const profile = await requireAuth();
renderNavbar(profile, "glossary.html");

let activeCategory = "all";
let activeLetter = "all";
let searchTerm = "";
let fetchDebounceTimer = null;

function categoryBadge(category = "") {
  if (category === "Genre") {
    return `<span class="badge" style="background:rgba(34,211,238,0.15); color:var(--cyan-400); border:1px solid rgba(34,211,238,0.3);">Genre</span>`;
  }
  if (category === "Literary Term") {
    return `<span class="badge" style="background:rgba(124,140,248,0.15); color:var(--spine-fiction); border:1px solid rgba(124,140,248,0.3);">Literary Term</span>`;
  }
  if (category.startsWith("English")) {
    return `<span class="badge" style="background:rgba(52,211,153,0.15); color:#34d399; border:1px solid rgba(52,211,153,0.3);">${escapeHTML(category)}</span>`;
  }
  return `<span class="badge" style="background:rgba(167,139,250,0.15); color:var(--spine-scifi); border:1px solid rgba(167,139,250,0.3);">${escapeHTML(category)}</span>`;
}

function renderAlphabetBar() {
  const mount = qs("#alphabet-bar");
  if (!mount) return;

  const letters = ["all", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  mount.innerHTML = letters.map((l) => `
    <button class="letter-chip ${activeLetter === l ? 'active' : ''}" data-letter="${l}">
      ${l === 'all' ? 'All A-Z' : l}
    </button>
  `).join("");

  qsa(".letter-chip", mount).forEach((chip) => {
    chip.addEventListener("click", () => {
      qsa(".letter-chip", mount).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeLetter = chip.dataset.letter;
      applyFilters();
    });
  });
}

function renderGlossary(list) {
  const mount = qs("#glossary-grid");
  const countEl = qs("#glossary-count");

  if (countEl) {
    countEl.textContent = `Showing ${list.length} ${list.length === 1 ? "definition" : "definitions"}`;
  }

  if (!mount) return;

  if (!list.length) {
    mount.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No terms found</h3>
        <p>No words or definitions matched your search term or letter filter.</p>
      </div>
    `;
    return;
  }

  mount.innerHTML = list.map((item) => `
    <div class="glossary-card">
      <div>
        <div class="glossary-card-header">
          <h3 class="glossary-word">${escapeHTML(item.word)}</h3>
          ${categoryBadge(item.category)}
        </div>
        <p class="glossary-def">${escapeHTML(item.definition)}</p>
      </div>

      <div class="glossary-meta-row">
        <div class="glossary-meta-group">
          <span class="glossary-meta-label">Synonyms</span>
          <div class="flex items-center gap-2 flex-wrap">
            ${(item.synonyms || []).map((s) => `<span class="syn-tag">${escapeHTML(s)}</span>`).join("")}
          </div>
        </div>
        <div class="glossary-meta-group">
          <span class="glossary-meta-label">Antonyms</span>
          <div class="flex items-center gap-2 flex-wrap">
            ${(item.antonyms || []).map((a) => `<span class="ant-tag">${escapeHTML(a)}</span>`).join("")}
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

async function fetchFromEnglishDictionary(term) {
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm || cleanTerm.length < 2 || cleanTerm.includes(" ")) return [];

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanTerm)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return [];

    const entry = data[0];
    const primaryMeaning = (entry.meanings && entry.meanings[0]) || {};
    const primaryDef = (primaryMeaning.definitions && primaryMeaning.definitions[0]) || {};

    if (!primaryDef.definition) return [];

    const allSynonyms = [];
    const allAntonyms = [];

    (entry.meanings || []).forEach((m) => {
      if (m.synonyms) allSynonyms.push(...m.synonyms);
      if (m.antonyms) allAntonyms.push(...m.antonyms);
      (m.definitions || []).forEach((d) => {
        if (d.synonyms) allSynonyms.push(...d.synonyms);
        if (d.antonyms) allAntonyms.push(...d.antonyms);
      });
    });

    const synonyms = [...new Set(allSynonyms)].slice(0, 2);
    const antonyms = [...new Set(allAntonyms)].slice(0, 2);

    return [{
      word: entry.word ? entry.word.charAt(0).toUpperCase() + entry.word.slice(1) : term,
      category: `English (${primaryMeaning.partOfSpeech || "dictionary"})`,
      definition: primaryDef.definition,
      synonyms: synonyms.length ? synonyms : ["Similar term", "Equivalent"],
      antonyms: antonyms.length ? antonyms : ["Opposite term", "Inverse"]
    }];
  } catch (err) {
    console.warn("English Dictionary API fetch failed:", err);
    return [];
  }
}

function applyFilters() {
  const term = searchTerm.toLowerCase().trim();

  let filtered = GLOSSARY_DATA.filter((item) => {
    const catMatch = activeCategory === "all"
                  || item.category === activeCategory
                  || (activeCategory === "English Dictionary" && item.category.startsWith("English"));
    if (!catMatch) return false;

    if (activeLetter !== "all") {
      const firstChar = item.word.trim().charAt(0).toUpperCase();
      if (firstChar !== activeLetter) return false;
    }

    if (!term) return true;

    const wordMatch = item.word.toLowerCase().includes(term);
    const defMatch = item.definition.toLowerCase().includes(term);
    const synMatch = (item.synonyms || []).some((s) => s.toLowerCase().includes(term));
    const antMatch = (item.antonyms || []).some((a) => a.toLowerCase().includes(term));
    const catSearchMatch = item.category.toLowerCase().includes(term);

    return wordMatch || defMatch || synMatch || antMatch || catSearchMatch;
  });

  renderGlossary(filtered);

  if (term.length >= 2 && !term.includes(" ")) {
    clearTimeout(fetchDebounceTimer);
    fetchDebounceTimer = setTimeout(async () => {
      const apiResults = await fetchFromEnglishDictionary(term);
      if (apiResults.length && searchTerm.toLowerCase().trim() === term) {
        const existingWords = new Set(filtered.map((f) => f.word.toLowerCase()));
        const uniqueApi = apiResults.filter((api) => !existingWords.has(api.word.toLowerCase()));

        if (uniqueApi.length) {
          filtered = [...filtered, ...uniqueApi].sort((a, b) => a.word.localeCompare(b.word));
          renderGlossary(filtered);
        }
      }
    }, 300);
  }
}

// Category filter chips
qsa(".genre-chip", qs("#category-chips")).forEach((chip) => {
  chip.addEventListener("click", () => {
    qsa(".genre-chip", qs("#category-chips")).forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeCategory = chip.dataset.cat;
    applyFilters();
  });
});

// Full-text search input
const searchInput = qs("#glossary-search");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    applyFilters();
  });
}

// Initial render
renderAlphabetBar();
applyFilters();
