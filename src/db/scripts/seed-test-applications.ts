/**
 * Test helper: applies every @example.com test candidate to each active job posted by an employer
 * named "Roger Smith". Submissions are written already GRADED, with made-up answers and scores, so
 * the AI grading stage is skipped. Answers pass the same validation a real submission does, and
 * the roll-up and capability update match what grading writes. Candidates who already applied to
 * a job are skipped.
 *
 * Dry run by default. Pass --apply to write.
 *   pnpm db:seed-test-applications               preview the applications
 *   pnpm db:seed-test-applications -- --apply    write them
 *
 * Undo: DELETE FROM submissions WHERE candidate_id IN (SELECT jsp.id FROM job_seeker_profiles jsp
 *       JOIN users u ON u.id = jsp.user_id WHERE u.email LIKE '%@example.com');
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { and, eq, inArray, like } from 'drizzle-orm';
import { createDb, createDbPool } from '../client';
import {
  CandidateAnswer,
  CategoryScoreDetail,
  CategoryScores,
  employerProfiles,
  jobExtractions,
  jobs,
  jobSeekerProfiles,
  simulations,
  SimulationTask,
  submissions,
  TaskGradingResult,
  users,
} from '../schema';
import { RoleRegistry } from '../../modules/generation/roles/role-registry';
import { AnchorRoleRegistry } from '../../modules/grading/roles/anchor-role-registry';
import { rollUpTaskScores } from '../../modules/grading/roll-up';
import { parseAnswers } from '../../modules/submissions/answer-validation';

const EMPLOYER_NAME = 'Roger Smith';

type Tier = 'strong' | 'partial' | 'weak';

// Which candidates suit each simulation's domain, so the made-up answers differ in a believable
// way. Anyone not listed is weak for that domain. Keys are the first segment of the task category.
const FIT_BY_DOMAIN: Record<string, { strong: string[]; partial: string[] }> = {
  Finance: {
    strong: ['Management Accountant', 'Data Analyst', 'Data Scientist'],
    partial: ['Accounts Clerk', 'Product Manager', 'Operations Manager'],
  },
  Sales: {
    strong: ['Sales Executive', 'Customer Success Manager', 'Digital Marketing Manager'],
    partial: ['Content Marketer', 'SEO Specialist', 'Product Owner', 'Operations Manager'],
  },
};

const TIER_SCORE: Record<Tier, number> = { strong: 84, partial: 66, weak: 48 };

const WRITTEN_ANSWER: Record<Tier, (task: string) => string> = {
  strong: (task) =>
    `I reconciled the key figures before drawing any conclusion for "${task}". The recommendation is tied to the main driver, with a clear next action, an owner and a date.`,
  partial: (task) =>
    `I worked through the main drivers for "${task}" and reached a reasonable recommendation. The risks and trade-offs need more development before this goes to leadership.`,
  weak: (task) =>
    `My answer for "${task}" leans on the headline numbers without testing the assumptions behind them. I would need more analysis before recommending a course of action.`,
};

const SUMMARY: Record<Tier, (task: string) => string> = {
  strong: (task) => `Sound reasoning and a well-supported conclusion for "${task}".`,
  partial: (task) =>
    `A reasonable approach to "${task}", but the analysis needs more depth on risks and assumptions.`,
  weak: (task) =>
    `The conclusion for "${task}" is not well supported, and key considerations are missing.`,
};

const RATIONALE: Record<Tier, string> = {
  strong: 'the method and conclusion hold up',
  partial: 'the approach is reasonable but under-developed',
  weak: 'key steps are missing or unsupported',
};

const CATEGORY_KEYS = [
  'problemSolving',
  'judgmentExecution',
  'writtenCommunication',
  'commercialDomainAwareness',
] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  problemSolving: 'Problem-solving',
  judgmentExecution: 'Judgment/execution',
  writtenCommunication: 'Written communication',
  commercialDomainAwareness: 'Commercial/domain awareness',
};

interface TargetJob {
  jobId: string;
  title: string;
  role: string | null;
  simulationId: string;
  tasks: SimulationTask[];
  extractionCategory: string | null;
}

interface TestCandidate {
  profileId: string;
  title: string;
  index: number;
}

interface PlannedSubmission {
  candidate: TestCandidate;
  job: TargetJob;
  tier: Tier;
  overallScore: number;
  answers: CandidateAnswer[];
  taskScores: TaskGradingResult[];
  categoryScores: CategoryScores;
  capabilityDomain: string;
  timeTakenSeconds: number;
}

const tierFor = (domain: string, title: string): Tier => {
  const fit = FIT_BY_DOMAIN[domain];
  if (fit?.strong.includes(title)) return 'strong';
  if (fit?.partial.includes(title)) return 'partial';
  return 'weak';
};

const clampScore = (score: number): number => Math.min(100, Math.max(0, score));

function buildSubmission(
  candidate: TestCandidate,
  job: TargetJob,
): PlannedSubmission {
  const capabilityDomain =
    job.extractionCategory ?? job.role ?? 'Unspecified';
  const domainKey = capabilityDomain.split('>')[0].trim();
  const tier = tierFor(domainKey, candidate.title);

  // Objective parts are left null: the app's answer validator accepts no objective response for
  // these tasks (their taskType is not registered in the role module), so none can be submitted.
  const envelopes = job.tasks.map((task, taskIndex) => {
    const textResponse = WRITTEN_ANSWER[tier](task.title);
    return {
      taskId: task.id,
      responseBody: textResponse,
      textResponse,
      objectiveResponse: null,
      timeSpentSeconds: 240 + ((taskIndex * 97 + candidate.index * 31) % 600),
    };
  });

  // Validated the same way a real submission is, so an answer the grader cannot read fails here.
  const answers = parseAnswers(envelopes, job.tasks, new RoleRegistry());

  const taskScores: TaskGradingResult[] = job.tasks.map((task, taskIndex) => {
    if (!task.questionBankId) {
      throw new Error(`Task ${task.id} has no question_bank row to grade against`);
    }
    const categoryScores = {} as CategoryScores;
    CATEGORY_KEYS.forEach((key, categoryIndex) => {
      const variation =
        ((taskIndex * 3 + categoryIndex * 5 + candidate.index * 7) % 9) - 4;
      const detail: CategoryScoreDetail = {
        score: clampScore(TIER_SCORE[tier] + variation),
        rationale: `${CATEGORY_LABELS[key]}: ${RATIONALE[tier]}.`,
        evidence: `Response: "${envelopes[taskIndex].textResponse.split(' ').slice(0, 12).join(' ')}..."`,
      };
      categoryScores[key] = detail;
    });
    return {
      taskId: task.id,
      questionBankId: task.questionBankId,
      categoryScores,
      summary: SUMMARY[tier](task.title),
    };
  });

  const taskTitleById = new Map(job.tasks.map((task) => [task.id, task.title]));
  const weights = new AnchorRoleRegistry().resolve(capabilityDomain).categoryWeights;
  const { categoryScores, overallScore } = rollUpTaskScores(
    taskScores,
    taskTitleById,
    weights,
  );

  return {
    candidate,
    job,
    tier,
    overallScore,
    answers,
    taskScores,
    categoryScores,
    capabilityDomain,
    timeTakenSeconds: answers.reduce((sum, a) => sum + a.timeSpentSeconds, 0),
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const apply = process.argv.includes('--apply');
  const pool = createDbPool(process.env.DATABASE_URL);
  const db = createDb(pool);

  try {
    const targetRows = await db
      .select({
        jobId: jobs.id,
        title: jobs.title,
        role: jobs.role,
        simulationId: simulations.id,
        tasks: simulations.tasks,
        extractionCategory: jobExtractions.category,
      })
      .from(jobs)
      .innerJoin(employerProfiles, eq(employerProfiles.id, jobs.employerId))
      .innerJoin(simulations, eq(simulations.jobId, jobs.id))
      .leftJoin(jobExtractions, eq(jobExtractions.jobId, jobs.id))
      .where(
        and(
          eq(employerProfiles.fullName, EMPLOYER_NAME),
          eq(jobs.status, 'ACTIVE'),
        ),
      );
    const targets: TargetJob[] = targetRows.map((row) => ({
      ...row,
      title: row.title ?? 'Untitled role',
    }));

    const candidateRows = await db
      .select({ profileId: jobSeekerProfiles.id, title: jobSeekerProfiles.title })
      .from(jobSeekerProfiles)
      .innerJoin(users, eq(users.id, jobSeekerProfiles.userId))
      .where(like(users.email, '%@example.com'));
    const candidates: TestCandidate[] = candidateRows.flatMap((row, index) =>
      row.title ? [{ profileId: row.profileId, title: row.title, index }] : [],
    );

    const existing = await db
      .select({ candidateId: submissions.candidateId, jobId: submissions.jobId })
      .from(submissions)
      .where(
        and(
          inArray(
            submissions.candidateId,
            candidates.map((c) => c.profileId),
          ),
          inArray(
            submissions.jobId,
            targets.map((t) => t.jobId),
          ),
        ),
      );
    const alreadyApplied = new Set(
      existing.map((row) => `${row.candidateId}:${row.jobId}`),
    );

    const plan: PlannedSubmission[] = [];
    for (const job of targets) {
      for (const candidate of candidates) {
        if (alreadyApplied.has(`${candidate.profileId}:${job.jobId}`)) continue;
        plan.push(buildSubmission(candidate, job));
      }
    }

    console.log(`Target: ${new URL(process.env.DATABASE_URL).host}`);
    console.log(
      `${targets.length} active job(s) by "${EMPLOYER_NAME}", ${candidates.length} test candidate(s), ${plan.length} application(s) to create, ${alreadyApplied.size} already exist`,
    );
    console.table(
      plan.map((item) => ({
        job: item.job.title,
        candidate: item.candidate.title,
        fit: item.tier,
        overallScore: item.overallScore,
      })),
    );

    if (!apply) {
      console.log(
        'Dry run: nothing written. Re-run with -- --apply to write these applications.',
      );
      return;
    }

    for (const item of plan) {
      const completedAt = new Date();
      const startedAt = new Date(
        completedAt.getTime() - item.timeTakenSeconds * 1000,
      );
      await db.transaction(async (tx) => {
        await tx.insert(submissions).values({
          jobId: item.job.jobId,
          simulationId: item.job.simulationId,
          candidateId: item.candidate.profileId,
          status: 'GRADED',
          answers: item.answers,
          taskScores: item.taskScores,
          categoryScores: item.categoryScores,
          overallScore: item.overallScore,
          timeTakenSeconds: item.timeTakenSeconds,
          startedAt,
          completedAt,
          lastHeartbeatAt: completedAt,
        });

        // Same write grading makes: the candidate's score for this domain, so the passport shows it.
        const [profile] = await tx
          .select({ capabilityScores: jobSeekerProfiles.capabilityScores })
          .from(jobSeekerProfiles)
          .where(eq(jobSeekerProfiles.id, item.candidate.profileId));
        const categories = {
          problemSolving: item.categoryScores.problemSolving.score,
          judgmentExecution: item.categoryScores.judgmentExecution.score,
          writtenCommunication: item.categoryScores.writtenCommunication.score,
          commercialDomainAwareness:
            item.categoryScores.commercialDomainAwareness.score,
        };
        await tx
          .update(jobSeekerProfiles)
          .set({
            capabilityScores: {
              ...(profile?.capabilityScores ?? {}),
              [item.capabilityDomain]: {
                score: item.overallScore,
                updatedAt: completedAt.toISOString(),
                categories,
              },
            },
            updatedAt: completedAt,
          })
          .where(eq(jobSeekerProfiles.id, item.candidate.profileId));
      });
    }
    console.log(`Created ${plan.length} application(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
