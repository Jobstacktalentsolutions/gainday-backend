# Anchor Generation & Critique — Preserved Architecture

Everything below was live in the generation pipeline through 2026-08-30 and was removed per
`README.md`'s explanation. Reproduced verbatim (not paraphrased) so it's directly reusable.

## 1. Anchor generation prompt

This was appended to `task-generation.node.ts`'s `TASK_GENERATION_PROMPT_BASE`, with
`{{problemSolving}}` etc. substituted from the active role module's `anchorCriteriaFraming`:

```
Anchor responses are reference points for grading — generate exactly one anchor per configured
score point, in order, each scored against the four fixed criteria below (framed for this role):
- Problem-solving: {{problemSolving}}
- Judgment/execution: {{judgmentExecution}}
- Written communication: {{writtenCommunication}}
- Commercial/domain awareness: {{commercialDomainAwareness}}

The top-scoring anchor should be strong but not implausibly perfect on all four criteria at once —
avoid manufacturing an artificial "perfect" answer that no real strong candidate response would
actually resemble; real strong answers often trade off one dimension for another.
```

The invoke call also appended, at the system-message level: `Generate anchors at these score
points: ${anchorScorePoints.join(', ')}.`

### `anchorCriteriaFraming` — per-role interpretation of the 4 fixed criteria

Each role module had an `anchorCriteriaFraming` field (removed from `RoleModule` along with the
rest of this) giving role-specific framing for the 4 shared criteria, substituted into the
prompt above.

**Finance:**
```ts
{
  problemSolving:
    'Did the candidate correctly identify the financial issue and apply sound quantitative reasoning?',
  judgmentExecution:
    'Did the candidate follow correct financial procedure and execute the calculation/analysis without material error?',
  writtenCommunication:
    'Is the written analysis/communication clear, precise, and appropriately structured for a finance audience?',
  commercialDomainAwareness:
    'Does the response reflect real understanding of financial/commercial implications (e.g. materiality, risk, compliance) rather than mechanical calculation alone?',
}
```

**Sales:**
```ts
{
  problemSolving:
    'Did the candidate correctly read the sales situation (e.g. which lever actually matters — deal size vs. urgency vs. probability to close; stalling vs. genuine hesitation) and apply sound sales reasoning rather than a generic playbook response?',
  judgmentExecution:
    'Did the candidate make the right sales judgment call — e.g. acknowledging an objection before countering it, protecting deal value instead of defaulting to a discount, choosing a single clear call-to-action or next step rather than a vague one?',
  writtenCommunication:
    'Is the written email/message/plan clear, appropriately concise, and free of generic mass-outreach or reassurance-language tells that a real buyer would recognize and discount?',
  commercialDomainAwareness:
    'Does the response reflect real understanding of the buyer/deal context — speaking to a specific pain point rather than product features, correctly identifying stakeholder roles, or reasoning about deal economics — rather than a generic, could-apply-to-any-deal answer?',
}
```

A new role building this back in should define the same 4 fields, framed for its own domain.

## 2. Anchor Zod schema shape

From `task-generation.schema.ts` (the exported `anchorsSchema` function has since been
deleted — this is its last form):

```ts
const anchorCriteriaSchema = z.object({
  problemSolving: z.string(),
  judgmentExecution: z.string(),
  writtenCommunication: z.string(),
  commercialDomainAwareness: z.string(),
});

// IMPORTANT — schema-compatibility constraints that will apply again to any future anchor
// generation call against Gemini and/or Groq:
//
// - Do NOT use z.literal(score) to pin each anchor's score to its configured point. Zod
//   compiles z.literal() to JSON-Schema `const`, which Gemini's schema parser rejects
//   ("Unknown name 'const'... Cannot find field") and which Groq's OpenAI-compatible schema
//   validator also rejects at the top level.
// - Do NOT use z.tuple([...]) to force one differently-shaped schema per score-point position.
//   z.tuple() compiles to a positional `items` array, which Gemini rejects ("Proto field is
//   not repeating, cannot start list").
// - The fix used: `score` is a plain `z.number()` on a single shared anchor shape, and a
//   `.refine()` on the array enforces "exactly N anchors, scores matching the configured
//   points, in that order" — this is validated in application code (throws a ZodError before
//   the value is used) rather than at the wire-schema level, so a wrong response still hard
//   fails.
// - A schema passed as the ROOT of a structured-output call must have `type: 'object'` for
//   Groq (a bare z.array(...) at the root gets rejected: "schema must have type 'object' and
//   not have 'oneOf'/'anyOf'/'enum'/'not' at the top level") — always wrap an anchors-only
//   schema in `z.object({ anchors: anchorsSchema(...) })` if generating/correcting anchors as
//   their own standalone structured-output call.

function anchorsSchema(anchorScorePoints: number[]) {
  const anchorSchema = z.object({
    score: z.number(),
    responseText: z
      .string()
      .describe('A realistic candidate response that would earn this score.'),
    criteria: anchorCriteriaSchema,
  });

  return z
    .array(anchorSchema)
    .describe(
      `Exactly ${anchorScorePoints.length} anchors, one per configured score point (${anchorScorePoints.join(', ')}), in that order.`,
    )
    .refine(
      (anchors) =>
        anchors.length === anchorScorePoints.length &&
        anchors.every((a, i) => a.score === anchorScorePoints[i]),
      {
        message: `anchors must have exactly ${anchorScorePoints.length} entries with scores ${anchorScorePoints.join(', ')} in that order`,
      },
    );
}
```

Also worth carrying forward: every structured-output call in this pipeline went through
`src/modules/ai/gemini-structured-output.util.ts`'s `withGeminiSafeStructuredOutput()`, which
(a) patches Gemini's nullable-type schema-conversion bug, and (b) retries automatically on
malformed-JSON provider errors and on Zod validation failures (e.g. the `.refine()` above
rejecting a wrong anchor count) — a future anchor-generation call should keep using this
wrapper rather than calling `model.withStructuredOutput()` directly.

## 3. Anchor-correctness critic prompts (per role)

These validated that the anchors themselves (not the task content) were sound — there's no
external grounding source, so an incorrect "10/10" anchor would silently corrupt every future
grading decision made against it.

**Finance** (`finance.prompts.ts`, `FINANCE_ANCHOR_CORRECTNESS_PROMPT`):

```
You are validating anchor responses generated for a finance job-simulation task.
Finance anchors must be numerically and procedurally sound: any stated calculation must be
arithmetically correct, any referenced accounting/finance procedure must reflect real,
defensible practice, and classification/sequencing answers must reflect a genuinely correct
order or bucket — not merely a plausible-sounding one.

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given),
report in anchorFeedback whether it is sound, and if not, exactly what is wrong (e.g. "the stated
total is off by $200", "score doesn't match reasoning quality — this reads like a 5/10 answer but
is scored 10"). Set issue to null for sound anchors. The top-level "sound" field is true only if
every anchor is sound.
```

**Sales** (`sales.prompts.ts`, `SALES_ANCHOR_CORRECTNESS_PROMPT`):

```
You are validating anchor responses generated for a sales job-simulation task.
Sales anchors must reflect sound, defensible sales practice, not just plausible-sounding prose:
- An objection-handling or closing anchor must acknowledge the prospect's actual concern before
  countering it, avoid generic reassurance language ("I hear you, but..." with no substance), and
  move toward a concrete next step rather than just defending the product or defaulting to a discount.
- A cold outreach anchor must speak to a real, specific pain point rather than listing product
  features, and end with a single clear call-to-action — not a vague "let me know if interested."
- A pipeline-prioritization anchor's ordering and justification must actually follow from the
  deal attributes given (size, urgency, stage, probability to close) — not just assert a
  reasonable-sounding priority without the reasoning matching the underlying data.
- An account-planning anchor must correctly identify the distinct buyer roles present in the
  scenario (e.g. economic buyer vs. technical evaluator) and sequence the approach logically.

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given),
report in anchorFeedback whether it is sound, and if not, exactly what is wrong (e.g. "defaults
to a discount instead of protecting deal value", "score doesn't match reasoning quality — this
reads like a 5/10 answer but is scored 10"). Set issue to null for sound anchors. The top-level
"sound" field is true only if every anchor is sound.
```

New roles need the same shape of prompt: state what "sound" means for that role's domain, then
require per-anchor indexed feedback.

## 4. Per-anchor structured feedback schema

`AnchorCorrectnessResult` (was in `role-module.interface.ts`):

```ts
interface AnchorFeedbackItem {
  anchorIndex: number;
  sound: boolean;
  issue: string | null; // what's wrong, null if sound
}

interface AnchorCorrectnessResult {
  sound: boolean;       // true only if every anchor is sound
  reasons: string[];    // flat summary, kept for admin-review logging
  anchorFeedback: AnchorFeedbackItem[]; // one entry per anchor, same order
}
```

Zod schema:

```ts
const anchorFeedbackItemSchema = z.object({
  anchorIndex: z.number(),
  sound: z.boolean(),
  // Required + nullable, not .optional() — models commonly emit an explicit `null` for an
  // unfilled field rather than omitting the key, and z.optional().nullable() compiles to an
  // anyOf/not shape that neither Gemini's nor Groq's schema validators accept. Plain
  // .nullable() compiles to a clean `type: [X, "null"]` both providers handle (with Gemini
  // needing the fixNullableTypes patch in gemini-structured-output.util.ts).
  issue: z.string().nullable(),
});

const anchorCorrectnessSchema = z.object({
  sound: z.boolean(),
  reasons: z.array(z.string()),
  anchorFeedback: z.array(anchorFeedbackItemSchema),
});
```

## 5. The self-correction loop (routing design)

Built and torn down the same day. The idea: dropping an entire well-written task over one bad
anchor wastes a good scenario. Design, in case it's worth reviving once anchors are generated
somewhere:

- **Only anchor-correctness failures are correctable.** Duplicate and relevance failures always
  mean the task content itself is wrong — not patchable, drop and try a different candidate
  from the overgenerated pool (existing `regeneration-router.ts` behavior).
- **Routing condition**: `!isDuplicate && relevant && !anchorsSound` (i.e. the *only* thing that
  failed is anchor correctness) AND no correction has been attempted yet for this candidate.
- **1 correction attempt per candidate**, tracked via a `correctionAttempted` boolean in graph
  state, reset whenever a fresh candidate is picked (both on slot-advance and on retry-with-a-
  different-candidate). If the corrected anchors still fail, it falls through to the normal
  drop-and-retry path — no second correction round.
- **Correction node**: takes the current (unchanged) `taskContent` plus the critic's
  `anchorFeedback`, sends both to the model with an instruction to copy every sound anchor
  through unchanged and only rewrite the ones flagged unsound, returning the complete 5-anchor
  array (validated by the same `anchorsSchema` `.refine()` as full generation). Uses the same
  model tier as full task generation, not a cheaper one — anchor-correctness reasoning isn't
  simpler than original anchor generation.
- **Graph shape**: `critic` gets a 4th outgoing route (`CORRECT`) alongside `RETRY`/`PERSIST`/
  `ADMIN_REVIEW`, routing to a new `anchorCorrection` node, which loops back to `critic` for a
  full re-check (novelty/relevance trivially re-pass since `taskContent` didn't change; only the
  anchor-correctness check meaningfully re-runs).
