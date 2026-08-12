// ==========================================================================
// Profanity & Inappropriate Content Filter Rules
// ==========================================================================

const BANNED_WORDS = new Set([
  // Core profanities & slurs
  "fuck", "shit", "bitch", "ass", "slut", "nigger", "motherfucker", "fucker",
  "sex", "porn", "xxx", "bastard", "cunt", "dick", "pussy", "whore", "asshole",
  "bollocks", "bugger", "choad", "crikey", "crap", "fag", "faggot", "goddam",
  "goddamn", "hell", "jackass", "kike", "piss", "prick", "retard", "scrotum",
  "shag", "spack", "twat", "wank", "wanker", "dyke", "cooter", "cum", "ejaculation",
  "orgasm", "penis", "vagina", "clitoris", "blowjob", "handjob", "tit", "tits",
  "boob", "boobs", "breast", "breasts", "dumbass", "dipshit", "dumbshit", "horseshit",
  "bullshit", "jackshit", "wop", "wetback", "spic", "chink", "gook", "coon",
  "bastard", "twatwaffle", "douche", "douchebag", "prick", "tosser", "bellend",
  "knob", "knobhead", "skank", "slutty", "slutspammer", "biatch", "crapface", "fux",
  "hentai", "milf", "erotic", "libido", "nude", "naked", "prostitute",
  "arse", "arsehole", "suck", "sucks", "cock"
]);

/**
 * Checks a text string for banned words/profanity.
 * Returns true if the text contains any of the banned words (case-insensitive).
 */
export function hasBadWords(text) {
  if (!text) return false;
  // Replace punctuation with spaces to isolate words
  const cleanText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, " ");
  const words = cleanText.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (BANNED_WORDS.has(word)) {
      return true;
    }
  }
  return false;
}

/**
 * Replaces bad words in a message with asterisks (e.g. "****") for clean display.
 */
export function cleanProfanity(text) {
  if (!text) return "";
  let cleaned = text;

  // Sort by length descending to replace longer phrases/words first
  const sortedBanned = Array.from(BANNED_WORDS).sort((a, b) => b.length - a.length);

  sortedBanned.forEach((word) => {
    // Match word boundaries to prevent censoring matching parts of clean words (like 'classic' containing 'ass')
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(regex, "*".repeat(word.length));
  });

  return cleaned;
}
