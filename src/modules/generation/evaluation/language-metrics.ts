/**
 * Measures how technical and how hard to read a task's text is, so seniority levels can be compared on
 * evidence. These are proxies: they count visible signs of jargon (code, acronyms, identifiers, paths)
 * and standard readability, not understanding.
 */

export interface LanguageMetrics {
  words: number;
  avgSentenceWords: number;
  /** Flesch reading ease: higher is easier. About 60 to 70 is plain English, below 30 is very hard. */
  readingEase: number;
  /** Code spans, acronyms, identifiers and paths, per 100 words. */
  technicalPer100Words: number;
  technicalExamples: string[];
}

const CODE_SPAN = /`[^`]+`/g;
const ACRONYM = /\b[A-Z]{2,}[A-Za-z]*\b/g;
const SNAKE_CASE = /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g;
const CAMEL_CASE = /\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/g;
const PATH = /(?<=^|[\s(])\/[A-Za-z0-9_{}:.-]+(?:\/[A-Za-z0-9_{}:.-]+)*/g;
/** Capitalised words that are ordinary English, not technical terms. */
const PLAIN_ACRONYMS = new Set(['OK', 'AM', 'PM', 'US', 'UK', 'FAQ']);

function matches(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}

function syllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return 0;
  const groups = cleaned.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function prose(text: string): string {
  return text
    .replace(CODE_SPAN, ' ')
    .replace(/[|#*_>~-]+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

export function languageMetrics(text: string): LanguageMetrics {
  const codeSpans = matches(text, CODE_SPAN);
  const withoutCode = text.replace(CODE_SPAN, ' ');
  const technical = [
    ...codeSpans,
    ...matches(withoutCode, ACRONYM).filter(
      (term) => !PLAIN_ACRONYMS.has(term),
    ),
    ...matches(withoutCode, SNAKE_CASE),
    ...matches(withoutCode, CAMEL_CASE),
    ...matches(withoutCode, PATH),
  ];

  const body = prose(text);
  const words = body.split(/\s+/).filter((token) => /[A-Za-z0-9]/.test(token));
  const sentences = body
    .split(/[.!?]+(?:\s|$)|\n+/)
    .filter((sentence) => /[A-Za-z0-9]/.test(sentence));
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);

  const readingEase =
    wordCount === 0
      ? 0
      : 206.835 -
        1.015 * (wordCount / sentenceCount) -
        84.6 * (syllableCount / wordCount);

  return {
    words: wordCount,
    avgSentenceWords: wordCount / sentenceCount,
    readingEase,
    technicalPer100Words:
      wordCount === 0 ? 0 : (technical.length / wordCount) * 100,
    technicalExamples: [...new Set(technical)].slice(0, 8),
  };
}
