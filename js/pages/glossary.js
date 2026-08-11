import { requireAuth } from "../firebase/auth.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHTML, qs, qsa } from "../utils/helpers.js";
import { GLOSSARY_DATA } from "../data/glossaryData.js";

const profile = await requireAuth();
renderNavbar(profile, "glossary.html");

// =============================================================================
//  Merriam-Webster Collegiate Dictionary API
//  Get your FREE key at: https://dictionaryapi.com/register/index
//  Paste it below — free tier allows 1,000 lookups/day.
// =============================================================================
const MW_API_KEY = "c551a93d-6bad-432f-b0da-8e970a6d1790";
const MW_ENABLED = !!MW_API_KEY;
// Session cache — avoids re-fetching the same word during a browsing session
const mwCache = new Map();

async function fetchMerriamWebster(word) {
  const clean = word.trim().toLowerCase();
  if (!clean || clean.length < 2) return null;
  if (mwCache.has(clean)) return mwCache.get(clean);

  try {
    const url = `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(clean)}?key=${MW_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { mwCache.set(clean, null); return null; }
    const data = await res.json();

    // MW returns an array; first element may be a string (suggestions) or an object (entry)
    if (!Array.isArray(data) || !data.length || typeof data[0] === "string") {
      mwCache.set(clean, null);
      return null;
    }

    const results = [];
    for (const entry of data.slice(0, 4)) {
      if (!entry.shortdef || !entry.fl) continue; // skip malformed entries

      const partOfSpeech = entry.fl; // e.g. "noun", "verb"
      const defs = (entry.shortdef || []).slice(0, 2);

      // Synonyms from `syns` field (some entries have it)
      let synonyms = [];
      if (entry.syns && entry.syns[0]?.pt) {
        synonyms = entry.syns[0].pt
          .filter(([type]) => type === "text")
          .flatMap(([, text]) => text.replace(/\{[^}]+\}/g, "").split(","))
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 2);
      }
      // Antonyms from `ants`
      let antonyms = [];
      if (entry.ants && entry.ants[0]?.pt) {
        antonyms = entry.ants[0].pt
          .filter(([type]) => type === "text")
          .flatMap(([, text]) => text.replace(/\{[^}]+\}/g, "").split(","))
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 2);
      }

      for (const def of defs) {
        // Strip MW markup tokens like {bc}, {sx|word||}, {a_link|word}, etc.
        const cleanDef = def
          .replace(/\{[^}]+\}/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (!cleanDef) continue;
        results.push({
          word: word.charAt(0).toUpperCase() + word.slice(1),
          category: `English (${partOfSpeech})`,
          definition: cleanDef.charAt(0).toUpperCase() + cleanDef.slice(1),
          synonyms: synonyms.length ? synonyms : ["—"],
          antonyms: antonyms.length ? antonyms : ["—"]
        });
      }
    }

    const out = results.length ? results : null;
    mwCache.set(clean, out);
    return out;
  } catch (err) {
    console.warn("Merriam-Webster fetch failed:", err);
    mwCache.set(clean, null);
    return null;
  }
}

// =============================================================================
//  State
// =============================================================================
let activeLetter = "all";
let searchTerm = "";
let mwDebounceTimer = null;
let currentLocalFiltered = [];

// =============================================================================
//  Badge helpers
// =============================================================================
function categoryBadge(category = "") {
  if (category === "Genre") {
    return `<span class="badge" style="background:rgba(34,211,238,0.15); color:var(--cyan-400); border:1px solid rgba(34,211,238,0.3);">Genre</span>`;
  }
  if (category === "Literary Term") {
    return `<span class="badge" style="background:rgba(124,140,248,0.15); color:var(--spine-fiction); border:1px solid rgba(124,140,248,0.3);">Literary Term</span>`;
  }
  if (category === "Library Term") {
    return `<span class="badge" style="background:rgba(251,191,36,0.15); color:var(--warning); border:1px solid rgba(251,191,36,0.3);">Library Term</span>`;
  }
  if (category.startsWith("English")) {
    return `<span class="badge" style="background:rgba(52,211,153,0.15); color:#34d399; border:1px solid rgba(52,211,153,0.3);">${escapeHTML(category)}</span>`;
  }
  return `<span class="badge" style="background:rgba(167,139,250,0.15); color:var(--spine-scifi); border:1px solid rgba(167,139,250,0.3);">${escapeHTML(category)}</span>`;
}

// =============================================================================
//  Alphabet bar
// =============================================================================
function renderAlphabetBar() {
  const mount = qs("#alphabet-bar");
  if (!mount) return;
  const letters = ["all", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  mount.innerHTML = letters.map((l) => `
    <button class="letter-chip ${activeLetter === l ? "active" : ""}" data-letter="${l}">
      ${l === "all" ? "All A-Z" : l}
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

// =============================================================================
//  Render card list
// =============================================================================
function renderGlossary(list, { append = false, mwSection = false } = {}) {
  const mount = qs("#glossary-grid");
  const countEl = qs("#glossary-count");

  if (!append) {
    if (countEl) {
      const total = list.length;
      countEl.textContent = `Showing ${total} ${total === 1 ? "definition" : "definitions"}`;
    }
    if (!mount) return;
    if (!list.length) {
      mount.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>No terms found</h3>
          <p>${MW_ENABLED ? "No results in local data. Searching Merriam-Webster…" : "No words matched your search."}</p>
        </div>
      `;
      return;
    }
    mount.innerHTML = "";
  } else {
    // If we're appending, make sure to remove any empty state that was shown while loading
    const emptyState = mount.querySelector(".empty-state");
    if (emptyState) emptyState.remove();
  }

  const fragment = document.createDocumentFragment();
  for (const item of list) {
    const card = document.createElement("div");
    card.className = "glossary-card" + (mwSection ? " mw-card" : "");
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2" style="margin-bottom:var(--sp-2);">
          <h3 class="glossary-word">${escapeHTML(item.word)}</h3>
          ${categoryBadge(item.category)}
        </div>
        <p class="glossary-def">${escapeHTML(item.definition)}</p>
      </div>
      <div class="glossary-meta-row">
        <div class="flex items-center gap-2 flex-wrap">
          <strong style="color:var(--text-tertiary);">Synonyms:</strong>
          ${(item.synonyms || []).filter(s => s && s !== "—").map((s) => `<span class="syn-ant-tag">${escapeHTML(s)}</span>`).join("") || '<span class="text-tertiary" style="font-size:var(--fs-tiny);">—</span>'}
        </div>
        <div class="flex items-center gap-2 flex-wrap" style="margin-top:2px;">
          <strong style="color:var(--text-tertiary);">Antonyms:</strong>
          ${(item.antonyms || []).filter(a => a && a !== "—").map((a) => `<span class="syn-ant-tag">${escapeHTML(a)}</span>`).join("") || '<span class="text-tertiary" style="font-size:var(--fs-tiny);">—</span>'}
        </div>
      </div>
    `;
    fragment.appendChild(card);
  }
  mount?.appendChild(fragment);
}

// =============================================================================
//  MW loading indicator
// =============================================================================
function showMWSpinner() {
  const mount = qs("#glossary-grid");
  if (!mount) return;
  const existing = mount.querySelector(".mw-spinner");
  if (existing) return;
  const el = document.createElement("div");
  el.className = "mw-spinner empty-state";
  el.style.cssText = "grid-column:1/-1; padding:var(--sp-4);";
  el.innerHTML = `<p style="color:var(--text-tertiary); font-size:var(--fs-small);">🔍 Searching Merriam-Webster…</p>`;
  mount.appendChild(el);
}
function hideMWSpinner() {
  qs(".mw-spinner")?.remove();
}

// =============================================================================
//  No-key notice
// =============================================================================
function maybeShowKeyNotice() {
  if (MW_ENABLED) return;
  const mount = qs("#glossary-grid");
  if (!mount) return;
  const existing = mount.querySelector(".mw-notice");
  if (existing) return;
  const el = document.createElement("div");
  el.className = "mw-notice";
  el.style.cssText = "grid-column:1/-1; text-align:center; padding:var(--sp-3) var(--sp-4); background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.2); border-radius:var(--radius-sm); font-size:var(--fs-small); color:var(--text-secondary);";
  el.innerHTML = `📖 <strong>Merriam-Webster not connected.</strong> Add your free API key in <code>js/pages/glossary.js</code> to search any English word. <a href="https://dictionaryapi.com/register/index" target="_blank" rel="noopener">Get a free key →</a>`;
  mount.prepend(el);
}

// =============================================================================
//  Filter + search
// =============================================================================
async function applyFilters() {
  const term = searchTerm.toLowerCase().trim();

  let filtered = GLOSSARY_DATA.filter((item) => {
    if (activeLetter !== "all") {
      if (item.word.trim().charAt(0).toUpperCase() !== activeLetter) return false;
    }
    if (!term) return true;
    return (
      item.word.toLowerCase().includes(term) ||
      item.definition.toLowerCase().includes(term) ||
      (item.synonyms || []).some((s) => s.toLowerCase().includes(term)) ||
      (item.antonyms || []).some((a) => a.toLowerCase().includes(term)) ||
      item.category.toLowerCase().includes(term)
    );
  });

  currentLocalFiltered = filtered;
  renderGlossary(filtered);

  // Only fire MW lookup when user is actually searching an exact word
  if (term.length >= 2 && !term.includes(" ") && MW_ENABLED) {
    clearTimeout(mwDebounceTimer);
    mwDebounceTimer = setTimeout(async () => {
      // Only query if local results are sparse (< 3) or the term isn't already a local word
      const alreadyExact = currentLocalFiltered.some(
        (f) => f.word.toLowerCase() === term
      );
      if (alreadyExact && currentLocalFiltered.length >= 3) return;

      showMWSpinner();
      const mwResults = await fetchMerriamWebster(term);
      hideMWSpinner();

      if (!mwResults || !mwResults.length) return;

      // De-duplicate against local results
      const localDefs = new Set(
        currentLocalFiltered.map((f) => f.definition.toLowerCase().slice(0, 30))
      );
      const unique = mwResults.filter(
        (r) => !localDefs.has(r.definition.toLowerCase().slice(0, 30))
      );
      if (!unique.length) return;

      // Only append if search term hasn't changed
      if (searchTerm.toLowerCase().trim() !== term) return;

      // Add a divider if we have local results too
      if (currentLocalFiltered.length > 0) {
        const mount = qs("#glossary-grid");
        if (mount) {
          const divider = document.createElement("div");
          divider.style.cssText = "grid-column:1/-1; border-top:1px solid var(--glass-border); padding-top:var(--sp-3); font-size:var(--fs-tiny); color:var(--text-tertiary); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.1em;";
          divider.textContent = "From Merriam-Webster";
          mount.appendChild(divider);
        }
      }

      renderGlossary(unique, { append: true, mwSection: true });

      // Update count
      const countEl = qs("#glossary-count");
      if (countEl) {
        const total = currentLocalFiltered.length + unique.length;
        countEl.textContent = `Showing ${total} ${total === 1 ? "definition" : "definitions"} (${unique.length} from Merriam-Webster)`;
      }
    }, 400);
  } else if (!MW_ENABLED && term.length >= 2) {
    maybeShowKeyNotice();
  }
}


// =============================================================================
//  Search input
// =============================================================================
const searchInput = qs("#glossary-search");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    applyFilters();
  });
}

// =============================================================================
//  Initial render
// =============================================================================
renderAlphabetBar();
applyFilters();
