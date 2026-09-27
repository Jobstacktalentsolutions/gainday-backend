# Anti-cheat / proctoring — Implemented

This documents everything currently built to detect and record suspicious candidate behavior
during a simulation, end to end: what the frontend watches for, what reaches this backend, how
it's stored, and what's still missing. Read this alongside `submissions.schema.ts`,
`submissions.service.ts`, and `submissions.controller.ts` — nothing here lives in its own module.

## The short version

There are two independent trust levels:

1. **Client-reported signals** — the candidate's own browser tells the server what happened
   (tab switches, fullscreen exits, idle time). Trustworthy for an honest candidate, but a
   technical one could suppress these via devtools before they're ever sent.
2. **Server-observed signals** — derived from what the server itself sees (whether heartbeat
   pings kept arriving). Can't be suppressed client-side, because the server isn't trusting the
   client's account of its own state — it's measuring silence.

Both land in the same place: `submissions.antiCheatFlags: jsonb AntiCheatEvent[]` and
`submissions.isAntiCheatFlagged: boolean`, written once, at submit time, by
`SubmissionsService.submitAnswers()`. Nothing is written incrementally during the run — the
client accumulates in memory and reports the full log on `PUT /submissions/:id/submit`.

## The event shape

```ts
// submissions.schema.ts
export interface AntiCheatEvent {
  type: string;              // "tab-hidden" | "window-blur" | "fullscreen-exit" | "idle" | "server-stale-heartbeat"
  taskId: string | null;     // which task was on screen when this happened; null if not meaningful
  occurredAt: string;        // ISO 8601 — when the event was *recorded*
  durationMs?: number;       // "idle" only — the spell's real measured length
}
```

`antiCheatFlags` is a flat `AntiCheatEvent[]` — the full log for the run, not a rolled-up
summary. This replaced an earlier `text[]` design that only ever held `"type ×count"` totals for
the whole run, with no record of *when* something happened or which task was active. `type` is
an open string rather than a DB enum on purpose: it's produced by several independent frontend
listeners plus this backend's own server-observed check, and a Postgres enum would need a
migration every time one more gets added.

## Client-reported signals (frontend)

All of this lives in `gainday-frontend/src/features/candidate/`. None of it is specific to one
violation type — each is a small standing listener that calls one shared function.

**The store** — `hooks/useSimulationIntegrityStore.ts`: a zustand store holding
`events: AntiCheatEvent[]`, appended to by `recordViolation(type, taskId)` /
`recordIdleSpell(durationMs, taskId)` — every occurrence is its own entry, not a count bumped in
place, so the full sequence (including order and timing) survives. Capped at 500 entries
client-side (`MAX_EVENTS`) against a pathological run; the backend enforces its own independent
1000-entry cap (`MAX_ANTI_CHEAT_EVENTS` in `submissions.service.ts`) rather than trusting the
client actually applied its cap. Deliberately **not** persisted to localStorage: a page refresh
mid-run is its own signal (see "server-observed" below), not something to paper over by
resurrecting a log from a previous mount.

Three listeners feed it, all wired up in `pages/TaskRunner.tsx` for the life of the run:

| Listener | File | Fires on | `type` |
|---|---|---|---|
| Tab visibility | `hooks/useTabVisibilityGuard.ts` | `document.hidden` becoming true, or a `window blur` event | `tab-hidden`, `window-blur` |
| Fullscreen exit | `hooks/useFullscreenGuard.ts` | `fullscreenchange` transitioning from fullscreen → not | `fullscreen-exit` |
| Idle time | `hooks/useIdleDetection.ts` | see below — a gap between activity events reaching `IDLE_THRESHOLD_MS` (currently 5 minutes, set in `TaskRunner.tsx`) | `idle` (carries `durationMs`) |

Each call site knows *which task was current* via `currentTaskIdRef` in `TaskRunner.tsx` — a ref
kept in sync by a small effect, since the three listeners above are wired up near the top of the
component (unconditionally, per rules of hooks) before the `task` variable exists further down,
past the loading/error early-returns.

**Idle time is measured as real per-spell duration, not counted in fixed-size ticks.**
`useIdleDetection` runs nothing on a timer while idle; instead it watches
mousemove/mousedown/keydown/scroll/touchstart/wheel, and on *each* such event checks how long
it's been since the previous one. If that gap is >= `IDLE_THRESHOLD_MS`, the gap's real duration
is reported as one idle spell (`recordIdleSpell(durationMs, taskId)`) and the clock resets. Two
idle periods separated by even a moment of activity are two independent spells, each its own
`AntiCheatEvent` — idle 6 min, active 10 sec, idle 8 min reports as two events (durationMs 360000
and 480000), never merged into one 14-minute total. Below the threshold, a gap isn't reported at
all — a 30-second pause is thinking, not idle.

Because a spell is only closed out by an activity event, a candidate who goes idle and never
returns (walks away for good) would otherwise never trigger a report. `TaskRunner.tsx` calls
`idle.flush()` as the first step of `finalizeSubmission()` (both the explicit-submit and
timer-expiry paths) specifically to close out and report whatever spell was still open at that
moment, before reading the log to send.

`useTabVisibilityGuard` also has a separate use on `pages/EnvironmentCheckPage.tsx` (before the
simulation starts, prefixed `pre-simulation-*`, `taskId: null` since no task exists yet) — that's
a different, pre-run concern (are they already switching tabs during the environment check) and
writes to the same store but is never sent anywhere, since there's no submission yet at that
point.

**At submit time**, `TaskRunner.tsx` reads
`useSimulationIntegrityStore.getState().events` directly — via zustand's `getState()` rather
than a render-time selector, so the just-flushed idle spell above is never missed — and sends it
verbatim as `antiCheatFlags` in the `PUT /submissions/:id/submit` body. No summarizing happens
client-side before sending; `summarizeAntiCheatEvents()` (also in
`useSimulationIntegrityStore.ts`) exists purely as a convenience for anywhere that wants a
rolled-up view (e.g. a future employer-facing review UI), and is unused by the submit path
itself.

## Server-observed signal: heartbeat staleness

`POST /submissions/:id/heartbeat` (`submissions.controller.ts`) — guarded by `JwtAuthGuard` +
`RolesGuard(JOB_SEEKER)`, plus an explicit ownership check
(`assertOwnedByCandidate`: `submission.candidateId !== user.profileId` → 403). Calling it just
updates `submissions.lastHeartbeatAt` to now and returns `{ status, serverTime }`.

The frontend pings it from `hooks/useConnectionMonitor.ts` every 20 seconds (`PING_INTERVAL_MS`)
for the life of the run — this is also what drives the connection-lost/restored banner in the UI,
so the same ping serves both purposes: user-visible connectivity feedback, and an
authenticated, ownership-checked "I'm still here" the server can independently verify. It only
starts once `runStore.submissionId` exists (i.e. once `POST /submissions/job/:jobId/start` has
resolved) — there's nothing to heartbeat against before that.

`lastHeartbeatAt` is seeded to `startedAt` on `createSubmission()`, not left null, so there's no
artificial "stale" gap before the first real ping ever lands.

At submit time, `SubmissionsService.submitAnswers()` computes
`heartbeatAgeMs = completedAt - submission.lastHeartbeatAt`. If that exceeds
`HEARTBEAT_STALE_THRESHOLD_MS` (90 seconds — well above the 20s ping interval, so one dropped
ping doesn't false-positive), it appends its own event —
`{ type: "server-stale-heartbeat", taskId: null, occurredAt: completedAt, durationMs:
heartbeatAgeMs }` — to whatever the client reported (`taskId: null` since this fires once, after
the run has already ended, when there's no longer a meaningful "current task"). This is the one
event a candidate can't suppress by disabling the client-side listeners, since it's derived from
when the server actually stopped hearing from them, not from anything the client asserts about
itself.

## Persistence

`submissions.antiCheatFlags: jsonb AntiCheatEvent[]` and
`submissions.antiCheatFlags.length > 0` → `submissions.isAntiCheatFlagged: boolean` are both set
in one write, in `SubmissionsService.submitAnswers()`, at the same time as
`answers`/`completedAt`/`timeTakenSeconds`. There's no separate anti-cheat table — the full
per-event log lives inline on the submission row as one JSON array, not a normalized events
table, so there's no independent event ID, no indexing by task or type at the DB level, and
querying "every idle event across all submissions for job X" means scanning and unpacking
`antiCheatFlags` in application code, not a SQL `WHERE`.

`submissions.disqualificationReason: text` exists on the schema but nothing currently sets it —
events are recorded, nothing acts on them automatically.

## Answer-key confidentiality (a related but distinct protection)

Not a behavioral signal like the above — this prevents a different kind of cheating: reading the
correct answer before attempting the question. `GET /simulations/job/:jobId` is unauthenticated
(anyone can call it, by design — the candidate doesn't need to be signed in to preview a job's
simulation before applying), so the tasks it returns must never include the answer key.
`candidate-task.util.ts`'s `sanitizeTaskForCandidate()` strips the one answer-bearing field per
`objectiveComponent` type (`correctOptionIndex`, `correctOptionIndices`, `correctValue`,
`correctMapping`, `correctOrder`) before the task ever leaves `SimulationsController.getByJob()`,
and tags what's left with `componentType` (resolved via `RoleRegistry`, the same source
`/admin/task-pattern-types` uses) so the frontend knows which answer widget to render without
needing that admin-only endpoint. The employer-authoring path
(`GET /jobs/:id/with-simulation`, a different route entirely) is untouched and still returns the
real data, since an employer editing a task needs to see its correct answer.

## What's NOT done

- **No employer-facing review UI reads any of this.** `antiCheatFlags` / `isAntiCheatFlagged` are
  captured and persisted, but nothing in `GenerationReviewDetail` or any submission-review screen
  currently surfaces them to the employer/admin deciding whether to trust a result.
- **`disqualificationReason` is dead.** No code path — automatic or manual — ever sets it. A
  heavily-flagged submission is graded normally, same as a clean one; flags don't currently gate
  anything.
- **No normalized event table.** The per-event log now exists (`antiCheatFlags: AntiCheatEvent[]`,
  each with `type`/`taskId`/`occurredAt`/`durationMs`), but it's stored as one JSON array on the
  submission row, not a separate `anti_cheat_events` table — fine for "show me this submission's
  timeline," not for "show me every idle event across all submissions for job X" without an
  application-level scan.
- **Migration `0013_thankful_maestro.sql` (`text[]` → `jsonb` for `anti_cheat_flags`) hasn't been
  run against a real database** — this was built and verified against the schema only (no
  `DATABASE_URL` available in this environment). A plain `ALTER COLUMN TYPE jsonb` has no
  `USING` clause for `text[]` data; if any submission has already accumulated old-format string
  flags before this migration runs, that statement will likely fail and need a manual `USING`
  cast (e.g. converting each string to `{"type": <string>, "taskId": null, "occurredAt": ...}`)
  rather than running as generated.
- **The exact idle threshold value is a guess, not a confirmed product decision.** Currently 5
  minutes (`IDLE_THRESHOLD_MS` in `TaskRunner.tsx`) — this came from clarifying an ambiguous
  "5ms" in the original request; the per-spell-duration *mechanism* is confirmed, just not this
  specific number.
- **Heartbeat-staleness math assumes the 20s ping interval stays roughly as-is.** If
  `PING_INTERVAL_MS` in `useConnectionMonitor.ts` changes significantly,
  `HEARTBEAT_STALE_THRESHOLD_MS` in `submissions.service.ts` should move with it (kept as two
  separate constants in two separate files, not derived from one shared source).
- **No rate limiting on `POST /submissions/:id/heartbeat`.** It's guarded and ownership-checked,
  but a misbehaving client could hammer it faster than every 20s with no server-side throttle.
