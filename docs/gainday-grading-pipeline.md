# GAINDAY — Grading Pipeline

This document describes how Gainday grades a candidate's completed work simulation, end to end:
how anchor reference responses get created, how a candidate's actual answers get scored against
them, and how that rolls up into the capability score shown to employers and emailed to
candidates. It is the companion to `docs/gainday-generation-pipeline.md` (which covers how a
simulation's *tasks* are generated) — this document picks up after a candidate has submitted
answers to those tasks.

**Status: implemented and unit-testable, but not yet reachable end-to-end.** There is no
candidate-facing UI to take a simulation and submit answers yet, so nothing described below has
run against real candidate data. See Section 8 ("What blocks this from running today").

---

## 1. Trigger & Data Flow

1. A candidate answers a simulation's tasks and calls `PUT /submissions/:id/submit` with
   `{ answers: CandidateAnswer[] }` (`SubmissionsController.submitSimulation` →
   `SubmissionsService.submitAnswers`).
2. `submitAnswers` saves the answers, then immediately calls
   `GradingService.queueGrading(submissionId)` and returns — grading is fully async and never
   blocks the submit request.
3. `queueGrading` enqueues `{ submissionId }` on the BullMQ **`grading`** queue
   (`GRADING_QUEUE` in `grading.constants.ts`), deduped by `jobId: grade-${submissionId}` (a
   BullMQ job-id, not a Gainday `Job` row).
4. `GradingProcessor` (the queue worker) picks it up and calls
   `GradingService.gradeSubmission(submissionId)` — everything from here on is one method.
5. `gradeSubmission`:
   - Loads the submission with its `job`, `simulation`, and `candidate` (+ `candidate.user`)
     relations. Sets `submissions.status = 'SCORING'`.
   - For each `CandidateAnswer` in `submission.answers`, finds the matching `SimulationTask` by
     `taskId` in `submission.simulation.tasks`.
   - For each matched task, loads its `question_bank` row via `task.questionBankId`, ensures that
     row has anchors (generating them on first need — Section 2), then grades the answer against
     those anchors (Section 3).
   - Rolls the per-task results up into a submission-level score (Section 4, pure code, no LLM).
   - Persists everything, updates the candidate's cross-job capability profile, and emails the
     candidate their results (Section 5).

No step here is synchronous with the candidate's submit action — the entire pipeline, including
any anchor generation it triggers, runs in the background worker.

---

## 2. Anchor Generation — Lazy, Triggered by the First Submission That Needs Them

**Anchors are not generated when a task is created.** `question_bank.anchors` starts `null` for
every task (generation deliberately does not populate it — see
`docs/gainday-generation-pipeline.md` and this module's `ANCHOR_ARCHITECTURE.md`/`README.md` for
why that was pulled out of generation on 2026-08-30). There is no separate "backfill anchors for
this job" step and no eager job that runs right after a task is persisted.

Instead, anchor generation is triggered **implicitly, per task, by whichever submission first
needs it**: inside `gradeSubmission`, for every task about to be graded,
`AnchorGenerationService.ensureAnchors(row)` is called:

```ts
async ensureAnchors(row: QuestionBankEntry): Promise<AnchorResponse[]> {
  if (row.anchors && row.anchors.length > 0) return row.anchors;
  // ...generate, critique, persist...
}
```

If the row already has anchors, they're returned immediately (no LLM call). If not, they're
generated right there, synchronously within the grading job (still async relative to the
candidate — this is all happening inside a background worker already). Practically: the first
candidate to submit against a job pays the anchor-generation cost for each of that job's tasks;
every candidate after that finds the anchors already sitting on `question_bank` and skips
straight to grading. Jobs that never receive an application never spend a single token on
anchors — this was a deliberate product decision, not an oversight.

### 2.1 The generate → critique loop

For one `question_bank` row, `AnchorGenerationService.generateWithCritique`:

1. Generate a full set of anchors (Section 2.2).
2. Critique them (Section 2.3) — the critic reports `sound: boolean` plus per-anchor feedback.
3. If `sound`, done — persist and return.
4. If not, log the failure reasons and **regenerate the entire set from scratch** (not a partial
   per-anchor patch) and critique again.
5. Repeat up to `gradingConfig.maxAnchorAttempts` (**3**, `src/config/ai.config.ts`) times.
6. If still not sound after 3 attempts: persist the **last attempt anyway** (grading must not be
   permanently blocked by one stubborn question) and set `question_bank.anchorsNeedReview = true`.

There is no UI yet that surfaces `anchorsNeedReview` — it's only queryable
(`WHERE anchors_need_review = true`) for now, intended as a future admin worklist. Conceptually,
a row stuck needing review after 3 honest attempts is a signal the underlying task/scenario
itself may be flawed, not just that the anchors were unlucky.

*(This loop is a simplification of the original design preserved in `ANCHOR_ARCHITECTURE.md`,
which also had a "self-correction" mode that patched only the unsound anchors instead of
regenerating the whole set. That mode was built and abandoned the same day it was designed and
was deliberately **not** revived here — the implemented loop always fully regenerates.)*

### 2.2 Generating the anchor set

Exactly `generationConfig.anchorScorePoints` anchors (**`[0, 3, 5, 7, 10]`**, 5 points) are
generated in one structured-output call, each with a `responseText` (a realistic example answer
at that score) and per-criterion framing text explaining *why* it earns that score. Model:
`TASK_GENERATION_MODEL` (temperature 0.9 — creative, the same larger/more-reliable-at-deep-JSON
model used for full task-content generation, chosen because `anchors[]` has the same
deeply-nested-schema reliability problem). Schema: `schemas/anchor-generation.schema.ts` —
notably `score` is a plain `z.number()` rather than `z.literal()`/`z.tuple()` (both of which
Gemini's/Groq's schema validators reject), with a `.refine()` enforcing the exact count and score
order in application code instead. The whole array is wrapped in `z.object({ anchors: [...] })`
because Groq rejects a bare array at the schema root.

Prompt (`prompts/anchor-generation.prompt.ts`) explicitly warns against manufacturing an
artificially "perfect" 10/10 anchor that trades off nothing — real strong answers usually
sacrifice one dimension for another.

### 2.3 Critiquing the anchor set

A second structured-output call (`schemas/anchor-critique.schema.ts`) reviews the just-generated
anchors and reports, per anchor (indexed), whether it's sound and — if not — exactly what's
wrong. Model: `GRADING_MODEL` (temperature 0 — deterministic). The correctness prompt is
role-specific (Section 2.4): "sound" means something different for a finance calculation than for
a sales objection-handling reply.

### 2.4 Per-role anchor criteria framing (`roles/`)

The 4 grading criteria — `problemSolving`, `judgmentExecution`, `writtenCommunication`,
`commercialDomainAwareness` — are fixed and shared across roles, but *what they mean* is
role-specific. `roles/finance.anchor-config.ts` and `roles/sales.anchor-config.ts` each supply:

- `criteriaFraming`: one sentence per criterion, substituted into both the anchor-generation
  prompt and the task-grading prompt (Section 3), so anchors and real candidate grading are
  always judged against identical framing.
- `anchorCorrectnessPrompt`: what "sound" means for this role's anchors (e.g. finance requires
  arithmetically correct calculations and defensible procedure; sales requires objections
  acknowledged before being countered, no generic reassurance language, deal-value protected
  rather than defaulted to a discount).

`AnchorRoleRegistry` resolves a `question_bank.category` string (e.g. `"Sales > SDR"`) to its
config via exact match, then `>`-prefix fallback to the top-level category — the same resolution
algorithm as generation's `RoleRegistry`, deliberately re-implemented here rather than shared, to
keep grading decoupled from the generation module (per this module's original design intent).
Adding a new role means adding a new `*.anchor-config.ts` and registering it here — nothing else
in grading needs to change.

---

## 3. Task Grading — One Call Per (Task, Answer, Its Own Anchors)

`TaskGradingService.gradeTask` makes **one structured-output call per task**, never a batched
"grade every task in this submission in one call." This is deliberate, for two reasons: (1) a
batched schema would reintroduce exactly the deep-nesting reliability problem that got anchors
pulled out of generation in the first place — `tasks[] × anchors[5] × criteria{4 fields}` nested
together is worse than anything currently in the pipeline; (2) it keeps the model's attention on
one task's calibration anchors at a time instead of diluting it with N unrelated tasks' worth of
anchors.

**Input** (per call): the task's title/scenario/prompt, its 5 anchors, and the candidate's raw
`responseBody` for that task. **Model:** `GRADING_MODEL`, temperature 0. **Output**
(`schemas/task-grading-result.schema.ts`):

```ts
{
  categoryScores: {
    problemSolving:              { score: number /* 0-10 */, rationale: string, evidence: string },
    judgmentExecution:           { score, rationale, evidence },
    writtenCommunication:        { score, rationale, evidence },
    commercialDomainAwareness:   { score, rationale, evidence },
  },
  summary: string, // 1-2 candidate-facing sentences, written directly to them ("You...")
}
```

Each category score is **0-10**, matching the anchor scale (not the 0-100 scale used for the
submission-level `overallScore` — see Section 4). `rationale`/`evidence` must cite something
specific from the candidate's actual response, never a generic statement. `summary` is the
"why did I get this score" line shown per task in the results email (Section 5) — this is the
concrete answer to "can the candidate see a concise reason per question."

The prompt (`prompts/task-grading.prompt.ts`) explicitly instructs the model to use the anchors as
calibration points — placing the candidate's response relative to them — rather than scoring in a
vacuum, and to focus on the hard middle-of-the-range distinctions (a 6 vs. a 7), which is the
entire reason anchors exist per the generation pipeline doc.

---

## 4. Roll-Up — Deterministic, No LLM Call

`roll-up.ts`'s `rollUpTaskScores` is plain arithmetic over the per-task results already computed
in Section 3 — there is no LLM call here on purpose. For each of the 4 categories:

- **Score**: the average of that category's score across every graded task, rounded to 2
  decimal places. Stays on the **0-10 scale**.
- **Rationale**: a synthesized (not model-generated) sentence, e.g. *"Average of the per-task
  problem-solving scores across 4 task(s)."*
- **Evidence**: a synthesized list of each task's score for that category, e.g. *"Onboarding
  Friction Analysis: 7/10; Retention Strategy Priority: 8/10; ..."*.

**`overallScore`** is a weighted sum of the 4 rolled-up category scores, using
`gradingConfig.categoryWeights` (`src/config/ai.config.ts`):

| Category | Weight |
|---|---|
| Problem-solving | 0.4 |
| Judgment/execution | 0.2 |
| Written communication | 0.2 |
| Commercial/domain awareness | 0.2 |

(carried forward unchanged from the old scoring stub's weighting), then **scaled from 0-10 to
0-100** — this is the only place the scale changes, and it's why `submissions.categoryScores` and
`submissions.overallScore` are intentionally on different scales: category scores stay directly
comparable to any individual task's score (0-10 throughout), while the single headline number
shown to employers/candidates is framed "out of 100."

If **zero** tasks could be graded for a submission (e.g. every task lacks a `questionBankId` —
Section 8), grading logs an error and reverts the submission's status back to `PENDING` rather
than persisting a meaningless score.

---

## 5. Persistence, Capability Scores, and the Results Email

On successful roll-up, `gradeSubmission` writes to `submissions`:

- `status: 'SCORED'`
- `overallScore` (0-100)
- `categoryScores` (0-10 per category, with rationale/evidence)
- `taskScores`: the full per-task breakdown (`TaskGradingResult[]` — `taskId`, `questionBankId`,
  `categoryScores`, `summary`), i.e. everything behind the rolled-up numbers, for future
  drill-down UI or audit.

If the submission has a `candidateId` (not a guest), `JobSeekerProfileService.updateCapabilityScores`
is called with the domain resolved as `job_extractions.category` (falls back to `job.role`, then
`'Unspecified'`) — this updates the candidate's cross-job `job_seeker_profiles.capabilityScores`
history, keyed by domain, using the same 4-category shape as everywhere else in the schema.

Finally, if a candidate email is resolvable (`candidate.user.email` or, for a guest submission,
`guestInfo.email`), `NotificationsService.sendScoringResultsEmail` is called with the overall
score, the 4 category scores, **and** the per-task `{title, summary}` breakdown — rendered by
`templates/emails/scoring-results.ejs`, which shows the numeric breakdown (".../10" per category)
followed by a "Task by task" section listing each task's title and its one-or-two-sentence
`summary`. This is the actual delivery mechanism for "why did I get this score" reasoning reaching
the candidate.

---

## 6. Configuration Reference

`src/config/ai.config.ts`:

```ts
export const gradingConfig = {
  maxAnchorAttempts: 3,
  categoryWeights: {
    problemSolving: 0.4,
    judgmentExecution: 0.2,
    writtenCommunication: 0.2,
    commercialDomainAwareness: 0.2,
  },
};
```

Reused from `generationConfig`: `anchorScorePoints: [0, 3, 5, 7, 10]` (the anchor generation call
targets these exact points).

Model wiring (`ai.constants.ts` / `ai.module.ts`):

| Constant | Used for | Temperature | Why |
|---|---|---|---|
| `TASK_GENERATION_MODEL` | Anchor **generation** | 0.9 (creative) | Same nested-schema reliability need as full task generation |
| `GRADING_MODEL` | Anchor **critique** + task **grading** | 0 (deterministic) | Grading must be reproducible across repeated scoring of the same answer (see `docs/gainday-generation-pipeline.md` §9) |

`GRADING_MODEL` is a genuinely new provider entry (`ai.gradingModel` under both `gemini` and
`groq` in `ai.config.ts`) — on Groq it points at the larger `openai/gpt-oss-120b`, same
reliability reasoning as `taskGenerationModel`.

---

## 7. Module / File Map

```
src/modules/grading/
  grading.module.ts                    NestJS module — registers the `grading` BullMQ queue
  grading.constants.ts                 GRADING_QUEUE = 'grading'
  grading.config.interface.ts          Typed shape of the `grading` ConfigService namespace
  grading.service.ts                   Orchestrator — queueGrading(), gradeSubmission()
  grading.processor.ts                 BullMQ worker — the queue entrypoint
  task-grading.service.ts              One-call-per-task LLM grading against anchors
  roll-up.ts                           Deterministic per-task -> submission-level rollup
  anchors/
    anchor-generation.service.ts       ensureAnchors() — the generate/critique/persist loop
  schemas/
    anchor-generation.schema.ts        Zod schema for the anchor-generation LLM call
    anchor-critique.schema.ts          Zod schema for the anchor-critique LLM call
    task-grading-result.schema.ts      Zod schema for the task-grading LLM call
  prompts/
    anchor-generation.prompt.ts
    task-grading.prompt.ts
  roles/
    anchor-role-config.interface.ts    AnchorCriteriaFraming / RoleAnchorConfig shapes
    anchor-role-registry.ts            category string -> RoleAnchorConfig resolver
    finance.anchor-config.ts
    sales.anchor-config.ts
  README.md                           Design notes + "what's not done" (kept up to date)
  ANCHOR_ARCHITECTURE.md              Historical: the original (pre-removal) anchor design
```

This entirely replaced `src/modules/scoring/` (`ScoringService.scoreSubmission` used to return
hardcoded numbers — 85/90/80/75 — for every submission regardless of content). That module is
deleted; `git log` has it if anyone needs to see what it looked like.

---

## 8. What Blocks This From Running Today

Nothing in this pipeline is broken, but two upstream gaps mean it cannot yet run against real
candidate data:

1. **No candidate-facing UI exists to take a simulation and submit answers.** `PUT
   /submissions/:id/submit` and the whole pipeline above are ready to receive
   `CandidateAnswer[]`, but nothing in the frontend produces one yet.
2. **A task added/regenerated via `GenerationService.regenerateTask()` and accepted by the
   employer through `PUT /simulations/:id` never gets written to `question_bank`.**
   `SimulationsService.updateSimulationTasks` now validates the incoming task shape
   (`simulation-task.validator.ts`) but still just overwrites `simulations.tasks` verbatim — it
   never inserts a `questionBankId: null` task into `question_bank`. Such a task has no row to
   attach anchors to, so `gradeSubmission` explicitly detects this (`!task.questionBankId`),
   skips grading it, and logs a warning — it does not fail the whole submission, but that task's
   answer is silently ungraded. Fixing this means `updateSimulationTasks` needs to persist any
   `questionBankId: null` task into `question_bank` (compute its embedding, etc.) before saving
   it into the simulation.

**Also out of scope by explicit product decision, not a gap:** objective-component tasks
(numeric input, classification, sequencing, etc.) are graded through the same 4-axis LLM path as
everything else — there is no separate deterministic "is this numeric answer correct" check. This
was considered (an `objectiveResult` field: `{isCorrect, awardedPoints, maxPoints}`, computed in
code rather than by an LLM) and deliberately dropped, partly because `CandidateAnswer` has no
structured field to check it against in the first place (`responseBody` is free text only). If
this gets revisited, it depends on the candidate-answer-capture UI (gap 1) existing first and
capturing structured objective answers, not just free text.
