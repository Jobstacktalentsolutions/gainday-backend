import { z } from 'zod';
import { InterfaceType, SAVED_INTERFACE_SCHEMAS, wordLimitSchema, type TableViewWithChartPayload } from './interface-type';
import { TaskSpecError } from './role-module.interface';

const CHART_TYPE = { BAR: 'bar', LINE: 'line', COMBO: 'combo', WATERFALL: 'waterfall' } as const;
const AXIS = { PRIMARY: 'primary', SECONDARY: 'secondary' } as const;
const CHART_CATEGORY_KEY = 'category';

// One model-generated dataset is the source for both views. The uniform shape also avoids
// provider-specific structured-output unions; unused series fields are ignored for simple charts.
export const chartDatasetSchema = z.object({
  type: z.enum([CHART_TYPE.BAR, CHART_TYPE.LINE, CHART_TYPE.COMBO, CHART_TYPE.WATERFALL]),
  categoryLabel: z.string().describe('Heading for the category column.'),
  categories: z.array(z.string()).min(2).max(12),
  series: z.array(z.object({
    name: z.string(),
    values: z.array(z.number()),
    kind: z.enum([CHART_TYPE.BAR, CHART_TYPE.LINE]),
    axis: z.enum([AXIS.PRIMARY, AXIS.SECONDARY]),
  })).min(1).max(4),
  totals: z.array(z.boolean()).describe('For a waterfall, one flag per category; otherwise an empty array.'),
  placeholder: z.string().nullable(),
  wordLimit: wordLimitSchema,
});

type ChartDataset = z.infer<typeof chartDatasetSchema>;

export function materializeChartPresentation(input: ChartDataset) {
  const { type, categories, series, totals } = input;
  const names = series.map((item) => item.name.trim());
  if (!input.categoryLabel.trim() || categories.some((item) => !item.trim()) ||
      new Set(categories).size !== categories.length || names.some((name) => !name || name === CHART_CATEGORY_KEY) ||
      new Set(names).size !== names.length ||
      series.some((item) => item.values.length !== categories.length || item.values.some((value) => !Number.isFinite(value)))) {
    throw new TaskSpecError('Chart labels must be unique and each series must have a finite value for every category.');
  }
  if (type === CHART_TYPE.WATERFALL && (series.length !== 1 || totals.length !== categories.length)) {
    throw new TaskSpecError('A waterfall needs one series and a total flag for every category.');
  }
  const chart = type === CHART_TYPE.WATERFALL
    ? { type, categories, values: series[0].values, totals }
    : type === CHART_TYPE.COMBO
      ? { type, categories, series: series.map((item) => ({ ...item, name: item.name.trim() })) }
      : { type, categories, series: series.map(({ name, values }) => ({ name: name.trim(), values })) };

  return {
    interfaceType: InterfaceType.TABLE_VIEW_WITH_CHART,
    table: {
      columns: [input.categoryLabel, ...names],
      rows: categories.map((category, index) => [category, ...series.map((item) => String(item.values[index]))]),
    },
    chart,
    placeholder: input.placeholder,
    wordLimit: input.wordLimit,
  };
}

/** Ensure a saved table and chart still describe the same dataset. */
export function validateChartPresentation(value: unknown): void {
  const parsed = SAVED_INTERFACE_SCHEMAS[InterfaceType.TABLE_VIEW_WITH_CHART].parse(value) as TableViewWithChartPayload;
  const { chart, table } = parsed;
  const series = chart.type === CHART_TYPE.WATERFALL
    ? [{ name: table.columns[1], values: chart.values }]
    : chart.series;
  if (chart.type === CHART_TYPE.WATERFALL && chart.totals.length !== chart.categories.length) {
    throw new TaskSpecError('The waterfall must have a total flag for every category.');
  }
  if (series.length === 0 || table.columns.length !== series.length + 1 ||
      table.rows.length !== chart.categories.length ||
      series.some((item, index) => !item.name || table.columns[index + 1] !== item.name || item.values.length !== chart.categories.length) ||
      table.rows.some((row, index) => row.length !== series.length + 1 || row[0] !== chart.categories[index] ||
        series.some((item, column) => row[column + 1] !== String(item.values[index])))) {
    throw new TaskSpecError('The chart and table must show the same labels and figures.');
  }
}
