import { SimulationTask } from '../../db/schema/simulations.schema';
import {
  ObjectiveComponentType,
  RoleModule,
} from '../generation/roles/role-module.interface';
import { RoleRegistry } from '../generation/roles/role-registry';
import {
  journalEntrySchema,
  keyedClassificationSchema,
  numericTableSchema,
  reconciliationSchema,
} from '../generation/roles/component-schemas';

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

type StoredComponent = Record<string, unknown>;

function omitKeys(...keys: string[]) {
  return (component: StoredComponent): StoredComponent =>
    Object.fromEntries(
      Object.entries(component).filter(([key]) => !keys.includes(key)),
    );
}

// What the candidate may see of each stored objective component: everything except the answer key,
// and any tolerance that would reveal how exact the answer must be. Typed as a Record over every
// component type, so a new type cannot ship without deciding what the candidate sees of it.
const CANDIDATE_VIEW: Record<
  ObjectiveComponentType,
  (component: StoredComponent) => StoredComponent
> = {
  SINGLE_BEST_ACTION: omitKeys('correctOptionIndex'),
  MULTI_SELECT_UNDER_CONSTRAINT: omitKeys('correctOptionIndices'),
  // Older rows may still hold a stored mapping; it is stripped so it never leaks.
  CLASSIFICATION: omitKeys('correctMapping'),
  PROCEDURAL_SEQUENCING: omitKeys('correctOrder'),
  PRIORITY_RANKING: (component) => component, // no answer key: the anchors define a good ordering
  NUMERIC_INPUT: omitKeys('correctValue', 'tolerance'),
  RECONCILIATION: (component) => {
    const { items, sideOptions, unit } = reconciliationSchema.parse(component);
    return { items, sideOptions, unit };
  },
  JOURNAL_ENTRY: (component) => {
    const { accounts, entries, unit } = journalEntrySchema.parse(component);
    return { accounts, references: entries.map((entry) => entry.reference), unit };
  },
  KEYED_CLASSIFICATION: (component) => {
    const { items, buckets } = keyedClassificationSchema.parse(component);
    return { items, buckets };
  },
  NUMERIC_TABLE: (component) => {
    const { rowLabels, columns } = numericTableSchema.parse(component);
    return { rowLabels, columnLabels: columns.map((column) => column.label) };
  },
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
  // The rubric holds the gate and checklist the answer is graded on, so it never reaches the candidate.
  const { objectiveComponent, rubric: _rubric, ...rest } = task;
  const componentType = resolvePatternType(
    task,
    roleRegistry,
  )?.objectiveComponentType;

  if (objectiveComponent == null || !componentType) {
    return { ...rest, objectiveComponent: null };
  }

  return {
    ...rest,
    objectiveComponent: {
      ...CANDIDATE_VIEW[componentType](objectiveComponent),
      componentType,
    },
  };
}
