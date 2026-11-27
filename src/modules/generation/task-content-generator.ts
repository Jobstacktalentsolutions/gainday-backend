import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QuestionBankTaskContent } from '../../db/schema/question-bank.schema';
import {
  flexibleTaskDraftSchema,
  taskGenerationSchema,
  questionPromptDescription,
} from './schemas/task-generation.schema';
import {
  answerControls,
  presentationCapability,
} from './roles/presentation-capabilities';
import {
  validateInteraction,
  validateInteractionPresentation,
} from './roles/interaction-validation';
import {
  OBJECTIVE_COMPONENT_SCHEMAS,
  generationObjectiveSchema,
  OPEN_ENDED_COMPONENT_SCHEMAS,
} from './roles/component-schemas';
import {
  RoleModule,
  TaskPatternTypeDefinition,
  TaskSpecTemplate,
  TaskSpecError,
  INTERACTION,
  type ObjectiveComponentType,
} from './roles/role-module.interface';
import {
  objectiveInstruction,
  withObjectiveInstruction,
  withoutObjectiveInstruction,
} from './utils/objective-instruction.util';
import { taskSpecSchema } from './schemas/task-spec.schema';
import {
  REQUIREMENT_VS_TIP_RULE,
  textLimitsForSeniority,
  getSeniorityGuidance,
  getSeniorityDataGuidance,
} from './task-text-rules';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';
import { CustomerServiceTaskType } from './roles/customer-service/customer-service.role-module';
import {
  hasReferenceMaterial,
  readingBudget,
  slotBudgetMinutes,
  writtenResponseLimit,
} from './utils/task-budget.util';
import { requireTaskText } from './utils/task-text.util';
import {
  shuffleObjectiveOrder,
  withAnswerKey,
} from './utils/objective-order.util';
import { InterfaceType, withWrittenWordLimit } from './roles/interface-type';

/**
 * What the candidate reads must not give them tips. Shared by the generate and modify prompts so the
 * two cannot drift. Requirements of the work are allowed; tips on how to do well are not. What a
 * strong, mid and weak answer looks like is decided later, when the grading anchors are generated.
 */
const CANDIDATE_FACING_TEXT_RULES = `Candidate-facing fields (scenarioDescription, questionPrompt, interfacePayload):
- scenarioDescription: strictly the situation, facts, and stimulus.
- questionPrompt: deliverables and requirements only.
${REQUIREMENT_VS_TIP_RULE}`;

/**
 * The platform starts the question with the answer control's instruction (see objective-instruction.util), so the
 * model writes only the written part. Without this it lists the items in the question and fills objectiveComponent
 * with instructions about how to answer.
 */
function structuredAnswerRule(
  objectiveType?: ObjectiveComponentType,
  fields = 'questionPrompt',
): string {
  return objectiveInstruction(objectiveType)
    ? `
The platform shows the structured answer as its own control, built from objectiveComponent, and starts the question with that control's instruction. Write ${fields} for the written part only, never listing the items or asking the candidate to enter them. objectiveComponent holds the real items, one entry each written out in full.`
    : '';
}

const MARKDOWN_RULES = `Free-text fields are GitHub-flavored Markdown. Use lists, bold or italics only to present the
material itself (emails, line items, data), never HTML, and never to list what the answer should contain.`;

const TASK_SCOPE_RULE = `Keep the task to one focused piece of work. The structured answer and any written response should support the same objective. Do not add separate deliverables beyond what the task type requires.`;

const READABILITY_RULE = `Make the candidate-facing material easy to scan. Give the candidate every fact the answer needs, each stated once and in the place it fits: the scenario, or the reference material when there is one. Use short labels to refer to material. Use a brief placeholder, not repeated instructions.`;

/** Whether a pattern's interfaces show reference material, for the reading allowance. */
const patternInterfaceTypes = (
  def: TaskPatternTypeDefinition,
): InterfaceType[] =>
  def.allowedInterfaceTypes ?? (def.interfaceType ? [def.interfaceType] : []);

export const TIMING_AND_LIMITS_RULE = (
  questionWords: number,
  timeBudgetMinutes: number = slotBudgetMinutes(),
  hasReference: boolean,
) => {
  const budget = readingBudget(timeBudgetMinutes, questionWords, hasReference);
  // The model picks a value in this range; the range follows from the budget, so it never does the arithmetic.
  const written = {
    min: writtenResponseLimit(timeBudgetMinutes, budget.total).max,
    max: writtenResponseLimit(timeBudgetMinutes, 0).max,
  };
  const reference = hasReference
    ? `reference tabs, tables and options ${budget.reference}`
    : 'no reference material';
  return `Time and size:
- The task budget is ${timeBudgetMinutes} minutes, reading included. Set expectedDurationMinutes to the time this task needs, at most ${timeBudgetMinutes}.
- Words the candidate reads, at most ${budget.total}: scenario about ${budget.scenario}, question ${budget.question}, ${reference}.
- For a written answer, set wordLimit.max between ${written.min} and ${written.max}, and wordLimit.min about 40% of max.
- Ask for the deliverable in one sentence, plus at most one constraint. No numbered or multi-part lists.`;
};

export function buildTaskGenerationPromptBase(
  skillLevel?: string | null,
): string {
  return [
    'Generate the full content for one job-simulation task,',
    "matching the given candidate's taskType. Produce a scenario and the task components appropriate",
    'to that taskType. Focus on one manageable piece of work that fits the target seniority.',
    '',
    getSeniorityGuidance(skillLevel),
    '',
    TASK_SCOPE_RULE,
    '',
    READABILITY_RULE,
    '',
    CANDIDATE_FACING_TEXT_RULES,
    '',
    MARKDOWN_RULES,
  ].join('\n');
}

export interface GenerateTaskContentParams {
  model: BaseChatModel;
  roleModule: RoleModule;
  category: string;
  intent: string;
  problem: string | null;
  skillLevel?: string | null;
  taskType: string;
  briefDescription: string;
  /** Employer-supplied direction for a single-task regeneration — takes priority over default
   *  variety when present. Not used by the main graph's per-slot generation. */
  guidance?: string;
  /** Why the previous attempt at this slot was rejected. The next attempt must correct them. */
  revisionNotes?: string[];
  timeBudgetMinutes?: number;
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
    skillLevel,
    taskType,
    briefDescription,
    guidance,
    revisionNotes,
    timeBudgetMinutes,
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
      skillLevel,
      briefDescription,
      guidance,
      revisionNotes,
      timeBudgetMinutes,
    });
  }
  if (
    patternTypeDef.allowedInterfaceTypes &&
    patternTypeDef.allowedInterfaceTypes.length > 1
  ) {
    return generateFlexibleTaskContent(params, patternTypeDef);
  }
  const interfaceType = patternTypeDef.allowedInterfaceTypes
    ? patternTypeDef.allowedInterfaceTypes[0]
    : patternTypeDef.interfaceType;
  const presentation = presentationCapability(interfaceType);
  const interfacePayloadSchema = patternTypeDef.openEndedComponentType
    ? withWrittenWordLimit(presentation.inputSchema)
    : presentation.inputSchema;
  const objectiveComponentSchema = patternTypeDef.objectiveComponentType
    ? generationObjectiveSchema(patternTypeDef.objectiveComponentType)
    : null;
  const openEndedComponentSchema = patternTypeDef.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType]
    : null;

  const schema = taskGenerationSchema(
    allowedTypeKeys,
    interfacePayloadSchema,
    objectiveComponentSchema,
    openEndedComponentSchema,
    objectiveInstruction(patternTypeDef.objectiveComponentType),
  );
  const structuredModel = withGeminiSafeStructuredOutput(model, schema);

  const guidanceClause = guidance
    ? `\n\nThe employer has requested the following specific direction for this task — ` +
      `prioritize it over default variety unless it conflicts with the rules above: ${guidance}`
    : '';

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${buildTaskGenerationPromptBase(skillLevel)}\n\n${TIMING_AND_LIMITS_RULE(textLimitsForSeniority(skillLevel).questionWords, timeBudgetMinutes, hasReferenceMaterial(patternInterfaceTypes(patternTypeDef)))}\nState the work once without repeating the scenario or interface instructions.${structuredAnswerRule(patternTypeDef.objectiveComponentType)}${patternTypeDef.objectiveComponentType === INTERACTION.PRIORITY_RANKING ? `\nKeep each ranking description within ${textLimitsForSeniority(skillLevel).rankingDescriptionCharacters} characters.` : ''}\n\nAvailable controls: ${answerControls(interfaceType, patternTypeDef.objectiveComponentType)} Require only actions these controls support, and do not describe the controls in the text.\n\nThis task's interfaceType is "${interfaceType}" — the ` +
        `interfacePayload you generate must match that render mode.` +
        (presentation.guidance ? ` ${presentation.guidance}` : '') +
        `${guidanceClause}${revisionClause(revisionNotes)}`,
    ),
    new HumanMessage(
      JSON.stringify({
        category,
        intent,
        problem,
        skillLevel: skillLevel ?? null,
        candidate: {
          taskType,
          briefDescription,
        },
      }),
    ),
  ]);

  requireTaskText(result.title, result.scenarioDescription);
  // Hard rule enforcement, not just prompt-trusted: never fabricate a business problem.
  const businessProblemDerived =
    problem === null ? false : result.businessProblemDerived;

  const interfacePayload = presentation.materialize
    ? presentation.materialize(result.interfacePayload)
    : (result.interfacePayload as Record<string, unknown>);
  const objectiveComponent = withAnswerKey(
    patternTypeDef.objectiveComponentType,
    result.objectiveComponent as Record<string, unknown> | null,
  );
  if (patternTypeDef.validateInteraction) {
    validateInteraction(
      patternTypeDef.objectiveComponentType,
      objectiveComponent,
    );
    validateInteractionPresentation(
      patternTypeDef.objectiveComponentType,
      objectiveComponent,
      interfaceType,
      interfacePayload,
    );
  }

  return {
    taskType,
    title: result.title,
    expectedDurationMinutes: result.expectedDurationMinutes,
    scenarioDescription: result.scenarioDescription,
    questionPrompt: withObjectiveInstruction(
      patternTypeDef.objectiveComponentType,
      result.questionPrompt,
    ),
    objectiveComponent:
      shuffleObjectiveOrder(
        patternTypeDef.objectiveComponentType,
        objectiveComponent,
      ) ?? undefined,
    openEndedComponent:
      (result.openEndedComponent as Record<string, unknown> | null) ??
      undefined,
    businessProblemDerived,
    interfaceType,
    interfacePayload,
  };
}

/** Generate the work first, then choose and populate a compatible presentation. */
async function generateFlexibleTaskContent(
  params: GenerateTaskContentParams,
  pattern: TaskPatternTypeDefinition,
): Promise<QuestionBankTaskContent> {
  const {
    model,
    category,
    intent,
    problem,
    skillLevel,
    taskType,
    briefDescription,
    guidance,
    revisionNotes,
    timeBudgetMinutes,
  } = params;
  const allowedInterfaces = pattern.allowedInterfaceTypes;
  if (!allowedInterfaces)
    throw new Error('Flexible task requires allowed interfaces');
  const objectiveSchema = pattern.objectiveComponentType
    ? generationObjectiveSchema(pattern.objectiveComponentType)
    : null;
  const openEndedSchema = pattern.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[pattern.openEndedComponentType]
    : null;
  const draftModel = withGeminiSafeStructuredOutput(
    model,
    flexibleTaskDraftSchema(
      [taskType],
      objectiveSchema,
      openEndedSchema,
      objectiveInstruction(pattern.objectiveComponentType),
    ),
  );
  const draft = await draftModel.invoke([
    new SystemMessage(
      `${buildTaskGenerationPromptBase(skillLevel)}\n\n${TIMING_AND_LIMITS_RULE(textLimitsForSeniority(skillLevel).questionWords, timeBudgetMinutes, hasReferenceMaterial(patternInterfaceTypes(pattern)))}\nDescribe the work and its evidence before selecting a presentation. Put supporting artifacts and data in referenceMaterial, and describe the required answer format and reference needs in presentationNeeds. Do not mention controls that have not been selected.${structuredAnswerRule(pattern.objectiveComponentType, 'questionPrompt and presentationNeeds')}${guidance ? `\nEmployer direction: ${guidance}` : ''}${revisionClause(revisionNotes)}`,
    ),
    new HumanMessage(
      JSON.stringify({
        category,
        intent,
        problem,
        skillLevel: skillLevel ?? null,
        candidate: { taskType, briefDescription },
      }),
    ),
  ]);

  // A fixed object of nullable payloads avoids provider-specific discriminated unions. Validate
  // the chosen payload against its own schema after structured output has been parsed.
  const payloadSchemas: Record<string, z.ZodTypeAny> = {};
  for (const type of allowedInterfaces)
    payloadSchemas[type] = (
      pattern.openEndedComponentType
        ? withWrittenWordLimit(presentationCapability(type).inputSchema)
        : presentationCapability(type).inputSchema
    ).nullable();
  const selectionSchema = z.object({
    interfaceType: z.enum(allowedInterfaces),
    scenarioDescription: z.string(),
    questionPrompt: z
      .string()
      .describe(
        questionPromptDescription(
          objectiveInstruction(pattern.objectiveComponentType),
        ),
      ),
    payloads: z.object(payloadSchemas),
  });
  const selection = await withGeminiSafeStructuredOutput(
    model,
    selectionSchema,
  ).invoke([
    new SystemMessage(
      `Choose the interface that best supports the task's actual answer and reference needs. ${allowedInterfaces.map((type) => `${type}: ${answerControls(type, pattern.objectiveComponentType)}${presentationCapability(type).guidance ? ` ${presentationCapability(type).guidance}` : ''}`).join('\n')}\nPopulate only the selected payload; set every other payload to null. Set wordLimit for every written answer, matched to the task's depth and allotted time. Use null only for an objective-only task. Preserve all facts, evidence, and task requirements.${structuredAnswerRule(pattern.objectiveComponentType)} Put reference material in the selected interface when supported, otherwise include it in scenarioDescription. Adjust scenarioDescription and questionPrompt only to match the chosen controls. Do not ask for unavailable controls.`,
    ),
    new HumanMessage(JSON.stringify({ category, intent, task: draft })),
  ]);
  const interfaceType = selection.interfaceType;
  const presentation = presentationCapability(interfaceType);
  const selectedPayload: unknown = selection.payloads[interfaceType];
  if (selectedPayload === null || selectedPayload === undefined) {
    throw new TaskSpecError('The selected interface has no matching payload.');
  }
  const parsedPayload: unknown =
    presentation.inputSchema.parse(selectedPayload);
  requireTaskText(draft.title, selection.scenarioDescription);
  const interfacePayload = presentation.materialize
    ? presentation.materialize(parsedPayload)
    : (parsedPayload as Record<string, unknown>);
  const objectiveComponent = withAnswerKey(
    pattern.objectiveComponentType,
    draft.objectiveComponent as Record<string, unknown> | null,
  );
  if (pattern.validateInteraction) {
    validateInteraction(pattern.objectiveComponentType, objectiveComponent);
    validateInteractionPresentation(
      pattern.objectiveComponentType,
      objectiveComponent,
      interfaceType,
      interfacePayload,
    );
  }
  return {
    taskType,
    title: draft.title,
    expectedDurationMinutes: draft.expectedDurationMinutes,
    scenarioDescription: selection.scenarioDescription,
    questionPrompt: withObjectiveInstruction(
      pattern.objectiveComponentType,
      selection.questionPrompt,
    ),
    objectiveComponent:
      shuffleObjectiveOrder(
        pattern.objectiveComponentType,
        objectiveComponent,
      ) ?? undefined,
    openEndedComponent:
      (draft.openEndedComponent as Record<string, unknown> | null) ?? undefined,
    businessProblemDerived:
      problem === null ? false : draft.businessProblemDerived,
    interfaceType,
    interfacePayload,
  };
}

export function buildSpecTaskPromptBase(skillLevel?: string | null): string {
  return [
    'Generate one job-simulation task. Put every figure the candidate needs into',
    '`data` as raw inputs: the system derives every total, balance, variance, margin and answer from them,',
    'and draws the data table. In scenarioDescription and questionPrompt, state no number at all — the',
    'table shows every figure.',
    'Keep the scenario and question consistent with the supplied data and the case, policy and answer controls derived from it. Do not invent policy terms, transactions or requirements outside those inputs.',
    '',
    getSeniorityGuidance(skillLevel),
    `Data for this level: ${getSeniorityDataGuidance(skillLevel)}`,
    '',
    TASK_SCOPE_RULE,
    '',
    READABILITY_RULE,
    '',
    CANDIDATE_FACING_TEXT_RULES,
    '',
    MARKDOWN_RULES,
  ].join('\n');
}

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
  skillLevel?: string | null;
  briefDescription: string;
  guidance?: string;
  /** Set when editing an existing task: the model returns that task with the guidance applied. */
  existingTask?: QuestionBankTaskContent;
  revisionNotes?: string[];
  timeBudgetMinutes?: number;
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
    skillLevel,
    briefDescription,
    guidance,
    existingTask,
    revisionNotes,
    timeBudgetMinutes,
  } = params;

  const openEndedComponentSchema = patternTypeDef.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType]
    : null;
  // A staged chat limits each reply through its own data, not one written answer.
  const schema = taskSpecSchema(
    spec.dataSchema,
    openEndedComponentSchema,
    Boolean(openEndedComponentSchema) &&
      patternTypeDef.interfaceType !== InterfaceType.STAGED_CHAT,
  );
  const structuredModel = withGeminiSafeStructuredOutput(model, schema);

  const basePrompt = existingTask
    ? [
        SPEC_TASK_MODIFICATION_PROMPT_BASE,
        '',
        getSeniorityGuidance(skillLevel),
      ].join('\n')
    : buildSpecTaskPromptBase(skillLevel);
  const guidanceClause = guidance
    ? `\n\nThe employer's direction for this task: ${guidance}`
    : '';

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${basePrompt}\n\n${TIMING_AND_LIMITS_RULE(textLimitsForSeniority(skillLevel).questionWords, timeBudgetMinutes, hasReferenceMaterial(patternInterfaceTypes(patternTypeDef)))}${existingTask ? '' : `\nState the work once without repeating the scenario or interface instructions.`}\n\nAvailable controls: ${answerControls(patternTypeDef.interfaceType, patternTypeDef.objectiveComponentType)} Require only actions these controls support, and do not describe the controls in the text.\n\nThis task's interfaceType is "${patternTypeDef.interfaceType}".${guidanceClause}${revisionClause(revisionNotes)}`,
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
  const wordLimit = result.wordLimit ?? derived.interfacePayload.wordLimit;

  return {
    taskType: patternTypeDef.key,
    title: result.title,
    expectedDurationMinutes: result.expectedDurationMinutes,
    scenarioDescription:
      patternTypeDef.key === CustomerServiceTaskType.TICKET_TRIAGE
        ? 'Review the support queue and apply the triage guideline to decide what to do first and how to handle the remaining tickets.'
        : result.scenarioDescription,
    questionPrompt:
      patternTypeDef.key === CustomerServiceTaskType.TICKET_TRIAGE
        ? 'Use the triage guideline to select an action for every ticket. Explain why you chose the first ticket and how you will handle the others.'
        : result.questionPrompt,
    objectiveComponent: derived.objectiveComponent,
    openEndedComponent: result.openEndedComponent
      ? result.openEndedComponent
      : undefined,
    businessProblemDerived,
    interfaceType: patternTypeDef.interfaceType,
    interfacePayload: {
      interfaceType: patternTypeDef.interfaceType,
      ...derived.interfacePayload,
      ...(wordLimit ? { wordLimit } : {}),
    },
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
  skillLevel?: string | null;
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
export async function reviseTaskContent(
  params: ReviseTaskContentParams,
): Promise<QuestionBankTaskContent> {
  const {
    model,
    roleModule,
    category,
    intent,
    problem,
    skillLevel,
    existingTask,
    revisionNotes,
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
      skillLevel,
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
    skillLevel,
    existingTask,
    guidance: `Fix these problems and keep everything else. Where a section is over its limit, shorten that section to its target by removing repeated or unnecessary wording first; keep every fact the answer needs: ${revisionNotes.join(' ')}`,
  });
}

export interface ModifyTaskContentParams {
  model: BaseChatModel;
  roleModule: RoleModule;
  category: string;
  intent: string;
  problem: string | null;
  skillLevel?: string | null;
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
    skillLevel,
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
      skillLevel,
      briefDescription: existingTask.title,
      guidance,
      existingTask,
    });
  }
  const interfaceType = existingTask.interfaceType;
  const presentation = presentationCapability(interfaceType);
  const interfacePayloadSchema = patternTypeDef.openEndedComponentType
    ? withWrittenWordLimit(presentation.inputSchema)
    : presentation.inputSchema;
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
    objectiveInstruction(patternTypeDef.objectiveComponentType),
  );
  const structuredModel = withGeminiSafeStructuredOutput(model, schema);

  const result = await structuredModel.invoke([
    new SystemMessage(
      `${TASK_MODIFICATION_PROMPT_BASE}\n\n${TIMING_AND_LIMITS_RULE(textLimitsForSeniority(skillLevel).questionWords, undefined, hasReferenceMaterial([existingTask.interfaceType]))}\n\nAvailable controls: ${answerControls(interfaceType, patternTypeDef.objectiveComponentType)} Require only actions these controls support, and do not describe the controls in the text.${structuredAnswerRule(patternTypeDef.objectiveComponentType)}\n\nThis task's interfaceType is "${interfaceType}" — the ` +
        `interfacePayload you return must still match that render mode.` +
        (presentation.guidance ? ` ${presentation.guidance}` : ''),
    ),
    new HumanMessage(
      JSON.stringify({
        category,
        intent,
        problem,
        existingTask: {
          ...existingTask,
          questionPrompt: withoutObjectiveInstruction(
            patternTypeDef.objectiveComponentType,
            existingTask.questionPrompt,
          ),
        },
        requestedChange: guidance,
      }),
    ),
  ]);

  const businessProblemDerived =
    problem === null ? false : result.businessProblemDerived;

  const interfacePayload = presentation.materialize
    ? presentation.materialize(result.interfacePayload)
    : (result.interfacePayload as Record<string, unknown>);
  if (patternTypeDef.validateInteraction) {
    validateInteraction(
      patternTypeDef.objectiveComponentType,
      result.objectiveComponent,
    );
    validateInteractionPresentation(
      patternTypeDef.objectiveComponentType,
      result.objectiveComponent,
      interfaceType,
      interfacePayload,
    );
  }

  return {
    taskType: existingTask.taskType,
    title: result.title,
    expectedDurationMinutes: result.expectedDurationMinutes,
    scenarioDescription: result.scenarioDescription,
    questionPrompt: withObjectiveInstruction(
      patternTypeDef.objectiveComponentType,
      result.questionPrompt,
    ),
    objectiveComponent:
      (result.objectiveComponent as Record<string, unknown> | null) ??
      undefined,
    openEndedComponent:
      (result.openEndedComponent as Record<string, unknown> | null) ??
      undefined,
    businessProblemDerived,
    interfaceType,
    interfacePayload,
  };
}
