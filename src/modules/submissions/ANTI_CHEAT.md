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

Both land in the same place: `submissions.antiCheatFlags: text[]` and
`submissions.isAntiCheatFlagged: boolean`, written once, at submit time, by
`SubmissionsService.submitAnswers()`. Nothing is written incrementally during the run — the
client accumulates in memory and reports the final tally on `PUT /submissions/:id/submit`.

## Client-reported signals (frontend)

All of this lives in `gainday-frontend/src/features/candidate/`. None of it is specific to one
violation type — each is a small standing listener that calls one shared function.

**The store** — `hooks/useSimulationIntegrityStore.ts`: a zustand store holding
`violationCounts: Record<string, number>`, incremented by `recordViolation(type)`. This
replaced an earlier deduped `antiCheatFlags: string[]` design that only recorded whether a
violation type happened *at all* — the current version counts every occurrence, so a candidate
who switched tabs 5 times looks different from one who did it once. Deliberately **not**
persisted to localStorage: a page refresh mid-run is its own signal (see "server-observed"
below), not something to paper over by resurrecting counts from a previous mount.

Three listeners feed it, all wired up in `pages/TaskRunner.tsx` for the life of the run:

| Listener | File | Fires on | Flag string |
|---|---|---|---|
| Tab visibility | `hooks/useTabVisibilityGuard.ts` | `document.hidden` becoming true, or a `window blur` event | `tab-hidden ×N` |
| Fullscreen exit | `hooks/useFullscreenGuard.ts` | `fullscreenchange` transitioning from fullscreen → not | `fullscreen-exit ×N` |
| Idle time | `hooks/useIdleDetection.ts` | see below — a gap between activity events reaching `IDLE_THRESHOLD_MS` (currently 5 minutes, set in `TaskRunner.tsx`) | `idle ×N (total Xm Ys)` |

**Idle time is measured as real per-spell duration, not counted in fixed-size ticks.**
`useIdleDetection` runs nothing on a timer while idle; instead it watches
mousemove/mousedown/keydown/scroll/touchstart/wheel, and on *each* such event checks how long
it's been since the previous one. If that gap is >= `IDLE_THRESHOLD_MS`, the gap's real duration
is reported as one idle spell (`recordIdleSpell(durationMs)`) and the clock resets. Two idle
periods separated by even a moment of activity are two independent spells — idle 6 min, active
10 sec, idle 8 min reports as two spells (6 min, 8 min), never merged into one 14-minute total.
Below the threshold, a gap isn't reported at all — a 30-second pause is thinking, not idle.

Because a spell is only closed out by an activity event, a candidate who goes idle and never
returns (walks away for good) would otherwise never trigger a report. `TaskRunner.tsx` calls
`idle.flush()` as the first step of `finalizeSubmission()` (both the explicit-submit and
timer-expiry paths) specifically to close out and report whatever spell was still open at that
moment, before building the flags to send.

`useTabVisibilityGuard` also has a separate use on `pages/EnvironmentCheckPage.tsx` (before the
simulation starts, prefixed `pre-simulation-*`) — that's a different, pre-run concern (are they
already switching tabs during the environment check) and writes to the same store but is never
sent anywhere, since there's no submission yet at that point.

**At submit time**, `TaskRunner.tsx` calls
`formatViolationFlags(useSimulationIntegrityStore.getState())` (also in
`useSimulationIntegrityStore.ts`) — reading fresh state directly via zustand's `getState()`
rather than a render-time selector, so the just-flushed idle spell above is never missed — to
turn the store into the wire format, e.g. `["tab-hidden ×3", "fullscreen-exit ×1",
"idle ×2 (total 14m6s)"]`, and sends it as `antiCheatFlags` in the `PUT /submissions/:id/submit`
body. `idleSpellCount`/`idleTotalMs` are tracked as separate counters from `violationCounts` in
the store, since a count alone would lose how long each idle spell actually was.

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
ping doesn't false-positive), it appends its own flag —
`server-stale-heartbeat-<age-in-seconds>s` — to whatever the client reported. This is the one
flag a candidate can't suppress by disabling the client-side listeners, since it's derived from
when the server actually stopped hearing from them, not from anything the client asserts about
itself.

## Persistence

`submissions.antiCheatFlags: text[]` and `submissions.antiCheatFlags.length > 0` →
`submissions.isAntiCheatFlagged: boolean` are both set in one write, in
`SubmissionsService.submitAnswers()`, at the same time as `answers`/`completedAt`/
`timeTakenSeconds`. There's no separate anti-cheat table or event log — a submission has exactly
one flags array, the final tally, not a timestamped history of individual events.

`submissions.disqualificationReason: text` exists on the schema but nothing currently sets it —
flags are recorded, nothing acts on them automatically.

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
- **No per-event timeline.** `antiCheatFlags` is a flat array of `"type ×count"` strings computed
  once at submit — there's no record of *when* each tab-switch or idle period happened relative
  to which task, only a final total for the whole run.
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
