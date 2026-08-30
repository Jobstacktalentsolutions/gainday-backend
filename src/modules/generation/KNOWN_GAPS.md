# Known gap: duplicate/novelty check only embeds scenario text

**Where:** `utils/embedding.util.ts` (`taskContentToEmbeddingText`), consumed by
`critic/novelty-check.ts` and `critic/duplicate-check.ts` via `critic.node.ts`.

## What's embedded today

```
title + "\n\n" + scenarioDescription + "\n\n" + questionPrompt
```

Not included: `objectiveComponent`, `openEndedComponent`, or `anchors`. (Anchors no longer
exist at generation time at all as of 2026-08-30 — see `src/modules/grading/` — so this note
now only applies once/if a future grading pipeline attaches anchors back onto a task.)

## The gap

Because only the narrative text is embedded, the duplicate check can miss or
misfire in both directions:

- **False negative:** two tasks with different scenario framing (different
  names, numbers, story) can ask the same underlying question with the same
  graded answer — not flagged as duplicates even though they test identically.
- **False positive:** two tasks with similar scenario framing but different
  `objectiveComponent`/`anchors` (different skills, different correct answers)
  could be incorrectly flagged as duplicates of each other.

## Why it's staying this way for now

Including `objectiveComponent`, `openEndedComponent`, and `anchors` in the
embedded text would make the duplicate check more accurate, but it means
sending significantly more tokens per embedding call (structured fields,
multiple anchor responses at each score point) — a real, ongoing API cost
increase for every task generated, not a one-time cost. Given the pipeline
already constrains generation per role (allowed task pattern types, category,
intent) and runs a separate LLM relevance check, scenario-text similarity is
an acceptable first-pass signal for now.

## When to revisit

If the question bank grows large enough that near-miss duplicates (same test,
different dressing) start accumulating across generation runs, or if a role's
content leans heavily on reusing similar scenarios with different graded
components. At that point, decide deliberately how to textify structured
fields for embedding (e.g., flattened description, or just the anchor
score-0/score-10 responses as bookends) rather than embedding raw JSON.
