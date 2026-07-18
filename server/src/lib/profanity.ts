import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

// Built once and reused — the dataset/transformer setup isn't free, and this
// matcher is stateless (safe to share across requests).
//
// Note: catches leetspeak (fu4k), repeated letters (fuuuck), and confusable
// unicode, but NOT profanity split by spaces/punctuation (f u c k) — that
// transformer is off by default upstream because it also inflates false
// positives elsewhere. Good enough for usernames (no spaces allowed) and a
// solid first line of defense for free-text display names/bios.
//
// No whitelistedTerms: in obscenity@0.4.6, passing ANY whitelist (even
// unrelated terms) changes how blacklist patterns match and introduces
// unrelated false positives — e.g. "assassin"/"shitake" started matching
// purely from whitelisting "cummings" for the unrelated Scunthorpe-problem
// surname collision. The plain blacklist alone doesn't have that bug, so we
// eat the well-known single-word collisions (e.g. the surname Cummings)
// rather than risk broader, less predictable ones. Accepted tradeoff: a
// handful of common words/names collide with the blacklist regardless
// (e.g. "Cummings", "cockpit") — standard behavior for any word-blacklist
// filter, and out of scope to chase perfectly here.
//
// Server-only deliberately: the word list itself is bundled with the
// package, and this must never ship in the public client JS.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/** True if `text` contains profanity. */
export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}
