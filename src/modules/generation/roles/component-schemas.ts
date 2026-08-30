import { z } from 'zod';
import {
  ObjectiveComponentType,
  OpenEndedComponentType,
} from './role-module.interface';

/**
 * Gemini's structured-output API (response_schema) only accepts fixed, enumerated object
 * shapes — it rejects Zod's z.record()/arbitrary-key maps with a 400 ("Proto field is not
 * repeating, cannot start list"). objectiveComponent/openEndedComponent genuinely differ in
 * shape per component type (a numeric tolerance range vs. classification buckets vs. ordered
 * steps), so each gets its own concrete schema here — mirrors how INTERFACE_SCHEMAS gives every
 * InterfaceType a real payload contract in interface-type.ts.
 */

const numericInputSchema = z.object({
  correctValue: z.number(),
  tolerance: z
    .number()
    .describe('Acceptable +/- range around correctValue for a correct answer.'),
  // Required + nullable, not .optional() — see interface-type.ts for why: models emit
  // explicit null for unfilled fields, and .optional().nullable() breaks both Gemini's and
  // Groq's schema validators (produces an anyOf/not shape neither accepts).
  unit: z.string().nullable(),
});

const classificationSchema = z.object({
  items: z.array(z.string()).describe('Items the candidate must classify.'),
  buckets: z.array(z.string()).describe('Valid classification buckets.'),
  correctMapping: z
    .array(z.object({ item: z.string(), bucket: z.string() }))
    .describe('The correct item -> bucket assignment for grading.'),
});

const proceduralSequencingSchema = z.object({
  steps: z
    .array(z.string())
    .describe('Steps to be ordered, shuffled for presentation.'),
  correctOrder: z
    .array(z.number())
    .describe('0-indexed positions into `steps` giving the correct order.'),
});

const singleBestActionSchema = z.object({
  options: z.array(z.string()).min(2),
  correctOptionIndex: z
    .number()
    .describe('0-indexed position of the correct option.'),
});

const multiSelectUnderConstraintSchema = z.object({
  options: z.array(z.string()).min(2),
  selectCount: z
    .number()
    .describe('How many options the candidate must select.'),
  correctOptionIndices: z
    .array(z.number())
    .describe('0-indexed positions of the ideal selection set.'),
});

export const OBJECTIVE_COMPONENT_SCHEMAS: Record<
  ObjectiveComponentType,
  z.ZodTypeAny
> = {
  NUMERIC_INPUT: numericInputSchema,
  CLASSIFICATION: classificationSchema,
  PROCEDURAL_SEQUENCING: proceduralSequencingSchema,
  SINGLE_BEST_ACTION: singleBestActionSchema,
  MULTI_SELECT_UNDER_CONSTRAINT: multiSelectUnderConstraintSchema,
};

const writtenJustificationSchema = z.object({
  decisionAlreadyMade: z
    .string()
    .describe('The decision the candidate must justify in writing.'),
});

const draftedCommunicationSchema = z.object({
  recipient: z
    .string()
    .describe('Who the drafted message/summary is addressed to.'),
  goal: z.string().describe('What the communication needs to accomplish.'),
});

const interpretationAnalysisSchema = z.object({
  dataToInterpret: z
    .string()
    .describe('The data/scenario the candidate must interpret or analyze.'),
});

const stakeholderPushbackResponseSchema = z.object({
  pushbackStatement: z
    .string()
    .describe(
      "The stakeholder's pushback/objection the candidate must respond to.",
    ),
});

export const OPEN_ENDED_COMPONENT_SCHEMAS: Record<
  OpenEndedComponentType,
  z.ZodTypeAny
> = {
  WRITTEN_JUSTIFICATION: writtenJustificationSchema,
  DRAFTED_COMMUNICATION: draftedCommunicationSchema,
  INTERPRETATION_ANALYSIS: interpretationAnalysisSchema,
  STAKEHOLDER_PUSHBACK_RESPONSE: stakeholderPushbackResponseSchema,
};
