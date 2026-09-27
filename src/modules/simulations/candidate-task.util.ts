import { SimulationTask } from '../../db/schema/simulations.schema';
import {
  ObjectiveComponentType,
  RoleModule,
} from '../generation/roles/role-module.interface';
import { RoleRegistry } from '../generation/roles/role-registry';

export interface CandidateObjectiveComponent {
  /** Tells the frontend which answer widget to render (see
   *  gainday-frontend/src/features/simulation-tasks/objectiveAnswerRenderers/registry.tsx) —
   *  resolved server-side from the role module, same source useTaskPatternTypes/
   *  /admin/task-pattern-types uses, so the candidate side never needs that admin-only route. */
  componentType: ObjectiveComponentType;
  [key: string]: unknown;
}

export type CandidateSimulationTask = Omit<
  SimulationTask,
  'objectiveComponent'
> & {
  objectiveComponent: CandidateObjectiveComponent | null;
};

// The one field per component type that hands the candidate the correct answer outright.
// Never sent to a candidate before they've submitted — see sanitizeTaskForCandidate.
const ANSWER_KEY_FIELDS: Record<ObjectiveComponentType, string> = {
  SINGLE_BEST_ACTION: 'correctOptionIndex',
  MULTI_SELECT_UNDER_CONSTRAINT: 'correctOptionIndices',
  NUMERIC_INPUT: 'correctValue',
  CLASSIFICATION: 'correctMapping',
  PROCEDURAL_SEQUENCING: 'correctOrder',
};

function resolvePatternType(task: SimulationTask, roleRegistry: RoleRegistry) {
  let roleModule: RoleModule;
  try {
    roleModule = roleRegistry.resolve(task.category);
  } catch {
    return undefined;
  }
  return roleModule.allowedTaskPatternTypes.find(
    (pt) => pt.key === task.taskType,
  );
}

/**
 * GET /simulations/job/:jobId is the one route a candidate (or, before sign-in, anyone) calls
 * to fetch simulation tasks — unlike the employer's GET /jobs/:id/with-simulation, it must
 * never leak an objectiveComponent's answer-key field. Strips that field and tags the
 * component with its componentType (resolved the same way /admin/task-pattern-types does,
 * via the role registry) so the frontend can pick the right answer widget without needing
 * that admin-only endpoint.
 */
export function sanitizeTaskForCandidate(
  task: SimulationTask,
  roleRegistry: RoleRegistry,
): CandidateSimulationTask {
  const { objectiveComponent, ...rest } = task;
  const componentType = resolvePatternType(
    task,
    roleRegistry,
  )?.objectiveComponentType;

  if (objectiveComponent == null || !componentType) {
    return { ...rest, objectiveComponent: null };
  }

  const sanitized = { ...objectiveComponent };
  delete sanitized[ANSWER_KEY_FIELDS[componentType]];

  return { ...rest, objectiveComponent: { ...sanitized, componentType } };
}
