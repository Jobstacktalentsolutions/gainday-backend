import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QuestionBankTaskContent } from '../../db/schema/question-bank.schema';
import { taskGenerationSchema } from './schemas/task-generation.schema';
import { INTERFACE_SCHEMAS } from './roles/interface-type';
import {
  OBJECTIVE_COMPONENT_SCHEMAS,
  OPEN_ENDED_COMPONENT_SCHEMAS,
} from './roles/component-schemas';
import { RoleModule } from './roles/role-module.interface';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';

const TASK_GENERATION_PROMPT_BASE = `Generate the full content for one job-simulation task,
matching the given candidate's taskType. Produce a scenario and the task components appropriate
to that taskType.

- Never include tips, hints, solution strategies, or example tactics. State WHAT deliverable is required, not HOW to solve it.

Free-text fields (scenarioDescription, questionPrompt, and any markdown-documented field in
interfacePayload) are GitHub-flavored Markdown. Use markdown syntax (bold, italics,
bullet/numbered lists) only where structure genuinely aids readability — e.g. presenting several
distinct emails, line items, or steps — never HTML, and never as decoration on plain prose that
reads fine without it.`;

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
      `prioritize it over default variety: ${guidance}`
    : '';

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${TASK_GENERATION_PROMPT_BASE}\n\nThis task's interfaceType is "${interfaceType}" — the ` +
        `interfacePayload you generate must match that render mode.${guidanceClause}`,
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

const TASK_MODIFICATION_PROMPT_BASE = `You are given an existing job-simulation task and a specific
change an employer wants made to it. Modify the task to reflect that request as directly and
minimally as possible — this is an edit, not a rewrite: keep the title, scenario, numbers, options,
and every other detail that the request doesn't touch exactly as they are. Only when the request
requires it for internal consistency (e.g. a changed number that other fields reference) should you
adjust a field you weren't directly asked to change.

- Never include tips, hints, solution strategies, or example tactics in questionPrompt or scenarioDescription. State WHAT deliverable is required, not HOW to solve it.

Free-text fields (scenarioDescription, questionPrompt, and any markdown-documented field in
interfacePayload) are GitHub-flavored Markdown. Preserve existing markdown structure unless the
requested change specifically calls for different structure.`;

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
