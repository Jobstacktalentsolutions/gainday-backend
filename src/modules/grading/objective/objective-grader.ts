import { z } from 'zod';
import {
  numericInputSchema,
  journalEntrySchema,
  numericTableSchema,
  keyedClassificationSchema,
  multiSelectUnderConstraintSchema,
  OBJECTIVE_RESPONSE_SCHEMAS,
  reconciliationSchema,
} from '../../generation/roles/component-schemas';
import { ObjectiveComponentType } from '../../generation/roles/role-module.interface';

export interface ObjectiveGradeResult {
  /** Whole number 0-100: correct parts over total parts. */
  score: number;
  correctParts: number;
  totalParts: number;
}

// Component types whose stored answer key lets code grade the response exactly (finance doc
// Section 6.2). The other types have no key by design and stay with the LLM grader.
const DETERMINISTIC_TYPES: ReadonlySet<ObjectiveComponentType> = new Set<ObjectiveComponentType>([
  'NUMERIC_INPUT',
  'RECONCILIATION',
  'JOURNAL_ENTRY',
  'NUMERIC_TABLE',
  'MULTI_SELECT_UNDER_CONSTRAINT',
  'KEYED_CLASSIFICATION',
]);

export function isDeterministic(type: ObjectiveComponentType): boolean {
  return DETERMINISTIC_TYPES.has(type);
}

function toResult(correctParts: number, totalParts: number): ObjectiveGradeResult {
  return {
    score: Math.round((correctParts / totalParts) * 100),
    correctParts,
    totalParts,
  };
}

function withinTolerance(answer: number | null, correct: number, tolerance: number): boolean {
  return answer !== null && Math.abs(answer - correct) <= tolerance;
}

function gradeNumericInput(
  component: z.infer<typeof numericInputSchema>,
  response: number | null,
): ObjectiveGradeResult {
  const correct = withinTolerance(response, component.correctValue, component.tolerance);
  return toResult(correct ? 1 : 0, 1);
}

function gradeReconciliation(
  component: z.infer<typeof reconciliationSchema>,
  response: { sides: (string | null)[]; adjustedBalance: number | null } | null,
): ObjectiveGradeResult {
  const sides = response ? response.sides : [];
  const correctSides = component.correctSides.filter(
    (correct, index) => sides[index] === correct,
  ).length;
  const balanceCorrect =
    response !== null &&
    withinTolerance(response.adjustedBalance, component.adjustedBalance, component.tolerance);
  // Each item's side is one part; the adjusted balance is one more.
  return toResult(correctSides + (balanceCorrect ? 1 : 0), component.items.length + 1);
}

type JournalLine = z.infer<typeof journalEntrySchema>['entries'][number]['lines'][number];
type AnswerLine = {
  reference: string;
  account: string | null;
  side: 'DEBIT' | 'CREDIT' | null;
  amount: number | null;
};

// An entry is right when the candidate's lines for it are exactly the key's lines: same accounts,
// sides and amounts, each matched once. Lines for references the key does not contain are ignored.
function entryMatches(
  keyLines: JournalLine[],
  answerLines: AnswerLine[],
  tolerance: number,
): boolean {
  if (keyLines.length !== answerLines.length) return false;
  const remaining = [...answerLines];
  return keyLines.every((keyLine) => {
    const index = remaining.findIndex(
      (line) =>
        line.account === keyLine.account &&
        line.side === keyLine.side &&
        withinTolerance(line.amount, keyLine.amount, tolerance),
    );
    if (index === -1) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function gradeJournalEntry(
  component: z.infer<typeof journalEntrySchema>,
  response: { lines: AnswerLine[] } | null,
): ObjectiveGradeResult {
  const lines = response ? response.lines : [];
  const correctEntries = component.entries.filter((entry) =>
    entryMatches(
      entry.lines,
      lines.filter((line) => line.reference === entry.reference),
      component.tolerance,
    ),
  ).length;
  return toResult(correctEntries, component.entries.length);
}

function gradeNumericTable(
  component: z.infer<typeof numericTableSchema>,
  response: { values: (number | null)[][] } | null,
): ObjectiveGradeResult {
  const cells = component.rowLabels.flatMap((_row, rowIndex) =>
    component.columns.map((column, columnIndex) => {
      const answer = response ? response.values[rowIndex]?.[columnIndex] : undefined;
      const correct = component.correctValues[rowIndex][columnIndex];
      return withinTolerance(answer ?? null, correct, column.tolerance);
    }),
  );
  return toResult(cells.filter(Boolean).length, cells.length);
}

// Each correct pick earns one part; a wrong pick cancels one, never below zero.
function gradeMultiSelect(
  component: z.infer<typeof multiSelectUnderConstraintSchema>,
  response: number[] | null,
): ObjectiveGradeResult {
  const selected = response ?? [];
  const hits = selected.filter((index) => component.correctOptionIndices.includes(index)).length;
  const wrong = selected.length - hits;
  return toResult(Math.max(0, hits - wrong), component.correctOptionIndices.length);
}

function gradeKeyedClassification(
  component: z.infer<typeof keyedClassificationSchema>,
  response: Record<string, string> | null,
): ObjectiveGradeResult {
  const correct = component.correctMapping.filter(
    ({ item, bucket }) => response !== null && response[item] === bucket,
  ).length;
  return toResult(correct, component.correctMapping.length);
}

/**
 * Grades a candidate's objective answer against the stored answer key, with partial credit per
 * part. Returns null for component types that have no key, so the caller hands them to the LLM.
 * The stored component and the response are both parsed here, so an unexpected shape fails loudly.
 */
export function gradeObjective(
  type: ObjectiveComponentType,
  storedComponent: Record<string, unknown>,
  objectiveResponse: unknown,
): ObjectiveGradeResult | null {
  if (!isDeterministic(type)) return null;
  const response = OBJECTIVE_RESPONSE_SCHEMAS[type].parse(objectiveResponse);

  switch (type) {
    case 'NUMERIC_INPUT':
      return gradeNumericInput(numericInputSchema.parse(storedComponent), response);
    case 'RECONCILIATION':
      return gradeReconciliation(reconciliationSchema.parse(storedComponent), response);
    case 'JOURNAL_ENTRY':
      return gradeJournalEntry(journalEntrySchema.parse(storedComponent), response);
    case 'MULTI_SELECT_UNDER_CONSTRAINT':
      return gradeMultiSelect(multiSelectUnderConstraintSchema.parse(storedComponent), response);
    case 'KEYED_CLASSIFICATION':
      return gradeKeyedClassification(keyedClassificationSchema.parse(storedComponent), response);
    case 'NUMERIC_TABLE':
      return gradeNumericTable(numericTableSchema.parse(storedComponent), response);
    default:
      return null;
  }
}
