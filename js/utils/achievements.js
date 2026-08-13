// ==========================================================================
// Achievements — SAJS Library Site
// Computed client-side; unlocked states stored in user's Firestore doc.
// ==========================================================================

import { updateUserProfile } from "../firebase/firestore.js";
import { showToast } from "./helpers.js";

/** Master list of all achievements. */
export const ALL_ACHIEVEMENTS = [
  {
    id: "first_review",
    icon: "📝",
    title: "First Review",
    description: "Write your very first book review.",
    check: ({ reviewCount }) => (reviewCount || 0) >= 1,
  },
  {
    id: "bookworm",
    icon: "📚",
    title: "Bookworm",
    description: "Write 5 book reviews.",
    check: ({ reviewCount }) => (reviewCount || 0) >= 5,
  },
  {
    id: "critic",
    icon: "⭐",
    title: "Critic",
    description: "Write 10 book reviews.",
    check: ({ reviewCount }) => (reviewCount || 0) >= 10,
  },
  {
    id: "top_reviewer",
    icon: "🏆",
    title: "Top Reviewer",
    description: "Write 25 book reviews.",
    check: ({ reviewCount }) => (reviewCount || 0) >= 25,
  },
  {
    id: "five_star_critic",
    icon: "🌟",
    title: "Stellar Rating",
    description: "Give a 5-star rating to a book.",
    check: ({ hasFiveStarReview }) => !!hasFiveStarReview,
  },
  {
    id: "page_turner",
    icon: "📖",
    title: "Page Turner",
    description: "Read over 50 pages across your tracked books.",
    check: ({ totalPagesRead }) => (totalPagesRead || 0) >= 50,
  },
  {
    id: "first_finish",
    icon: "🏁",
    title: "Finish Line",
    description: "Finish reading your first book.",
    check: ({ finishedBooks }) => (finishedBooks || 0) >= 1,
  },
  {
    id: "master_reader",
    icon: "🎓",
    title: "Master Reader",
    description: "Finish reading 5 books.",
    check: ({ finishedBooks }) => (finishedBooks || 0) >= 5,
  },
  {
    id: "conversationalist",
    icon: "💬",
    title: "Conversationalist",
    description: "Send your first message in a discussion.",
    check: ({ messageCount }) => (messageCount || 0) >= 1,
  },
  {
    id: "discussion_leader",
    icon: "🗣️",
    title: "Discussion Leader",
    description: "Send 25 messages in discussions.",
    check: ({ messageCount }) => (messageCount || 0) >= 25,
  },
  {
    id: "shelf_builder",
    icon: "🗂️",
    title: "Shelf Builder",
    description: "Create your first reading list with at least one book.",
    check: ({ shelfBookCount }) => (shelfBookCount || 0) >= 1,
  },
  {
    id: "wide_reader",
    icon: "🌐",
    title: "Wide Reader",
    description: "Have books across 3 or more different genres in your reading lists.",
    check: ({ shelfGenreCount }) => (shelfGenreCount || 0) >= 3,
  },
  {
    id: "book_explorer",
    icon: "🔭",
    title: "Book Explorer",
    description: "View 10 or more unique books.",
    check: ({ viewedCount }) => (viewedCount || 0) >= 10,
  },
  {
    id: "challenge_champion",
    icon: "🎯",
    title: "Challenge Champion",
    description: "Successfully complete a Reading Challenge.",
    check: ({ completedChallenges }) => (completedChallenges || 0) >= 1,
  },
  {
    id: "book_borrower",
    icon: "📋",
    title: "Library Borrower",
    description: "Request to issue a book from the library.",
    check: ({ issueCount }) => (issueCount || 0) >= 1,
  },
];

/**
 * Checks which achievements should be unlocked and awards new ones.
 *
 * @param {object} profile - The current user profile from Firestore.
 * @param {object} stats - { reviewCount, messageCount, shelfBookCount, shelfGenreCount, viewedCount, completedChallenges, totalPagesRead, finishedBooks, hasFiveStarReview, issueCount }
 * @returns {string[]} Array of newly awarded achievement IDs.
 */
export async function checkAndAwardAchievements(profile, stats) {
  if (!profile?.uid) return [];

  const already = new Set(Array.isArray(profile.achievements) ? profile.achievements : []);
  const newlyEarned = [];

  for (const achievement of ALL_ACHIEVEMENTS) {
    if (!already.has(achievement.id) && achievement.check(stats)) {
      newlyEarned.push(achievement.id);
    }
  }

  if (newlyEarned.length > 0) {
    const updated = [...already, ...newlyEarned];
    await updateUserProfile(profile.uid, { achievements: updated });
    // Update local profile object so in-memory state is immediately consistent!
    profile.achievements = updated;

    // Show a toast for each new achievement
    for (const id of newlyEarned) {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      if (ach) {
        showToast(`🏅 Achievement unlocked: ${ach.icon} ${ach.title}`, "success");
      }
    }
  }

  return newlyEarned;
}
