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
    check: ({ reviewCount }) => reviewCount >= 1,
  },
  {
    id: "bookworm",
    icon: "📚",
    title: "Bookworm",
    description: "Write 5 book reviews.",
    check: ({ reviewCount }) => reviewCount >= 5,
  },
  {
    id: "critic",
    icon: "⭐",
    title: "Critic",
    description: "Write 10 book reviews.",
    check: ({ reviewCount }) => reviewCount >= 10,
  },
  {
    id: "top_reviewer",
    icon: "🏆",
    title: "Top Reviewer",
    description: "Write 25 book reviews.",
    check: ({ reviewCount }) => reviewCount >= 25,
  },
  {
    id: "conversationalist",
    icon: "💬",
    title: "Conversationalist",
    description: "Send your first message in a discussion.",
    check: ({ messageCount }) => messageCount >= 1,
  },
  {
    id: "discussion_leader",
    icon: "🗣️",
    title: "Discussion Leader",
    description: "Send 25 messages in discussions.",
    check: ({ messageCount }) => messageCount >= 25,
  },
  {
    id: "shelf_builder",
    icon: "🗂️",
    title: "Shelf Builder",
    description: "Create your first reading list with at least one book.",
    check: ({ shelfBookCount }) => shelfBookCount >= 1,
  },
  {
    id: "wide_reader",
    icon: "🌐",
    title: "Wide Reader",
    description: "Have books across 3 or more different genres in your reading lists.",
    check: ({ shelfGenreCount }) => shelfGenreCount >= 3,
  },
  {
    id: "book_explorer",
    icon: "🔭",
    title: "Book Explorer",
    description: "View 10 or more unique books.",
    check: ({ viewedCount }) => viewedCount >= 10,
  },
  {
    id: "challenge_champion",
    icon: "🎯",
    title: "Challenge Champion",
    description: "Successfully complete a Reading Challenge.",
    check: ({ completedChallenges }) => completedChallenges >= 1,
  },
];

/**
 * Checks which achievements should be unlocked and awards new ones.
 *
 * @param {object} profile - The current user profile from Firestore.
 * @param {object} stats - { reviewCount, messageCount, shelfBookCount, shelfGenreCount, viewedCount, completedChallenges }
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
