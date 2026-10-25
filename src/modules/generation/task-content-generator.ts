import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QuestionBankTaskContent } from '../../db/schema/question-bank.schema';
import { taskGenerationSchema } from './schemas/task-generation.schema';
import { INTERFACE_SCHEMAS } from './roles/interface-type';
import {
  OBJECTIVE_COMPONENT_SCHEMAS,
  OPEN_ENDED_COMPONENT_SCHEMAS,
} from './roles/component-schemas';
import {
  RoleModule,
  TaskPatternTypeDefinition,
  TaskSpecTemplate,
} from './roles/role-module.interface';
import { taskSpecSchema } from './schemas/task-spec.schema';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';

/**
 * What the candidate reads must not coach them. Shared by the generate and modify prompts so the
 * two cannot drift. What a strong, mid and weak answer looks like is decided later, when the
 * grading anchors are generated — none of it belongs in the task itself.
 */
const CANDIDATE_FACING_TEXT_RULES = `The candidate reads the title, scenarioDescription, questionPrompt and any interfacePayload
text, so none of it may coach them — what makes an answer good is judged later, from separate grading anchors.
- scenarioDescription: the situation, the facts, and the stimulus (the other person's message, or the data).
- questionPrompt: one instruction stating the deliverable, its recipient, and its format or length.
Never include a list of points the answer should cover ("Your response should: 1. acknowledge …"),
example tactics ("e.g., a pilot", "without cutting price"), or hints about what a strong answer does or
is evaluated on. A word limit or deadline is a fact, not a hint.`;

const MARKDOWN_RULES = `Free-text fields are GitHub-flavored Markdown. Use lists, bold or italics only to present the
material itself (emails, line items, data), never HTML, and never to list what the answer should contain.`;

const TASK_GENERATION_PROMPT_BASE = `Generate the full content for one job-simulation task,
matching the given candidate's taskType. Produce a scenario and the task components appropriate
to that taskType. The task must need knowledge, judgment, or conventions specific to the role's
domain: someone with only general common sense should not be able to answer it well.

${CANDIDATE_FACING_TEXT_RULES}

${MARKDOWN_RULES}`;

export interface GenerateTaskContentParams {
  model: BaseChatModel;
  roleModule: RoleModule;
  category: string;
  intent: string;
  problem: string | null;
  taskType: string;
  briefDescription: string;
  /** Employer-supplied direction for a single-task regeneration — takes priority over default
   *  variety when present. Not used by the main graph's per-slot generation. */
  guidance?: string;
  /** Why the previous attempt at this slot was rejected. The next attempt must correct them. */
  revisionNotes?: string[];
}

/** Feedback from a rejected attempt, in the words the critic used. Empty when there is none. */
export function revisionClause(notes: string[] | undefined): string {
  if (!notes || notes.length === 0) return '';
  return `

The previous attempt was rejected. Fix every one of these problems in this attempt: ${notes.join(' ')}`;
}

/**
 * Core structured-output call shared by the graph's per-slot task-generation node and the
 * standalone single-task regeneration path (GenerationService.regenerateTask) — both need the
 * exact same schema-building + prompting logic, just with different candidate/state sourcing.
 */
export async function generateTaskContent(
  params: GenerateTaskContentParams,
): Promise<QuestionBankTaskContent> {
  const {
    model,
    roleModule,
    category,
    intent,
    problem,
    taskType,
    briefDescription,
    guidance,
    revisionNotes,
  } = params;

  const allowedTypeKeys = roleModule.allowedTaskPatternTypes.map(
    (t) => t.key,
  ) as [string, ...string[]];

  const patternTypeDef = roleModule.allowedTaskPatternTypes.find(
    (t) => t.key === taskType,
  );
  if (!patternTypeDef) {
    throw new Error(
      `No task-pattern-type definition found for taskType "${taskType}" in role module for category "${category}"`,
    );
  }
  if (patternTypeDef.spec) {
    return generateSpecTaskContent({
      model,
      patternTypeDef,
      spec: patternTypeDef.spec,
      category,
      intent,
      problem,
      briefDescription,
      guidance,
      revisionNotes,
    });
  }
  const interfaceType = patternTypeDef.interfaceType;
  const interfacePayloadSchema = INTERFACE_SCHEMAS[interfaceType];
  const objectiveComponentSchema = patternTypeDef.objectiveComponentType
    ? OBJECTIVE_COMPONENT_SCHEMAS[patternTypeDef.objectiveComponentType]
    : null;
  const openEndedComponentSchema = patternTypeDef.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType]
    : null;

  const schema = taskGenerationSchema(
    allowedTypeKeys,
    interfacePayloadSchema,
    objectiveComponentSchema,
    openEndedComponentSchema,
  );
  const structuredModel = withGeminiSafeStructuredOutput(model, schema);

  const guidanceClause = guidance
    ? `\n\nThe employer has requested the following specific direction for this task — ` +
      `prioritize it over default variety unless it conflicts with the rules above: ${guidance}`
    : '';

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${TASK_GENERATION_PROMPT_BASE}\n\nThis task's interfaceType is "${interfaceType}" — the ` +
        `interfacePayload you generate must match that render mode.${guidanceClause}${revisionClause(revisionNotes)}`,
    ),
    new HumanMessage(
      JSON.stringify({
        category,
        intent,
        problem,
        candidate: {
          taskType,
          briefDescription,
        },
      }),
    ),
  ]);

  // Hard rule enforcement, not just prompt-trusted: never fabricate a business problem.
  const businessProblemDerived =
    problem === null ? false : result.businessProblemDerived;

  return {
    taskType: result.taskType,
    title: result.title,
    scenarioDescription: result.scenarioDescription,
    questionPrompt: result.questionPrompt,
    objectiveComponent:
      (result.objectiveComponent as Record<string, unknown> | null) ??
      undefined,
    openEndedComponent:
      (result.openEndedComponent as Record<string, unknown> | null) ??
      undefined,
    businessProblemDerived,
    interfaceType,
    interfacePayload: result.interfacePayload as Record<string, unknown>,
  };
}

const SPEC_TASK_PROMPT_BASE = `Generate one job-simulation task. Put every figure the candidate needs into
\`data\` as raw inputs: the system derives every total, balance, variance, margin and answer from them,
and draws the data table. In scenarioDescription and questionPrompt, state no number at all — the
table shows every figure.

${CANDIDATE_FACING_TEXT_RULES}

${MARKDOWN_RULES}`;

const SPEC_TASK_MODIFICATION_PROMPT_BASE = `You are given an existing task and an employer's requested change.
Return the whole task with the change applied. Keep the data inputs and text the change does not touch.

${CANDIDATE_FACING_TEXT_RULES}

${MARKDOWN_RULES}`;

interface GenerateSpecTaskContentParams {
  model: BaseChatModel;
  patternTypeDef: TaskPatternTypeDefinition;
  spec: TaskSpecTemplate;
  category: string;
  intent: string;
  problem: string | null;
  briefDescription: string;
  guidance?: string;
  /** Set when editing an existing task: the model returns that task with the guidance applied. */
  existingTask?: QuestionBankTaskContent;
  revisionNotes?: string[];
}

/**
 * Spec-backed generation (finance doc Section 6.2): the model writes the text and raw inputs, and
 * the template derives the table, chart and answer key in code. Throws TaskSpecError when the
 * inputs cannot form a valid task; the generation graph turns that into a failed critic check.
 */
async function generateSpecTaskContent(
  params: GenerateSpecTaskContentParams,
): Promise<QuestionBankTaskContent> {
  const {
    model,
    patternTypeDef,
    spec,
    category,
    intent,
    problem,
    briefDescription,
    guidance,
    existingTask,
    revisionNotes,
  } = params;

  const openEndedComponentSchema = patternTypeDef.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType]
    : null;
  const schema = taskSpecSchema(spec.dataSchema, openEndedComponentSchema);
  const structuredModel = withGeminiSafeStructuredOutput(model, schema);

  const basePrompt = existingTask
    ? SPEC_TASK_MODIFICATION_PROMPT_BASE
    : SPEC_TASK_PROMPT_BASE;
  const guidanceClause = guidance
    ? `\n\nThe employer's direction for this task: ${guidance}`
    : '';

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${basePrompt}\n\nThis task's interfaceType is "${patternTypeDef.interfaceType}".${guidanceClause}${revisionClause(revisionNotes)}`,
    ),
    new HumanMessage(
      JSON.stringify({
        category,
        intent,
        problem,
        candidate: { taskType: patternTypeDef.key, briefDescription },
        existingTask,
      }),
    ),
  ]);

  const derived = spec.materialize(result.data);
  const businessProblemDerived =
    problem === null ? false : result.businessProblemDerived;

  return {
    taskType: patternTypeDef.key,
    title: result.title,
    scenarioDescription: result.scenarioDescription,
    questionPrompt: result.questionPrompt,
    objectiveComponent: derived.objectiveComponent,
    openEndedComponent: result.openEndedComponent
      ? result.openEndedComponent
      : undefined,
    businessProblemDerived,
    interfaceType: patternTypeDef.interfaceType,
    interfacePayload: { interfaceType: patternTypeDef.interfaceType, ...derived.interfacePayload },
    rubric: derived.rubric,
    serverOnly: derived.serverOnly,
  };
}

const TASK_MODIFICATION_PROMPT_BASE = `You are given an existing job-simulation task and a specific
change an employer wants made to it. Modify the task to reflect that request as directly and
minimally as possible — this is an edit, not a rewrite: keep the title, scenario, numbers, options,
and every other detail that the request doesn't touch exactly as they are. Only when the request
requires it for internal consistency (e.g. a changed number that other fields reference) should you
adjust a field you weren't directly asked to change.

${CANDIDATE_FACING_TEXT_RULES}

If the existing text already breaks these rules, fix that as part of the edit.

${MARKDOWN_RULES} Preserve existing markdown structure unless the change calls for different structure.`;

export interface ReviseTaskContentParams {
  model: BaseChatModel;
  roleModule: RoleModule;
  category: string;
  intent: string;
  problem: string | null;
  /** The rejected draft. The revision starts from it, so the rest of the task is kept. */
  existingTask: QuestionBankTaskContent;
  /** The critic's reasons for rejecting it, in its own words. */
  revisionNotes: string[];
}

/**
 * Repairs a rejected draft in place. The model sees the draft and the critic's reasons, and changes
 * only what those reasons name. Its output is then checked by code again, so the model never judges its
 * own repair: figure and spec checks are deterministic, and the critic reruns on the result.
 */
export async function reviseTaskContent(params: ReviseTaskContentParams): Promise<QuestionBankTaskContent> {
  const { model, roleModule, category, intent, problem, existingTask, revisionNotes } = params;

  const patternTypeDef = roleModule.allowedTaskPatternTypes.find((t) => t.key === existingTask.taskType);
  if (!patternTypeDef) {
    throw new Error(
      `No task-pattern-type definition found for taskType "${existingTask.taskType}" in role module for category "${category}"`,
    );
  }
  if (patternTypeDef.spec) {
    return generateSpecTaskContent({
      model,
      patternTypeDef,
      spec: patternTypeDef.spec,
      category,
      intent,
      problem,
      briefDescription: existingTask.title,
      existingTask,
      revisionNotes,
    });
  }
  return modifyTaskContent({
    model,
    roleModule,
    category,
    intent,
    problem,
    existingTask,
    guidance: `Fix these problems and change nothing else: ${revisionNotes.join(' ')}`,
  });
}

export interface ModifyTaskContentParams {
  model: BaseChatModel;
  roleModule: RoleModule;
  category: string;
  intent: string;
  problem: string | null;
  existingTask: QuestionBankTaskContent;
  /** The employer's requested change — required for this path (see GenerationService.regenerateTask,
   *  which only calls this when both guidance AND an existing task are present). */
  guidance: string;
}

/**
 * Edits an existing task in place per employer-supplied guidance, rather than generating a fresh
 * one — used when a "regenerate" click carries a specific instruction (e.g. "make the numbers
 * larger", "change the recipient to legal"), which should modify what's already there rather than
 * discard it for an unrelated new task. taskType/interfaceType are held fixed to the existing
 * task's (an edit doesn't change what kind of task this is or how the candidate answers it).
 */
export async function modifyTaskContent(
  params: ModifyTaskContentParams,
): Promise<QuestionBankTaskContent> {
  const {
    model,
    roleModule,
    category,
    intent,
    problem,
    existingTask,
    guidance,
  } = params;

  const patternTypeDef = roleModule.allowedTaskPatternTypes.find(
    (t) => t.key === existingTask.taskType,
  );
  if (!patternTypeDef) {
    throw new Error(
      `No task-pattern-type definition found for taskType "${existingTask.taskType}" in role module for category "${category}"`,
    );
  }
  if (patternTypeDef.spec) {
    return generateSpecTaskContent({
      model,
      patternTypeDef,
      spec: patternTypeDef.spec,
      category,
      intent,
      problem,
      briefDescription: existingTask.title,
      guidance,
      existingTask,
    });
  }
  const interfaceType = patternTypeDef.interfaceType;
  const interfacePayloadSchema = INTERFACE_SCHEMAS[interfaceType];
  const objectiveComponentSchema = patternTypeDef.objectiveComponentType
    ? OBJECTIVE_COMPONENT_SCHEMAS[patternTypeDef.objectiveComponentType]
    : null;
  const openEndedComponentSchema = patternTypeDef.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType]
    : null;

  // Single-value enum: a modify never changes taskType, only the schema-builder's shared shape
  // requires an enum rather than a literal.
  const schema = taskGenerationSchema(
    [existingTask.taskType] as [string, ...string[]],
    interfacePayloadSchema,
    objectiveComponentSchema,
    openEndedComponentSchema,
  );
  const structuredModel = withGeminiSafeStructuredOutput(model, schema);

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${TASK_MODIFICATION_PROMPT_BASE}\n\nThis task's interfaceType is "${interfaceType}" — the ` +
        `interfacePayload you return must still match that render mode.`,
    ),
    new HumanMessage(
      JSON.stringify({
        category,
        intent,
        problem,
        existingTask,
        requestedChange: guidance,
      }),
    ),
  ]);

  const businessProblemDerived =
    problem === null ? false : result.businessProblemDerived;

  return {
    taskType: existingTask.taskType,
    title: result.title,
    scenarioDescription: result.scenarioDescription,
    questionPrompt: result.questionPrompt,
    objectiveComponent:
      (result.objectiveComponent as Record<string, unknown> | null) ??
      undefined,
    openEndedComponent:
      (result.openEndedComponent as Record<string, unknown> | null) ??
      undefined,
    businessProblemDerived,
    interfaceType,
    interfacePayload: result.interfacePayload as Record<string, unknown>,
  };
}
