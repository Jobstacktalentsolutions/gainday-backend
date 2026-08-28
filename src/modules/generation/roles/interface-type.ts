import { z } from 'zod';

/**
 * Interface-type taxonomy (doc Section 2.5) — tells the frontend how to render a task.
 * Shared base types below are the current sales-derived MVP baseline; role modules are free
 * to introduce additional string keys of their own (e.g. finance charts/computed figures,
 * per Section 2.5's extensibility note) rather than being constrained to this list.
 */
export const BASE_INTERFACE_TYPES = [
  'RICH_TEXT_COMPOSER',
  'TEXT_AREA',
  'TABLE_VIEW_RESPONSE_PANEL',
] as const;

export type BaseInterfaceType = (typeof BASE_INTERFACE_TYPES)[number];

/** A role module's task-pattern type carries any string key here — not limited to
 *  BaseInterfaceType — so a new role can define its own render modes without editing this file. */
export type InterfaceType = BaseInterfaceType | (string & {});

const richTextComposerSchema = z.object({
  interfaceType: z.literal('RICH_TEXT_COMPOSER'),
  placeholder: z.string().optional(),
});

const textAreaSchema = z.object({
  interfaceType: z.literal('TEXT_AREA'),
  contextText: z
    .string()
    .describe(
      'The read-only scenario/persona statement shown above the input, if distinct from the main scenario description.',
    )
    .optional(),
  placeholder: z.string().optional(),
});

const tableViewResponsePanelSchema = z.object({
  interfaceType: z.literal('TABLE_VIEW_RESPONSE_PANEL'),
  table: z.object({
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  placeholder: z.string().optional(),
});

/**
 * Per-type Zod schemas describing exactly what the frontend needs to render that interface —
 * the contract for `SimulationTask.interfacePayload`. Role modules that introduce their own
 * interface-type keys must also register a schema here (or in their own module) so the
 * generated payload is validated, not just tagged with a string.
 */
export const INTERFACE_SCHEMAS: Record<BaseInterfaceType, z.ZodTypeAny> = {
  RICH_TEXT_COMPOSER: richTextComposerSchema,
  TEXT_AREA: textAreaSchema,
  TABLE_VIEW_RESPONSE_PANEL: tableViewResponsePanelSchema,
};

export type RichTextComposerPayload = z.infer<typeof richTextComposerSchema>;
export type TextAreaPayload = z.infer<typeof textAreaSchema>;
export type TableViewResponsePanelPayload = z.infer<
  typeof tableViewResponsePanelSchema
>;
