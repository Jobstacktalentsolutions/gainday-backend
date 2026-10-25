import { z } from 'zod';

/**
 * Interface-type taxonomy (doc Section 2.5) — tells the frontend how to render a task.
 * These are the current sales-derived MVP baseline. A new role that needs a render mode none
 * of these cover (e.g. finance charts/computed figures, doc Section 10) adds a new member here
 * AND a matching entry in INTERFACE_SCHEMAS — the enum and its schema map are extended
 * together, one file, so every interface type that exists always has a concrete payload
 * contract (never just a tag string with an unknown shape).
 *
 * Convention: free-text fields in these payloads (and the shared `scenarioDescription`/
 * `questionPrompt` on the task itself — see MarkdownString in question-bank.schema.ts) are
 * GitHub-flavored Markdown — plain text is valid markdown, so use markdown syntax (bold,
 * bullets, paragraphs) only where structure genuinely aids readability, never pre-rendered HTML.
 * The frontend must render this through a renderer that does not interpret raw HTML in the
 * source (e.g. react-markdown without rehype-raw), so content can never inject arbitrary markup.
 */
export enum InterfaceType {
  RICH_TEXT_COMPOSER = 'RICH_TEXT_COMPOSER',
  TEXT_AREA = 'TEXT_AREA',
  TABLE_VIEW_RESPONSE_PANEL = 'TABLE_VIEW_RESPONSE_PANEL',
  CSV_DATA_PANEL = 'CSV_DATA_PANEL',
  TABLE_VIEW_WITH_CHART = 'TABLE_VIEW_WITH_CHART',
  CASE_FILE_TEXT_AREA = 'CASE_FILE_TEXT_AREA',
  STAGED_CHAT = 'STAGED_CHAT',
}

// z.literal() compiles to JSON-Schema `const`, which Gemini's schema parser rejects
// ("Unknown name 'const'... Cannot find field"). z.enum([x]) with one value compiles to
// `enum: [x]`, which Gemini does support and which still only accepts that one value.
const richTextComposerSchema = z.object({
  interfaceType: z.enum([InterfaceType.RICH_TEXT_COMPOSER]),
  // Required + nullable, not .optional(): structured-output models commonly emit an explicit
  // `null` for an unfilled field rather than omitting the key, and z.optional().nullable()
  // compiles to an `anyOf`/`not` shape neither Gemini nor Groq's schema validators accept —
  // plain .nullable() compiles to a clean `type: [X, "null"]` both providers handle.
  placeholder: z.string().nullable(),
});

const textAreaSchema = z.object({
  interfaceType: z.enum([InterfaceType.TEXT_AREA]),
  // Required + nullable, not .optional(): structured-output models commonly emit an explicit
  // `null` for an unfilled field rather than omitting the key, and z.optional().nullable()
  // compiles to an `anyOf`/`not` shape neither Gemini nor Groq's schema validators accept —
  // plain .nullable() compiles to a clean `type: [X, "null"]` both providers handle.
  placeholder: z.string().nullable(),
});

const tableViewResponsePanelSchema = z.object({
  interfaceType: z.enum([InterfaceType.TABLE_VIEW_RESPONSE_PANEL]),
  table: z.object({
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  // Required + nullable, not .optional(): structured-output models commonly emit an explicit
  // `null` for an unfilled field rather than omitting the key, and z.optional().nullable()
  // compiles to an `anyOf`/`not` shape neither Gemini nor Groq's schema validators accept —
  // plain .nullable() compiles to a clean `type: [X, "null"]` both providers handle.
  placeholder: z.string().nullable(),
});

// The same candidate experience as TABLE_VIEW_RESPONSE_PANEL (a data table to work from, then a
// written answer), but the data travels as CSV text: far shorter for a model to produce than a
// nested array of rows, and the candidate can download it to open in a spreadsheet. Whether the
// CSV is well-formed cannot be expressed here (strict Structured Outputs reject refinements), so
// findCsvProblem (utils/csv.util.ts) checks it in the critic and when an employer edits a task.
const csvDataPanelSchema = z.object({
  interfaceType: z.enum([InterfaceType.CSV_DATA_PANEL]),
  csv: z
    .string()
    .describe(
      'The data set as CSV: one header row naming every column, then data rows, comma-separated, with any field that contains a comma wrapped in double quotes. At most 25 data rows.',
    ),
  // Required + nullable — see richTextComposerSchema above.
  placeholder: z.string().nullable(),
});

// A data table with a chart drawn from the same numbers (finance doc Section 5): the chart series
// are columns of the table, so the two cannot disagree. Both are built in code from one dataset
// (see roles/finance), never written by the model.
// Four chart shapes (finance doc Section 5). Bar and line share one series shape. A combo draws each
// series as bars or a line, on a primary or secondary axis. A waterfall is a bridge: each value is a
// step, and a total step starts again from zero. Every shape has equal-length arrays; the templates check that.
const seriesSchema = z.object({ name: z.string(), values: z.array(z.number()) });

const barOrLineChartSchema = z.object({
  type: z.enum(['bar', 'line']),
  categories: z.array(z.string()),
  series: z.array(seriesSchema),
});

const comboChartSchema = z.object({
  type: z.literal('combo'),
  categories: z.array(z.string()),
  series: z.array(
    seriesSchema.extend({
      kind: z.enum(['bar', 'line']),
      axis: z.enum(['primary', 'secondary']),
    }),
  ),
});

const waterfallChartSchema = z.object({
  type: z.literal('waterfall'),
  categories: z.array(z.string()),
  values: z.array(z.number()),
  totals: z.array(z.boolean()),
});

const chartSchema = z.union([barOrLineChartSchema, comboChartSchema, waterfallChartSchema]);

const tableViewWithChartSchema = z.object({
  interfaceType: z.enum([InterfaceType.TABLE_VIEW_WITH_CHART]),
  table: z.object({
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  chart: chartSchema,
  placeholder: z.string().nullable(),
});

// Customer service (customer service doc Section 4): read-only reference tabs the candidate works
// from (customer record, ticket, policy, queue), then a written answer. `wordLimit` sets the
// length the task asks for; null keeps the default field limits.
const caseFileTextAreaSchema = z.object({
  interfaceType: z.enum([InterfaceType.CASE_FILE_TEXT_AREA]),
  caseFile: z.object({
    tabs: z
      .array(
        z.object({
          label: z.string(),
          content: z.string().describe('GitHub-flavored Markdown.'),
        }),
      )
      .min(1),
  }),
  wordLimit: z
    .object({ min: z.number().int().nonnegative(), max: z.number().int().positive() })
    .nullable(),
  placeholder: z.string().nullable(),
});

// Staged chat (customer service doc Section 2.8): the candidate-visible part only. The scripted
// customer messages, delays, checkpoints and branches are server-only and live on the question-bank
// row, so this schema is strict: an extra key, such as a message, is rejected rather than stripped.
export const STAGED_CHAT_TURN_COUNTS = [3, 4] as const;
export const STAGED_CHAT_TAB_LABELS = ['Customer record', 'Ticket history', 'Policy'] as const;

const stagedChatSchema = z
  .object({
    interfaceType: z.enum([InterfaceType.STAGED_CHAT]),
    displayName: z.string().min(1),
    caseFile: z.object({
      tabs: z
        .array(z.object({ label: z.string(), content: z.string() }))
        .length(STAGED_CHAT_TAB_LABELS.length),
    }),
    wordLimit: z.object({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
    }),
    turnCount: z.union([z.literal(3), z.literal(4)]),
    placeholder: z.string().nullable(),
  })
  .strict();

export type StagedChatPayload = z.infer<typeof stagedChatSchema>;

/**
 * Per-type Zod schemas describing exactly what the frontend needs to render that interface —
 * the contract for `SimulationTask.interfacePayload`. This is a Record keyed by every
 * InterfaceType member, so TypeScript enforces a schema exists for each one — there is no way
 * for an interface type to exist without a concrete payload contract behind it.
 */
export const INTERFACE_SCHEMAS: Record<InterfaceType, z.ZodTypeAny> = {
  [InterfaceType.RICH_TEXT_COMPOSER]: richTextComposerSchema,
  [InterfaceType.TEXT_AREA]: textAreaSchema,
  [InterfaceType.TABLE_VIEW_RESPONSE_PANEL]: tableViewResponsePanelSchema,
  [InterfaceType.CSV_DATA_PANEL]: csvDataPanelSchema,
  [InterfaceType.TABLE_VIEW_WITH_CHART]: tableViewWithChartSchema,
  [InterfaceType.CASE_FILE_TEXT_AREA]: caseFileTextAreaSchema,
  [InterfaceType.STAGED_CHAT]: stagedChatSchema,
};

export type RichTextComposerPayload = z.infer<typeof richTextComposerSchema>;
export type TextAreaPayload = z.infer<typeof textAreaSchema>;
export type TableViewResponsePanelPayload = z.infer<
  typeof tableViewResponsePanelSchema
>;
export type CsvDataPanelPayload = z.infer<typeof csvDataPanelSchema>;
export type CaseFileTextAreaPayload = z.infer<typeof caseFileTextAreaSchema>;
export type TableViewWithChartPayload = z.infer<
  typeof tableViewWithChartSchema
>;
