import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QuestionBankTaskContent } from '../../db/schema/question-bank.schema';
import {
  flexibleTaskDraftSchema,
  taskGenerationSchema,
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
  OPEN_ENDED_COMPONENT_SCHEMAS,
} from './roles/component-schemas';
import {
  RoleModule,
  TaskPatternTypeDefinition,
  TaskPatternRealities,
  TaskSpecTemplate,
  TaskSpecError,
  INTERACTION,
} from './roles/role-module.interface';
import { taskSpecSchema } from './schemas/task-spec.schema';
import {
  REQUIREMENT_VS_TIP_RULE,
  textLimitsForSeniority,
  getSeniorityGuidance,
} from './task-text-rules';
import { withGeminiSafeStructuredOutput } from '../ai/gemini-structured-output.util';
import { CustomerServiceTaskType } from './roles/customer-service/customer-service.role-module';

/**
 * What the candidate reads must not give them tips. Shared by the generate and modify prompts so the
 * two cannot drift. Requirements of the work are allowed; tips on how to do well are not. What a
 * strong, mid and weak answer looks like is decided later, when the grading anchors are generated.
 */
const CANDIDATE_FACING_TEXT_RULES = `Candidate-facing fields (scenarioDescription, questionPrompt, interfacePayload):
- scenarioDescription: strictly the situation, facts, and stimulus.
- questionPrompt: deliverables and requirements only.
${REQUIREMENT_VS_TIP_RULE}`;

const MARKDOWN_RULES = `Free-text fields are GitHub-flavored Markdown. Use lists, bold or italics only to present the
material itself (emails, line items, data), never HTML, and never to list what the answer should contain.`;

const TASK_SCOPE_RULE = `Keep the task to one focused piece of work. The structured answer and any written response should support the same objective. Do not add separate deliverables beyond what the task type requires.`;

const READABILITY_RULE = `Make the candidate-facing material easy to scan. Put each substantive fact in one place across the scenario, reference material and answer controls; use short labels to refer to it. Keep the facts, policies and data needed to answer fairly. Use a brief placeholder, not repeated instructions.`;

export const TIMING_AND_LIMITS_RULE = (
  realities?: TaskPatternRealities,
  timeBudgetMinutes?: number,
  includePayload = true,
) => {
  const maxStimulus = realities?.maxStimulusWords ?? 250;
  const defaultDuration = realities?.defaultDurationMinutes ?? 8;
  return `Simulation Timing & Limits:
- Set expectedDurationMinutes based on depth (guideline: ~${timeBudgetMinutes ?? defaultDuration} mins, allowed range: 3-15).
- Keep scenarioDescription concise: strictly facts, situation, and stimulus (hard ceiling: ${maxStimulus} words).${includePayload ? '\n- In interfacePayload, set wordLimit: { min, max } realistic for the allocated time (or null if purely objective).' : ''}`;
};

export function buildTaskGenerationPromptBase(
  skillLevel?: string | null,
): string {
  return [
    'Generate the full content for one job-simulation task,',
    "matching the given candidate's taskType. Produce a scenario and the task components appropriate",
    'to that taskType. Focus on one manageable piece of work that assesses relevant role knowledge or judgment.',
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
  const interfacePayloadSchema = presentation.inputSchema;
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
      `${buildTaskGenerationPromptBase(skillLevel)}\n\n${TIMING_AND_LIMITS_RULE(patternTypeDef.realities, timeBudgetMinutes)}\nKeep questionPrompt within ${textLimitsForSeniority(skillLevel).questionWords} words; state the work once without repeating the scenario or interface instructions.${patternTypeDef.objectiveComponentType === INTERACTION.PRIORITY_RANKING ? `\nKeep each ranking description within ${textLimitsForSeniority(skillLevel).rankingDescriptionCharacters} characters.` : ''}${timeBudgetMinutes ? `\nDesign the complete task, including reading and answering, to take about ${timeBudgetMinutes} minutes.` : ''}\n\nAvailable controls: ${answerControls(interfaceType, patternTypeDef.objectiveComponentType)} Ask candidates to use only these controls.\n\nThis task's interfaceType is "${interfaceType}" — the ` +
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

  // Hard rule enforcement, not just prompt-trusted: never fabricate a business problem.
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
    taskType,
    title: result.title,
    expectedDurationMinutes:
      result.expectedDurationMinutes ??
      patternTypeDef.realities?.defaultDurationMinutes ??
      8,
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
    ? OBJECTIVE_COMPONENT_SCHEMAS[pattern.objectiveComponentType]
    : null;
  const openEndedSchema = pattern.openEndedComponentType
    ? OPEN_ENDED_COMPONENT_SCHEMAS[pattern.openEndedComponentType]
    : null;
  const draftModel = withGeminiSafeStructuredOutput(
    model,
    flexibleTaskDraftSchema([taskType], objectiveSchema, openEndedSchema),
  );
  const draft = await draftModel.invoke([
    new SystemMessage(
      `${buildTaskGenerationPromptBase(skillLevel)}\n\n${TIMING_AND_LIMITS_RULE(pattern.realities, timeBudgetMinutes, false)}\nKeep questionPrompt within ${textLimitsForSeniority(skillLevel).questionWords} words. Describe the work and its evidence before selecting a presentation. Put supporting artifacts and data in referenceMaterial, and describe the required answer format and reference needs in presentationNeeds. Do not mention controls that have not been selected.${guidance ? `\nEmployer direction: ${guidance}` : ''}${revisionClause(revisionNotes)}`,
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
    payloadSchemas[type] = presentationCapability(type).inputSchema.nullable();
  const selectionSchema = z.object({
    interfaceType: z.enum(allowedInterfaces),
    scenarioDescription: z.string(),
    questionPrompt: z.string(),
    payloads: z.object(payloadSchemas),
  });
  const selection = await withGeminiSafeStructuredOutput(
    model,
    selectionSchema,
  ).invoke([
    new SystemMessage(
      `Choose the interface that best supports the task's actual answer and reference needs. ${allowedInterfaces.map((type) => `${type}: ${answerControls(type, pattern.objectiveComponentType)}${presentationCapability(type).guidance ? ` ${presentationCapability(type).guidance}` : ''}`).join('\n')}\nPopulate only the selected payload; set every other payload to null. Set its wordLimit to match the task's depth and allotted time, or null for a purely objective task. Preserve all facts, evidence, answer options, and task requirements. Put reference material in the selected interface when supported, otherwise include it in scenarioDescription. Adjust scenarioDescription and questionPrompt only to match the chosen controls. Do not ask for unavailable controls.`,
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
  // Open-ended tasks are written responses, so they need a word limit. Only objective tasks may omit it.
  if (
    !pattern.objectiveComponentType &&
    (parsedPayload as { wordLimit?: unknown }).wordLimit == null
  ) {
    throw new TaskSpecError('Written response tasks need a word limit.');
  }
  const interfacePayload = presentation.materialize
    ? presentation.materialize(parsedPayload)
    : (parsedPayload as Record<string, unknown>);
  if (pattern.validateInteraction) {
    validateInteraction(
      pattern.objectiveComponentType,
      draft.objectiveComponent,
    );
    validateInteractionPresentation(
      pattern.objectiveComponentType,
      draft.objectiveComponent,
      interfaceType,
      interfacePayload,
    );
  }
  return {
    taskType,
    title: draft.title,
    expectedDurationMinutes: draft.expectedDurationMinutes,
    scenarioDescription: selection.scenarioDescription,
    questionPrompt: selection.questionPrompt,
    objectiveComponent:
      (draft.objectiveComponent as Record<string, unknown> | null) ?? undefined,
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
  const schema = taskSpecSchema(spec.dataSchema, openEndedComponentSchema);
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
      `${basePrompt}\n\n${TIMING_AND_LIMITS_RULE(patternTypeDef.realities, timeBudgetMinutes)}${existingTask ? '' : `\nKeep questionPrompt within ${textLimitsForSeniority(skillLevel).questionWords} words; state the work once without repeating the scenario or interface instructions.`}${timeBudgetMinutes ? `\nDesign the complete task, including reading and answering, to take about ${timeBudgetMinutes} minutes.` : ''}\n\nAvailable controls: ${answerControls(patternTypeDef.interfaceType, patternTypeDef.objectiveComponentType)} Ask candidates to use only these controls.\n\nThis task's interfaceType is "${patternTypeDef.interfaceType}".${guidanceClause}${revisionClause(revisionNotes)}`,
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

  const wordLimit =
    (result as { wordLimit?: { min: number; max: number } | null }).wordLimit ??
    (derived.interfacePayload as Record<string, unknown>)?.wordLimit ??
    undefined;

  return {
    taskType: patternTypeDef.key,
    title: result.title,
    expectedDurationMinutes:
      result.expectedDurationMinutes ??
      patternTypeDef.realities?.defaultDurationMinutes ??
      8,
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
    guidance: `Fix these problems and change nothing else: ${revisionNotes.join(' ')}`,
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
  const interfacePayloadSchema = presentation.inputSchema;
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
      `${TASK_MODIFICATION_PROMPT_BASE}\n\n${TIMING_AND_LIMITS_RULE(patternTypeDef.realities)}\n\nAvailable controls: ${answerControls(interfaceType, patternTypeDef.objectiveComponentType)} Ask candidates to use only these controls.\n\nThis task's interfaceType is "${interfaceType}" — the ` +
        `interfacePayload you return must still match that render mode.` +
        (presentation.guidance ? ` ${presentation.guidance}` : ''),
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
    expectedDurationMinutes:
      result.expectedDurationMinutes ??
      existingTask.expectedDurationMinutes ??
      patternTypeDef.realities?.defaultDurationMinutes ??
      8,
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
    interfacePayload,
  };
}
