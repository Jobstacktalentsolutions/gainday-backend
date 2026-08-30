# Grading — Design Notes (Not Yet Built)

There is no grading pipeline yet. This module exists to hold design context so a future build
doesn't have to re-derive it or dig through git history. It captures what the generation
pipeline used to do with anchor responses before that work was pulled out of generation
(2026-08-30) and moved here.

## Why anchors exist at all (pipeline doc Section 6.2)

Grading a candidate's submission means comparing it against reference points. A single
good/bad pair isn't enough — the hardest grading problem is distinguishing mid-range answers
(a 6 from a 7), which is exactly where real candidate responses cluster. Two extreme anchors
give a grading model nothing to calibrate against there.

**Anchors: minimum 4–5 points across the score range** — e.g. 0, 3, 5, 7, 10, not just the two
poles. This score-point list is still defined in `src/config/ai.config.ts`
(`generationConfig.anchorScorePoints`) even though nothing consumes it right now — grading will
need the same list.

Each anchor is scored against four criteria, shared across roles but with role-specific framing:
1. **Problem-solving**
2. **Judgment / execution**
3. **Written communication**
4. **Commercial / domain awareness**

These are the exact same four fields as `CapabilityScores`/`CategoryScores` in
`src/db/schema/users.schema.ts` / `src/db/schema/submissions.schema.ts` — anchors exist to be
what a candidate's capability score is ultimately measured against.

A "10/10" anchor should score maximally on all four criteria, but real strong answers often
trade off one dimension for another (e.g. commercially sharp but less polished prose) — a
generation prompt for anchors should avoid manufacturing an artificially "perfect" top anchor
that doesn't resemble any real answer a grader would encounter.

## The `AnchorResponse` shape

Still defined in `src/db/schema/question-bank.schema.ts` (unused by generation now, but kept
as the target contract):

```ts
export interface AnchorResponse {
  score: number; // e.g. 0, 3, 5, 7, 10
  responseText: string;
  criteria: {
    problemSolving: string;
    judgmentExecution: string;
    writtenCommunication: string;
    commercialDomainAwareness: string;
  };
}
```

`question_bank.anchors` (jsonb, now nullable) and `generation_review_items.resolvedAnchors`
(jsonb, already nullable) are where this would be persisted, once something populates them.

## What generation used to do, and why it moved here

Through 2026-08-30, every task-generation call also generated a full set of anchors, and the
critic ran a dedicated anchor-correctness check (plus, briefly, a full self-correction loop)
before a task could be persisted. This was removed because **grading doesn't exist yet** —
there was nothing consuming anchors, and anchor generation + critique + correction was the
single most expensive part of every generation run (the deepest nested schema, an extra LLM
call per task, and — with the correction loop — up to one more call on top of that). Cutting it
materially reduces tokens/latency per generated task with no loss of anything in current use.

None of this was thrown away — it's preserved in `ANCHOR_ARCHITECTURE.md` in this directory,
verbatim, as a real starting point for whoever builds grading:
- The exact anchor-generation prompt instructions that were part of `task-generation.node.ts`.
- The exact per-role anchor-correctness critic prompts (finance and sales).
- The Zod schema shape used for the anchors array (and why it's shaped the way it is —
  Gemini/Groq schema-compatibility constraints that will apply again to any future anchor
  generation call).
- The self-correction loop's design: per-anchor structured feedback, the routing decision
  (only-anchor-failures are correctable, everything else drops and retries with a different
  candidate), and the 1-attempt cap.

## Open question for whoever builds this

**When do anchors get generated?** Three options, undecided:
1. **Lazily**, on first candidate submission to a task — no cost until a task is actually used.
2. **Eagerly**, right after a task is persisted to `question_bank` — as an async job off the
   generation critical path (doesn't slow down `POST /generation-test/generate` or the real
   `queueGeneration` flow), but every generated task gets anchors whether or not it's ever used.
3. **Batch**, on some periodic job over `question_bank` entries missing anchors.

This directory's removal from generation doesn't answer this — it just stops blocking
generation on it. Whichever approach is chosen, the reusable pieces in
`ANCHOR_ARCHITECTURE.md` are the starting point for the actual generation/critique logic.
