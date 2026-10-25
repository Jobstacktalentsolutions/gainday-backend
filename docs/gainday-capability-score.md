# GAINDAY — Capability Score

The capability score is a candidate's portable 0-1000 rating, built from their graded
simulations. It is computed in `src/modules/submissions/employer-submission.view.ts`
(`capabilityPoints`, `capabilityScoreHistory`) and reused by the candidate passport
(`src/modules/capability-passport/capability-passport.util.ts`, `buildHistory`).

## 1. Per-application points

Each graded submission gives `p` points:

```
p = round( average(problemSolving, judgmentExecution, writtenCommunication) × 10 )
```

Commercial/domain awareness is excluded because it does not transfer across domains.

## 2. Score after each application

For the application at index `i` (oldest first), the score uses applications `j ≤ i`:

```
w_j     = 0.5 ^ ((completedAt_i − completedAt_j) / H)      H = 180 days
score_i = round( (κ·μ + Σ w_j·p_j) / (κ + Σ w_j) )        μ = 500, κ = 2
```

- **Recency:** an application's weight halves every 180 days, measured back from the
  newest application in the sequence. The score does not fall just because time passes.
- **Shrinkage:** `μ` and `κ` act as a prior. A candidate with little history stays near 500.
  Each application adds real weight, so a long history reflects its results.

The current capability score is the last value, `score_last`.

## 3. Effect

| Situation | Behaviour |
|---|---|
| One application at 900 | Scores 633, not 900 |
| Three applications at 900, same time | Scores 740 |
| Many consistent applications | Converges on their results (about 682 for 20 applications at 700) |
| A new result after a long history | Moves the score by roughly 1/(effective applications), and old results fade |

Effective applications are about `1.44 × attempts-per-half-life`, so a candidate applying
once a month has about nine applications' worth of weight. Each new result still shifts the
score noticeably.

## 4. Tuning

`H`, `μ` and `κ` are exported from `employer-submission.view.ts`
(`CAPABILITY_HALF_LIFE_DAYS`, `CAPABILITY_PRIOR_SCORE`, `CAPABILITY_PRIOR_WEIGHT`). No real
candidate has been graded yet (see `gainday-grading-pipeline.md`), so these are starting values.
Revisit them once real submissions show how scores spread. Histories are computed from
submissions on read, so a change applies to every candidate immediately.
