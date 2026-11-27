import { InterfaceType, INTERFACE_SCHEMAS } from './interface-type';
import { chartDatasetSchema, materializeChartPresentation, validateChartPresentation } from './chart-presentation';
import { type ObjectiveComponentType } from './role-module.interface';

const OBJECTIVE_CONTROLS: Record<ObjectiveComponentType, string> = {
  CLASSIFICATION: 'classify items into supplied buckets',
  KEYED_CLASSIFICATION: 'classify items into supplied buckets',
  PRIORITY_RANKING: 'reorder all supplied items by priority',
  PROCEDURAL_SEQUENCING: 'reorder supplied steps',
  SINGLE_BEST_ACTION: 'choose one supplied option',
  MULTI_SELECT_UNDER_CONSTRAINT: 'choose the specified number of supplied options',
  NUMERIC_INPUT: 'enter one number',
  NUMERIC_TABLE: 'enter numbers in the supplied answer table',
  RECONCILIATION: 'assign a side to each item and enter an adjusted balance',
  JOURNAL_ENTRY: 'enter journal lines using the supplied references and accounts',
};

export function answerControls(interfaceType: InterfaceType, objectiveType?: ObjectiveComponentType): string {
  const presentation = presentationCapability(interfaceType).description;
  const structured = objectiveType ? `Structured answer: ${OBJECTIVE_CONTROLS[objectiveType]}.` : 'No structured answer control.';
  return `${presentation}. ${structured}`;
}

/** Presentation contracts shared across roles. Spec-backed tasks can still build their own data. */
export const PRESENTATION_CAPABILITIES = {
  [InterfaceType.TEXT_AREA]: { description: 'a written response field' },
  [InterfaceType.RICH_TEXT_COMPOSER]: { description: 'a formatted written response field' },
  [InterfaceType.TABLE_VIEW_RESPONSE_PANEL]: { description: 'a read-only data table and a written response field' },
  [InterfaceType.CSV_DATA_PANEL]: { description: 'a read-only downloadable data table and a written response field' },
  [InterfaceType.CASE_FILE_TEXT_AREA]: { description: 'read-only reference tabs and a written response field' },
  [InterfaceType.CASE_FILE_RICH_TEXT_COMPOSER]: { description: 'read-only reference tabs and a formatted written response editor supporting headings, lists, links and tables' },
  [InterfaceType.STAGED_CHAT]: { description: 'a staged conversation with reply fields and read-only reference tabs; no separate email or log editor' },
  [InterfaceType.TABLE_VIEW_WITH_CHART]: {
    description: 'a read-only chart and table with a written response field',
    inputSchema: chartDatasetSchema,
    guidance: 'Provide one dataset: each series has one number per category. For a waterfall use one series and one totals flag per category. Use empty totals for other charts. Include units in series names.',
    materialize: (value: unknown) => materializeChartPresentation(chartDatasetSchema.parse(value)),
    validate: validateChartPresentation,
  },
} as const;

export function presentationCapability(type: InterfaceType) {
  const capability: { description: string; inputSchema?: typeof INTERFACE_SCHEMAS[InterfaceType]; guidance?: string; materialize?: (value: unknown) => Record<string, unknown>; validate?: (value: unknown) => void } | undefined =
    type in PRESENTATION_CAPABILITIES ? PRESENTATION_CAPABILITIES[type as keyof typeof PRESENTATION_CAPABILITIES] : undefined;
  return { ...capability, inputSchema: capability?.inputSchema ?? INTERFACE_SCHEMAS[type] };
}
