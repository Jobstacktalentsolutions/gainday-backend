import { InterfaceType, INTERFACE_SCHEMAS } from './interface-type';
import { chartDatasetSchema, materializeChartPresentation, validateChartPresentation } from './chart-presentation';
import { INTERACTION, type ObjectiveComponentType } from './role-module.interface';

export function answerControls(interfaceType: InterfaceType, objectiveType?: ObjectiveComponentType): string {
  const presentation = presentationCapability(interfaceType).description;
  const structured = objectiveType ? `Structured answer: ${objectiveType}.` : 'No structured answer control.';
  const reasons = objectiveType === INTERACTION.CLASSIFICATION || objectiveType === INTERACTION.PRIORITY_RANKING || objectiveType === INTERACTION.PROCEDURAL_SEQUENCING
    ? ' Optional item-specific reasons are available.' : '';
  return `${presentation}. ${structured}${reasons}`;
}

/** Presentation contracts shared across roles. Spec-backed tasks can still build their own data. */
export const PRESENTATION_CAPABILITIES = {
  [InterfaceType.TEXT_AREA]: { description: 'a written response field' },
  [InterfaceType.RICH_TEXT_COMPOSER]: { description: 'a formatted written response field' },
  [InterfaceType.TABLE_VIEW_RESPONSE_PANEL]: { description: 'a read-only data table and a written response field' },
  [InterfaceType.CSV_DATA_PANEL]: { description: 'a read-only downloadable data table and a written response field' },
  [InterfaceType.CASE_FILE_TEXT_AREA]: { description: 'read-only reference tabs and a written response field' },
  [InterfaceType.STAGED_CHAT]: { description: 'a staged conversation and read-only reference tabs' },
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
