import { Pronouns } from '../../db/schema';

interface PronounForms {
  subject: string;
  object: string;
  possessive: string;
  reflexive: string;
  /** he/she take third-person-singular verbs ("is", "has"); singular they keeps "are", "have". */
  singularVerbs: boolean;
}

const PRONOUN_FORMS: Record<Pronouns, PronounForms> = {
  HE_HIM: {
    subject: 'he',
    object: 'him',
    possessive: 'his',
    reflexive: 'himself',
    singularVerbs: true,
  },
  SHE_HER: {
    subject: 'she',
    object: 'her',
    possessive: 'her',
    reflexive: 'herself',
    singularVerbs: true,
  },
  THEY_THEM: {
    subject: 'they',
    object: 'them',
    possessive: 'their',
    reflexive: 'themself',
    singularVerbs: false,
  },
};

const APOS = `['’]`;

// "you <verb>" phrases whose verb changes for he/she; `{s}` is the subject pronoun. Checked
// before the plain pronoun replacements so the verb isn't left agreeing with "you".
const VERB_PHRASES: { pattern: RegExp; singular: string; plural: string }[] = [
  { pattern: /\byou are\b/gi, singular: '{s} is', plural: '{s} are' },
  { pattern: new RegExp(`\\byou${APOS}re\\b`, 'gi'), singular: '{s} is', plural: "{s}'re" },
  { pattern: /\byou were\b/gi, singular: '{s} was', plural: '{s} were' },
  { pattern: /\byou have\b/gi, singular: '{s} has', plural: '{s} have' },
  { pattern: new RegExp(`\\byou${APOS}ve\\b`, 'gi'), singular: '{s} has', plural: "{s}'ve" },
  { pattern: /\byou do not\b/gi, singular: '{s} does not', plural: '{s} do not' },
  { pattern: new RegExp(`\\byou don${APOS}t\\b`, 'gi'), singular: "{s} doesn't", plural: "{s} don't" },
  { pattern: /\byou do\b/gi, singular: '{s} does', plural: '{s} do' },
];

// Words after which a lowercase "you" is still the subject ("...and you chose..."), rather than
// an object ("...gave you...").
const SUBJECT_LEADERS =
  /\b(and|but|that|because|so|if|when|while|as|since|although|though|which|whether|how|what|where)\s+you\b/gi;

const matchCase = (source: string, replacement: string) =>
  source[0] === source[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;

/**
 * The grader writes each task summary to the candidate ("You..."); employers read the same text
 * about the candidate, so "you" is swapped for the candidate's pronouns. A plain string
 * replacement (no model call), so unusual phrasing can still slip through. Without pronouns on
 * file (a guest, or a profile not yet completed) the neutral singular "they" is used.
 */
export function rewriteSecondPersonForEmployer(
  text: string,
  pronouns: Pronouns | null,
): string {
  const forms = PRONOUN_FORMS[pronouns ?? Pronouns.THEY_THEM];

  let result = text;
  for (const { pattern, singular, plural } of VERB_PHRASES) {
    const template = forms.singularVerbs ? singular : plural;
    result = result.replace(pattern, (match) =>
      matchCase(match, template.replace('{s}', forms.subject)),
    );
  }

  return result
    .replace(SUBJECT_LEADERS, (_match, leader: string) => `${leader} ${forms.subject}`)
    .replace(/\byourself\b/gi, (match) => matchCase(match, forms.reflexive))
    .replace(/\byour\b/gi, (match) => matchCase(match, forms.possessive))
    .replace(/\bYou\b/g, forms.subject.charAt(0).toUpperCase() + forms.subject.slice(1))
    .replace(/\byou\b/g, forms.object);
}
