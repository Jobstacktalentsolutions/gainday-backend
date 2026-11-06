interface PointerForms {
  subject: string;
  object: string;
  possessive: string;
  reflexive: string;
}

const FORMS: PointerForms = {
  subject: 'this candidate',
  object: 'this candidate',
  possessive: "this candidate's",
  reflexive: 'themself',
};

const APOS = `['’]`;

// "you <verb>" phrases whose verb changes to singular ("is", "has", "does", etc.). Checked
// before plain replacements so the verb agrees with "this candidate".
const VERB_PHRASES: { pattern: RegExp; singular: string }[] = [
  { pattern: /\byou are\b/gi, singular: '{s} is' },
  { pattern: new RegExp(`\\byou${APOS}re\\b`, 'gi'), singular: '{s} is' },
  { pattern: /\byou were\b/gi, singular: '{s} was' },
  { pattern: /\byou have\b/gi, singular: '{s} has' },
  { pattern: new RegExp(`\\byou${APOS}ve\\b`, 'gi'), singular: '{s} has' },
  { pattern: /\byou do not\b/gi, singular: '{s} does not' },
  { pattern: new RegExp(`\\byou don${APOS}t\\b`, 'gi'), singular: "{s} doesn't" },
  { pattern: /\byou do\b/gi, singular: '{s} does' },
  { pattern: new RegExp(`\\byou${APOS}ll\\b`, 'gi'), singular: '{s} will' },
  { pattern: new RegExp(`\\byou${APOS}d\\b`, 'gi'), singular: '{s} would' },
];

// Words after which a lowercase "you" is still the subject ("...and you chose..."), rather than
// an object ("...gave you...").
const SUBJECT_LEADERS =
  /(\b(?:and|but|that|because|so|if|when|while|as|since|although|though|which|whether|how|what|where|once|after|before|until|unless|whenever|even)\s+|[,;:(]\s*)you\b/gi;

const matchCase = (source: string, replacement: string) =>
  source[0] === source[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;

/**
 * The grader writes each task summary to the candidate ("You..."); employers read the same text
 * about the candidate, so "you" is swapped for a general pointer ("This candidate").
 */
export function rewriteSecondPersonForEmployer(text: string): string {
  let result = text;
  for (const { pattern, singular } of VERB_PHRASES) {
    result = result.replace(pattern, (match) =>
      matchCase(match, singular.replace('{s}', FORMS.subject)),
    );
  }

  return result
    .replace(SUBJECT_LEADERS, (_match, leader: string) => `${leader}${FORMS.subject}`)
    .replace(/\byourself\b/gi, (match) => matchCase(match, FORMS.reflexive))
    .replace(/\byour\b/gi, (match) => matchCase(match, FORMS.possessive))
    .replace(/\bYou\b/g, FORMS.subject.charAt(0).toUpperCase() + FORMS.subject.slice(1))
    .replace(/\byou(?=['’](ll|d|ve|re|m)\b)/g, FORMS.subject)
    .replace(/\byou\b/g, FORMS.object);
}
