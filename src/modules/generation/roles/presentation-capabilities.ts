import { InterfaceType, INTERFACE_SCHEMAS } from './interface-type';
import { chartDatasetSchema, materializeChartPresentation, validateChartPresentation } from './chart-presentation';

/** Presentation contracts shared across roles. Spec-backed tasks can still build their own data. */
export const PRESENTATION_CAPABILITIES = {
  [InterfaceType.TEXT_AREA]: { description: 'a short written answer' },
  [InterfaceType.RICH_TEXT_COMPOSER]: { description: 'a drafted document' },
  [InterfaceType.TABLE_VIEW_RESPONSE_PANEL]: { description: 'tabular evidence' },
  [InterfaceType.CSV_DATA_PANEL]: { description: 'tabular evidence available as CSV' },
  [InterfaceType.CASE_FILE_TEXT_AREA]: { description: 'reference documents in tabs' },
  [InterfaceType.TABLE_VIEW_WITH_CHART]: {
    description: 'a chart and table for numerical comparisons, trends or changes',
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
