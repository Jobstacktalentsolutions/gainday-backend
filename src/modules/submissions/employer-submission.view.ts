import type {
  AntiCheatEvent,
  CategoryScores,
  SimulationTask,
  SubmissionStatus,
  TaskGradingResult,
} from '../../db/schema';

export type IntegrityStatus =
  'CLEAN' | 'MINOR_FLAGS' | 'PENDING' | 'REVIEW_NEEDED';

// More than this many recorded events, or any server-observed stale heartbeat, needs a human
// look. Placeholder threshold — tune once real submissions show what normal noise looks like.
export const INTEGRITY_REVIEW_THRESHOLD = 5;

const SERVER_STALE_HEARTBEAT = 'server-stale-heartbeat';

/** Statuses at which the anti-cheat log is final and can be judged. */
const GRADED_STATUSES: SubmissionStatus[] = [
  'GRADED',
  'SELECTED',
  'NOT_SELECTED',
  'DISQUALIFIED',
];

export function deriveIntegrityStatus(
  status: SubmissionStatus,
  events: AntiCheatEvent[],
): IntegrityStatus {
  if (!GRADED_STATUSES.includes(status)) {
    return 'PENDING';
  }
  if (events.length === 0) {
    return 'CLEAN';
  }
  const hasStaleHeartbeat = events.some(
    (event) => event.type === SERVER_STALE_HEARTBEAT,
  );
  return hasStaleHeartbeat || events.length > INTEGRITY_REVIEW_THRESHOLD
    ? 'REVIEW_NEEDED'
    : 'MINOR_FLAGS';
}

/** Distinct event types with how often each was recorded, most frequent first. The frontend
 *  owns the human-readable label for each type. */
export function summarizeIntegrityEvents(
  events: AntiCheatEvent[],
): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/** "GD-" plus the first six characters of the submission id — there is no stored reference. */
export function toDisplayId(submissionId: string): string {
  return `GD-${submissionId.slice(0, 6).toUpperCase()}`;
}

// Scores are already whole numbers on the 0-100 scale (see grading/roll-up.ts).
export function toCategoryScores(categoryScores: CategoryScores) {
  return {
    problemSolving: categoryScores.problemSolving.score,
    judgmentExecution: categoryScores.judgmentExecution.score,
    writtenCommunication: categoryScores.writtenCommunication.score,
    commercialDomainAwareness: categoryScores.commercialDomainAwareness.score,
  };
}

/**
 * One task's score out of 100: the plain average of its four category scores (each a whole number 0-100).
 */
export function taskScorePercent(result: TaskGradingResult): number {
  const {
    problemSolving,
    judgmentExecution,
    writtenCommunication,
    commercialDomainAwareness,
  } = result.categoryScores;
  const average =
    (problemSolving.score +
      judgmentExecution.score +
      writtenCommunication.score +
      commercialDomainAwareness.score) /
    4;
  return Math.round(average);
}

/** Graded tasks only, in the simulation's task order; `taskNumber` is the position in the
 *  simulation. `evidence` is the grader's candidate-facing summary for the task. */
export function buildTaskResults(
  simulationTasks: Pick<SimulationTask, 'id' | 'title'>[],
  taskScores: TaskGradingResult[] | null,
) {
  const resultByTaskId = new Map(
    (taskScores ?? []).map((result) => [result.taskId, result]),
  );
  return simulationTasks.flatMap((task, index) => {
    const result = resultByTaskId.get(task.id);
    if (!result) {
      return [];
    }
    return [
      {
        taskId: task.id,
        taskNumber: index + 1,
        title: task.title,
        score: taskScorePercent(result),
        evidence: result.summary,
      },
    ];
  });
}

/**
 * A submission's contribution to the capability score: the average of those three category scores
 * (0-100) multiplied by 10, so out of 1000. Only the three categories
 * that apply across every domain are used — commercial/domain awareness is left out because a
 * candidate's past results may come from other domains (see the grading pipeline doc's
 * "Remaining Gaps").
 */
export function capabilityPoints(categoryScores: CategoryScores): number {
  const average =
    (categoryScores.problemSolving.score +
      categoryScores.judgmentExecution.score +
      categoryScores.writtenCommunication.score) /
    3;
  return Math.round(average * 10);
}

/** Running average after each application, oldest first, so the last entry is the candidate's
 *  current capability score. Every application weighs the same for now. */
export function runningAverage(points: number[]): number[] {
  let sum = 0;
  return points.map((point, index) => {
    sum += point;
    return Math.round(sum / (index + 1));
  });
}
