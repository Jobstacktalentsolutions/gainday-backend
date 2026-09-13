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
