/**
 * Counts words the way a reader sees them: tokens with a letter or a digit. Markdown table
 * separators, bullets and dashes are not words, so they do not count against a word limit.
 */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
