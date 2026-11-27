/**
 * Compares generated tasks across seniority levels for one fixed job. For each level it sends the real
 * planner request, generates the same three task types with the real generator, measures the wording
 * (readability, jargon) and asks a blind judge, which sees only the task text, to estimate the level.
 * Sends prompts to the configured model, so it needs that provider's API key. It writes nothing to the
 * database; results go to tmp/seniority-eval (ignored by git).
 *
 * Run with: pnpm seniority:evaluate [level ...]   e.g. pnpm seniority:evaluate "Entry level" Junior
 */
import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { aiConfig } from '../../../config/ai.config';
import {
  SKILL_LEVEL,
  SKILL_LEVEL_VALUES,
  SkillLevel,
} from '../../../common/skill-level';
import { buildChatModel } from '../../ai/ai.module';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import { GenericRoleModule } from '../roles/generic/generic.role-module';
import { requestTaskPlan } from '../nodes/plan-tasks.node';
import { generateTaskContent } from '../task-content-generator';
import { candidateReadingText } from '../utils/task-budget.util';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { LanguageMetrics, languageMetrics } from './language-metrics';

const JOB = {
  category: 'Software Engineering > Backend Engineering',
  intent:
    'Build and maintain reliable backend services that process orders, payments and notifications.',
  problem:
    'Design, build, and maintain reliable APIs and background services that power our core platform.',
};

/** The same three task types and briefs for every level, so differences come from the level alone. */
const CASES = [
  {
    taskType: 'GENERIC_CHOOSE_ACTION',
    briefDescription:
      'Decide what to do when the same payment notification arrives twice.',
  },
  {
    taskType: 'WRITTEN_JUSTIFICATION',
    briefDescription: 'Explain a decision about retrying failed email sends.',
  },
  {
    taskType: 'INTERPRETATION_ANALYSIS',
    briefDescription:
      'Work out what went wrong from a short error report during a busy period.',
  },
];

const judgeSchema = z.object({
  estimatedLevel: z.enum(SKILL_LEVEL_VALUES),
  technicalJargon: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      '1 = an average person understands every word, 5 = dense specialist jargon.',
    ),
  reason: z.string(),
});

const JUDGE_PROMPT = `You are shown one job-simulation task. Estimate the candidate it is written for, judging only from the task text.
- Entry level: a recent graduate with no work experience. An average person could answer it.
- Junior: up to about two years of experience; applies a clear rule or procedure.
- Mid level: about three to six years; works independently and weighs trade-offs.
- Senior level: seven or more years; makes and defends decisions under ambiguity.
Choose the level the task fits best.`;

type Source = 'controlled' | 'planned';

interface Brief {
  source: Source;
  taskType: string;
  briefDescription: string;
}

interface TaskResult extends Brief {
  title?: string;
  text?: string;
  metrics?: LanguageMetrics;
  judge?: z.infer<typeof judgeSchema>;
  error?: string;
}

interface LevelResult {
  level: SkillLevel;
  plan: { taskType: string; briefDescription: string }[];
  tasks: TaskResult[];
}

type Model = ReturnType<typeof buildChatModel>;

function describeTask(task: QuestionBankTaskContent): string {
  return `Title: ${task.title}\n\n${candidateReadingText(task)}`;
}

/** The pipeline retries a draft the model could not complete, so the evaluation does too. */
async function generateWithRetry(
  model: Model,
  level: SkillLevel,
  brief: Brief,
  attempts = 2,
): Promise<QuestionBankTaskContent> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await generateTaskContent({
        model,
        roleModule: GenericRoleModule,
        ...JOB,
        skillLevel: level,
        taskType: brief.taskType,
        briefDescription: brief.briefDescription,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function evaluateLevel(
  level: SkillLevel,
  generationModel: Model,
  taskModel: Model,
  judgeModel: Model,
): Promise<LevelResult> {
  const judge = withGeminiSafeStructuredOutput(judgeModel, judgeSchema);
  const planned = await requestTaskPlan(generationModel, {
    targetCount: 4,
    allowedTypes: GenericRoleModule.allowedTaskPatternTypes,
    ...JOB,
    skillLevel: level,
  });
  console.log(
    `[${level}] planned: ${planned.candidates.map((c) => c.taskType).join(', ')}`,
  );

  // Controlled briefs isolate the generator's wording; planned briefs test the whole chain from the planner.
  const briefs: Brief[] = [
    ...CASES.map((testCase) => ({
      source: 'controlled' as const,
      ...testCase,
    })),
    ...planned.candidates.map((candidate) => ({
      source: 'planned' as const,
      taskType: candidate.taskType,
      briefDescription: candidate.briefDescription,
    })),
  ];

  const tasks: TaskResult[] = [];
  for (const brief of briefs) {
    try {
      const task = await generateWithRetry(taskModel, level, brief);
      const text = describeTask(task);
      const verdict = await judge.invoke([
        new SystemMessage(JUDGE_PROMPT),
        new HumanMessage(text),
      ]);
      tasks.push({
        ...brief,
        title: task.title,
        text,
        metrics: languageMetrics(candidateReadingText(task)),
        judge: verdict,
      });
      console.log(
        `[${level}] ${brief.source} ${brief.taskType}: judged ${verdict.estimatedLevel}`,
      );
    } catch (error) {
      tasks.push({ ...brief, error: String(error) });
      console.log(
        `[${level}] ${brief.source} ${brief.taskType}: FAILED ${String(error).slice(0, 120)}`,
      );
    }
  }
  return { level, plan: planned.candidates, tasks };
}

const mean = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const levelIndex = (level: SkillLevel) => SKILL_LEVEL_VALUES.indexOf(level);

function summarise(results: LevelResult[]): void {
  console.log(
    '\nLevel          n  words  tech/100w  judge-jargon  judged-mean  exact  within-1  judged as',
  );
  let exact = 0;
  let within = 0;
  let total = 0;
  for (const result of results) {
    const ok = result.tasks.filter((task) => task.metrics && task.judge);
    const target = levelIndex(result.level);
    const judged = ok.map((task) => levelIndex(task.judge!.estimatedLevel));
    const levelExact = judged.filter((index) => index === target).length;
    const levelWithin = judged.filter(
      (index) => Math.abs(index - target) <= 1,
    ).length;
    exact += levelExact;
    within += levelWithin;
    total += ok.length;
    console.log(
      `${result.level.padEnd(14)} ${String(ok.length).padStart(1)}  ` +
        `${mean(ok.map((t) => t.metrics!.words))
          .toFixed(0)
          .padStart(5)}  ` +
        `${mean(ok.map((t) => t.metrics!.technicalPer100Words))
          .toFixed(1)
          .padStart(9)}  ` +
        `${mean(ok.map((t) => t.judge!.technicalJargon))
          .toFixed(1)
          .padStart(12)}  ` +
        `${mean(judged).toFixed(2).padStart(11)}  ` +
        `${String(levelExact).padStart(5)}  ${String(levelWithin).padStart(8)}  ` +
        `${ok.map((task) => task.judge!.estimatedLevel.split(' ')[0]).join(' ')}`,
    );
  }
  console.log(
    `\nBlind judge: ${exact} of ${total} exact, ${within} of ${total} within one level. A clear separation has the judged-mean rising with the level (0 Entry, 1 Junior, 2 Mid, 3 Senior).`,
  );
  const failed = results.reduce(
    (sum, r) => sum + r.tasks.filter((t) => t.error).length,
    0,
  );
  if (failed > 0)
    console.log(
      `${failed} generation(s) failed after retry and are not counted.`,
    );
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const levels = (
    requested.length ? requested : Object.values(SKILL_LEVEL)
  ).map((value) => {
    const level = Object.values(SKILL_LEVEL).find((known) => known === value);
    if (!level)
      throw new Error(
        `Unknown level "${value}". Use: ${Object.values(SKILL_LEVEL).join(', ')}`,
      );
    return level;
  });

  const config = new ConfigService({
    ai: {
      ...aiConfig,
      gemini: { ...aiConfig.gemini, apiKey: process.env.GEMINI_API_KEY },
      groq: { ...aiConfig.groq, apiKey: process.env.GROQ_API_KEY },
      fireworks: {
        ...aiConfig.fireworks,
        apiKey: process.env.FIREWORKS_API_KEY,
      },
    },
  });
  const generationModel = buildChatModel(
    config,
    'generationModel',
    'ai.generationTemperature',
  );
  const taskModel = buildChatModel(
    config,
    'taskGenerationModel',
    'ai.generationTemperature',
  );
  const judgeModel = buildChatModel(
    config,
    'criticModel',
    'ai.criticTemperature',
  );

  const results = await Promise.all(
    levels.map((level) =>
      evaluateLevel(level, generationModel, taskModel, judgeModel),
    ),
  );

  const directory = path.join(process.cwd(), 'tmp', 'seniority-eval');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(
    directory,
    `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(results, null, 2));

  summarise(results);
  console.log(`\nFull tasks: ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
