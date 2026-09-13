# Grading — Implemented

The grading pipeline described below is built. What's still missing is upstream of this module,
not in it — see "What's NOT done" at the bottom.

## How it's triggered

`SubmissionsService.submitAnswers()` (`src/modules/submissions/submissions.service.ts`) calls
`GradingService.queueGrading(submissionId)` right after saving the candidate's answers — this
enqueues a job on the `grading` BullMQ queue and returns immediately; nothing in the submit
request path waits on grading or anchor generation.

**Anchors are generated lazily, on first need — not eagerly after task generation, not in a
batch job.** There's no separate "ensure anchors for this job" step. `GradingService.gradeSubmission()`
processes one task at a time; for each task it calls `AnchorGenerationService.ensureAnchors(row)`,
which returns the row's anchors if already populated, or generates-and-persists them first if not.
Concretely: the first submission to reach a given task pays the anchor-generation cost (a few extra
LLM calls, done in the background either way); every submission after that for the same task finds
`question_bank.anchors` already populated and skips straight to grading. This was a deliberate
product decision — jobs that never receive an application never spend tokens generating anchors
for tasks nobody will answer.

## Anchor generation (`anchors/anchor-generation.service.ts`)

Generate → critique → loop, up to `gradingConfig.maxAnchorAttempts` (3, in `src/config/ai.config.ts`)
full regenerate-and-recheck attempts (not the abandoned per-anchor self-correction design that
was in `ANCHOR_ARCHITECTURE.md` — this is the simpler "just regenerate the whole set and recheck"
loop). Generation uses `TASK_GENERATION_MODEL` (temperature 0.9, the same larger/more reliable
model used for task-content generation — anchors[] has the same deep-nesting reliability problem
that model was already chosen for). Critique uses `GRADING_MODEL` (temperature 0, deterministic).

If the critic never approves the anchors within the attempt cap, the **last attempt is persisted
anyway** (`question_bank.anchors`) so grading is never permanently blocked by one bad question,
and `question_bank.anchorsNeedReview` is set `true` for admin follow-up. There's no admin UI for
this flag yet — it's just queryable (`WHERE anchors_need_review = true`).

Per-role anchor criteria framing and anchor-correctness prompts live in `roles/` (`finance.anchor-config.ts`,
`sales.anchor-config.ts`), preserved verbatim from `ANCHOR_ARCHITECTURE.md`, resolved via
`AnchorRoleRegistry` (deliberately independent from generation's `RoleRegistry` — same exact/`>`-
prefix-fallback resolution logic, duplicated rather than shared, to keep grading decoupled from
generation per this module's original design intent).

## Task grading (`task-grading.service.ts`)

One LLM call per (task, candidate answer, that task's own 5 anchors) — never a batched "grade
every task in one call." Uses `GRADING_MODEL` at temperature 0. Output: the same 4-axis
`CategoryScores` shape used everywhere else in the schema (`problemSolving`, `judgmentExecution`,
`writtenCommunication`, `commercialDomainAwareness`, each `{score, rationale, evidence}`, scored
0-10 to match the anchor scale), plus a `summary` — one or two candidate-facing sentences
explaining that specific task's score, written directly to the candidate ("You..."). This is what
gets shown in the results email per task.

## Roll-up (`roll-up.ts`)

Deterministic, no LLM call. Per-task `categoryScores` (0-10 scale) are averaged per category
across all graded tasks into the submission-level `categoryScores` (still 0-10), with a
synthesized rationale/evidence string (not fabricated by a model) listing each task's score for
that category. `overallScore` is a weighted sum of the 4 rolled-up category scores
(`gradingConfig.categoryWeights` — 0.4/0.2/0.2/0.2, carried forward from the old scoring stub)
scaled to 0-100.

## Orchestration (`grading.service.ts`, `grading.processor.ts`)

`GradingProcessor` is the BullMQ worker. `GradingService.gradeSubmission()`: loads the submission
+ its simulation's tasks, grades every answer whose task has a `questionBankId` (see "What's NOT
done" below for tasks that don't), rolls up the results, persists `submissions.overallScore` /
`categoryScores` / `taskScores` (status → `SCORED`), updates the candidate's
`job_seeker_profiles.capabilityScores` via the existing `JobSeekerProfileService`, and emails the
candidate their results (including the per-task `summary` breakdown) via
`NotificationsService.sendScoringResultsEmail` / `templates/emails/scoring-results.ejs`.

This replaced the old `src/modules/scoring/` module entirely (`ScoringService.scoreSubmission()`
returned hardcoded numbers — see git history if you need to see what it looked like; it's deleted).

## What's NOT done — the actual blocker to using any of this

**There is no candidate-facing UI to take a simulation and submit answers.** Nothing in this
module can run against real data until that exists. Specifically:

- `CandidateAnswer.responseBody` is free text only — fine for open-ended tasks, but there's still
  no structured way to capture an answer to an objective-component task (numeric input,
  classification, sequencing, etc.). Objective-component grading (a deterministic correctness
  check, separate from the LLM-graded 4-axis score) was scoped out of this build for that reason
  — see git history for the `objectiveResult` design discussion if that gets picked back up.
- `SimulationsService.updateSimulationTasks` (`PUT /simulations/:id`) doesn't persist an
  employer-accepted task (from `GenerationService.regenerateTask()`) into `question_bank` — such
  a task has `questionBankId: null` forever and `GradingService.gradeSubmission()` explicitly
  skips grading it (logs a warning) rather than failing the whole submission. Fixing this means
  `updateSimulationTasks` needs to insert any `questionBankId: null` task into `question_bank`
  (compute its embedding, etc.) before saving it into the simulation.
