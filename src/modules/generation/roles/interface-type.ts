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
}

const richTextComposerSchema = z.object({
  interfaceType: z.literal(InterfaceType.RICH_TEXT_COMPOSER),
  placeholder: z.string().optional(),
});

const textAreaSchema = z.object({
  interfaceType: z.literal(InterfaceType.TEXT_AREA),
  placeholder: z.string().optional(),
});

const tableViewResponsePanelSchema = z.object({
  interfaceType: z.literal(InterfaceType.TABLE_VIEW_RESPONSE_PANEL),
  table: z.object({
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  placeholder: z.string().optional(),
});

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
};

export type RichTextComposerPayload = z.infer<typeof richTextComposerSchema>;
export type TextAreaPayload = z.infer<typeof textAreaSchema>;
export type TableViewResponsePanelPayload = z.infer<
  typeof tableViewResponsePanelSchema
>;
