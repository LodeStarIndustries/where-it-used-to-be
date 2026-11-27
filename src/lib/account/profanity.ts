// Blocks offensive display names. Uses the obscenity package's English word list,
// which also catches common disguises (f4ck, fuuuck) while leaving ordinary words
// alone (Scunthorpe, Cockburn, Hancock).
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";

/** Real names and words the word list would otherwise catch. Add to this as reports come in. */
const allowed = ["dickson", "dickinson", "dickens", "dickey", "dickie", "penistone"];

const built = englishDataset.build();
const matcher = new RegExpMatcher({
  ...built,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...allowed],
  ...englishRecommendedTransformers,
});

export function isOffensive(text: string): boolean {
  // Also check with punctuation inside words removed, so "s.h.i.t" and "f-u-c-k" are caught.
  return matcher.hasMatch(text) || matcher.hasMatch(text.replace(/[.\-_*'"`~^+|]+/g, ""));
}
