# GAINDAY — AI Generation Pipeline

Gainday's AI engine generates and grades job simulations for hiring: recruiters submit a job description, and the engine produces a simulation of realistic on-the-job tasks that candidates complete and are graded on. This document describes how the simulation-generation pipeline works, end to end, and how it's structured to support multiple roles as isolated, independently-tunable modules.

**No external data source.** The engine does not retrieve from an external knowledge base (regulatory bodies, academic case studies, filings, professional-body materials). Building that out is largely manual, licensing-gated work not affordable at this stage. Instead, generation relies on the model's own training-data domain knowledge, with the structural controls below in place to compensate for the accuracy and repetition risks that external grounding would otherwise help mitigate.

**Built on LangGraph.** The pipeline is implemented as a graph of role-isolated chains/nodes (Section 2), not one shared prompt path reused across roles.

---

## 1. Recruiter Input

Kept deliberately short, captured at job-posting time:
- Job description
- Required skills/competencies of interest
- The specific business problem the employer wants this hire to help solve (optional field — not always provided)

The business-problem field, when present, is what makes a simulation feel like a real scenario rather than a generic exercise.

---

## 2. Role Isolation & Adaptability

Different roles need to be approached differently — not just in wording, but in what kind of simulation is even appropriate. Finance is primarily a static, data/document-based case study: candidate is given numbers, tables, or a written scenario, and produces a calculation and/or written analysis. Sales is primarily conversational/situational: candidate is reacting to a persona, an objection, or a live situation, with several categories adaptable to single-turn written form and others requiring a genuinely different, multi-turn architecture (see the companion Sales document for specifics).

Because roles differ this much, one shared set of generation instructions produces generic, poorly-targeted output for at least one side. The pipeline is built instead so each role owns its own configuration, plugged into a common skeleton.

### 2.1 What stays shared (the skeleton)
The pipeline stages in Sections 3–7 below apply to every role. This is the reusable backbone: extraction → overgenerate-and-rank → per-task generation with anchors → critic validation → storage/delivery. This does not change per role.

### 2.2 What gets isolated per role
Each role supplies its own version of the following, as a self-contained, independently-editable module (a chain/node in LangGraph):
- **Extraction prompt specifics** — what Category sub-domains, Intent framing, and Expected Task pools look like for this role specifically.
- **Allowed task-pattern types** — the baseline taxonomy in Section 5 is finance's native fit; a role like sales may define its own allowed task shapes instead of, or in addition to, that taxonomy (see companion Sales document).
- **Anchor-response criteria weighting/framing** — the four scoring criteria (Section 6.2) likely need role-specific interpretation. "Commercial/domain awareness" means something different for a candidate handling a sales objection than for one reconciling a ledger.
- **Critic checks specific to the role** — e.g. an anchor-correctness check for sales needs to verify sound sales practice, not just factual/numeric accuracy, which is more the finance concern.
- **Presentation-layer requirements** — finance needs the frontend to render numeric/tabular data in a way a finance-literate candidate can actually work with (tables, figures, clearly formatted numbers). Sales is primarily text-based, with the presentation question centering on how a scenario/persona/message thread is displayed. Each role's document specifies its own presentation needs — this is not solved generically once for all roles.

**How role selection works:** the Category field extracted at Stage 3 is the router. It isn't just a content filter — it's the selector that determines which role's module gets invoked for every subsequent stage.

### 2.3 Extensibility model
Adding a new role means writing a new self-contained module (extraction specifics, allowed task types, criteria framing, critic checks, presentation spec) and registering it under a new Category value. It does not require editing any existing role's module or the shared skeleton. Removing a role means removing its registration. Retuning a role over time means editing only that role's module.

### 2.4 Current rollout plan
**Sales first.** Sales content is primarily text-based at this stage, which means it can be built and validated inside the current architecture without also having to solve a data-visualization presentation layer at the same time. Finance requires that visual/tabular presentation work in addition to the generation logic, so it's sequenced second, once the sales module has proven the role-isolated architecture end to end. The companion document — GAINDAY Sales Role: Simulation Categories & Grading — is the content that fills the sales module described in 2.2, sourced from research into how sales candidates are actually assessed.

### 2.5 Interface Type Taxonomy
Different task categories need to be presented differently — this was underspecified as a single generic "presentation-layer requirements" bullet in 2.2 and is formalized here as its own taxonomy, analogous to the task-pattern taxonomy in Section 5. Every generated task is tagged with an **interface type** as part of its metadata (Section 6.1), which tells the frontend how to render it.

**Current interface types (MVP scope — sales):**
- **Rich Text Composer** — for tasks where the candidate produces a standalone written deliverable with no one replying to them (e.g. a cold outreach email, an account plan). Supports basic formatting (paragraphs, bullets) matching what the real deliverable would look like.
- **Text Area** — for tasks where the candidate responds to a described scenario or a persona's statement shown as read-only context above the input, but no back-and-forth thread is presented (e.g. an objection-handling reply, a situational-judgment response). Deliberately not a chat/message-thread interface — kept simple for now, no multi-turn UI.
- **Table View + Response Panel** — for tasks built on structured data the candidate has to work with (e.g. a mock CRM lead list for prioritization): a data table alongside a response area for the ranking/classification and its justification.

**Extensibility note:** this taxonomy is expected to grow as new roles are added — finance, for instance, will need an interface type (or types) for charts, computed figures, or other visual/numeric data display that none of the three current types cover. Each role module (Section 2.2) can introduce new interface types rather than being constrained to the three above; this list is the current baseline, not a ceiling.

---

## 3. Extraction Stage

Four fields are extracted from the recruiter input. The specifics of each field (what counts as a valid Category, how Intent is framed, what an Expected Task looks like) are defined per role module per Section 2.2 — the table below describes the field's purpose, using finance as the illustrative example.

| Field | Description | Required? |
|---|---|---|
| **Category** | Domain and sub-domain (e.g. Finance > Reconciliation; for sales, this needs sub-role granularity — SDR / AE / CSM — not just "Sales" as one bucket). Doubles as the router to the correct role module (Section 2.2). | Always extracted/inferred |
| **Intent** | The skills and competencies the employer is expecting the hire to demonstrate. | Always extracted/inferred |
| **Problem** | The specific business problem the employer describes wanting this hire to help solve, if stated in the input. | Extracted if present; otherwise null — never fabricated |
| **Expected task** | A set of plausible on-the-job tasks inferred from the role/description, using the model's general and industry-specific knowledge. Generated as a candidate pool (Section 4), not a single task. | Always inferred |

**Purpose of Category:** beyond routing to a role module, it constrains which task-pattern types are plausible for the specific sub-domain, preventing task-type selection from producing mismatched items — e.g. a numeric-calculation task for a role centered on stakeholder communication.

---

## 4. Task Candidate Generation (Overgenerate-and-Rank)

1. Using the four extracted fields, the model generates a candidate pool of **~15 expected tasks** (number may vary).
2. A selection step scores each candidate against explicit relevance criteria: alignment with Intent, alignment with Category, and — if a Problem was extracted — whether the task can meaningfully incorporate it. This scoring must be explicit (e.g. an LLM-as-judge pass against a defined rubric), not implicit "pick what looks relevant."
3. The top-scoring subset (**default: 4 tasks**, variable) is selected to proceed to full generation.

This is the established "overgenerate-and-rank" pattern used in LLM question-generation: generate a larger diverse candidate pool, then rank/select, rather than generating the final count directly. This also absorbs the repetition-avoidance goal — variety comes from which candidates get selected and how the pool is generated, not from unconstrained random task-type draws.

**Task-type selection is constrained, not fully random:** it is limited to task-pattern types allowed for the extracted Category's role module (Section 2.2) before any randomization happens.

---

## 5. Task Pattern Types (Finance-Native Baseline)

This taxonomy is the native fit for finance and any role with a similar static, data/document-based structure. It is not assumed to be universal — a role module may define a different set of task shapes entirely (sales does; see companion document). Treat this section as the default baseline a new role module can adopt, extend, or replace.

Each task is built from one or both of two component types:

**Objective components** — have a real, defensible correct answer, machine-gradable, no LLM judgment call required at grading time:
- Numeric input (calculate a value, checked against a tolerance range)
- Correct classification/categorization (sort items into correct buckets)
- Procedural sequencing (order steps that have a genuinely correct process order)
- Single-best-action selection (pick the one correct action among plausible distractors)
- Multi-select under constraint (e.g. "choose 2 of 3," graded against an ideal set membership)

**Open-ended components** — require LLM rubric judgment, no single correct answer:
- Written justification of a decision already made
- Drafted communication (message/summary to a stakeholder)
- Interpretation/analysis of data
- Response to stakeholder pushback

**Combination rule:** not every task needs both component types. Pair an objective and open-ended component only when the objective answer alone wouldn't reveal whether the candidate actually understands *why* it's correct. Otherwise, use whichever single component type fits what's being tested.

**Excluded task type (applies across roles):** priority-ranking tasks are not supported as a standalone mechanic — dropped because ranking by priority is usually a judgment call disguised as an objective mechanic, lacking genuine ground truth. Where a role needs something ranking-shaped (e.g. sales lead prioritization), it must be built so the underlying data makes some orderings clearly better than others, with the reasoning graded as an open-ended component — not scored as pure objective ranking.

---

## 6. Per-Task Generation

For each of the selected tasks, the generation agent produces a structured object:

### 6.1 Structure
- The task itself (scenario text, task components per the role module's allowed types — Section 5 or the role-specific equivalent)
- Associated metadata (task type, category, source fields it was derived from, and **interface type** per Section 2.5 — tells the frontend how to render the task)
- **Problem inclusion rule:** if a business Problem was extracted in Section 3, it must be woven into the task content. If no Problem was extracted, the task is generated without one — never fabricated to fill the field.
- A set of **anchor responses** (Section 6.2), used later at grading time

### 6.2 Anchor Responses — 5-Point Scale
A single "good response = 10/10" and "bad response = 0/10" pair is not sufficient. The hardest grading problem is distinguishing mid-range answers (a 6 from a 7) — exactly where real candidate responses cluster. Two extreme anchors give a grader nothing to calibrate against there.

**Anchors generated per task: minimum 4–5 points across the range** — e.g. scores of 0, 3, 5, 7, 10 — not just the two poles.

Each anchor response is scored against four criteria:
1. **Problem-solving**
2. **Judgment / execution**
3. **Written communication**
4. **Commercial / domain awareness**

These four criteria are shared across roles, but their interpretation is role-specific (Section 2.2) — e.g. "commercial/domain awareness" for a sales objection-handling task means something different than for a finance reconciliation task, and the role module should frame the criterion accordingly rather than applying one generic definition everywhere.

A "10/10" anchor should score maximally on all four criteria. **Caution:** a response that is simultaneously perfect across all four is a narrow target — real strong answers often trade off (e.g. commercially sharp but less polished prose). The generation prompt should avoid manufacturing an artificially "perfect" anchor that doesn't resemble any answer a real grader would actually encounter.

These anchors are reference points for the grading model at scoring time — they define what a good vs. mediocre vs. poor response looks like, not just good vs. bad. (Grading itself — how a candidate's actual submission gets scored against these anchors — is a separate process from generation and is not covered in this document.)

---

## 7. Critic Agent (Validation Layer)

The critic agent is a separate step from generation. It validates each generated task before anything is persisted or shown to the employer.

### 7.1 Checks performed
- **Novelty check:** the generated question is compared against the existing question bank using pgvector similarity search (Postgres vector extension) to retrieve semantically similar stored questions.
- **Duplicate check:** flags near-identical matches from the novelty search above a similarity threshold.
- **Relevance check:** confirms the generated task genuinely aligns with the extracted Category and Intent (not just novel, but actually on-target).
- **Anchor correctness check:** because there is no external grounding source, the good/bad/mid-range anchor responses (Section 6.2) are themselves LLM-generated and could be subtly wrong. The critic verifies they are sound — an incorrect "10/10" anchor would silently corrupt every future grading decision made against it. What "sound" means is role-specific: factual/numeric correctness for finance, sound sales practice for sales (Section 2.2) — the role module defines the correctness check, not one generic definition.

### 7.2 Regeneration loop
- If a task fails critique (duplicate, irrelevant, or anchor-correctness failure), the generation agent selects another candidate from the original overgenerated pool (Section 4) rather than restarting extraction.
- **Iteration cap:** a hard maximum number of regeneration attempts per task slot is enforced — proposed default: **3 attempts**. Without a cap, an unbounded loop risks stalling indefinitely on a niche or oversaturated role category.
- **Fallback on cap exhaustion:** if a task slot fails all attempts, it routes to an admin review view (generations the engine failed to validate) rather than being silently dropped or forced through unvalidated.

### 7.3 On success
Once a task passes all critic checks, it is:
1. Persisted to the question bank (pgvector-indexed, for future novelty checks against later generations).
2. Returned as part of the simulation response to the frontend.

---

## 8. Fairness / Variant Scope Note

Each job posting generates **one simulation, shown identically to every candidate applying to that posting** — not per-candidate randomized variants. Cross-candidate difficulty-equivalence between variants is therefore **not a live concern at this stage**, and no parametrized cosmetic/structural variable system is being built for that purpose right now.

**Deferred, not dismissed:** if simulations are later cached and reused across multiple job postings (a considered future direction to reduce generation cost), both the fairness/difficulty-equivalence question and the repetition question return in a different form, since different candidate pools could then see variants or exact copies of the same underlying item. Revisit at that point.

---

## 9. Grading Note (Context Only)

Generation and grading run at different points and use different model settings. Grading (not detailed in this document) uses low/zero temperature for consistency across repeated scoring of the same answer, and compares candidate submissions against the anchor responses stored in Section 6.2. Generation, by contrast, benefits from higher temperature for creativity and variety in producing the task pool. These are separate settings for separate stages — not one shared value.

---

## 10. Open Items

- **Ranking criterion for candidate-task selection (Section 4)** must be made concrete — an explicit LLM-as-judge rubric scoring relevance to Intent/Category/Problem, not an implicit "pick the best" step.
- **Iteration cap value (Section 7.2)** proposed at 3 — needs testing/tuning against real generation failure rates.
- **Anchor-correctness validation method (Section 7.1)** needs to be specified concretely per role — e.g. a second-pass LLM check against known domain rules, or periodic human/expert spot-review — not left as an unspecified checkbox.
- **Role config schema** — a concrete schema (what fields every role module must implement: extraction prompt, task types, criteria framing, critic checks, presentation spec) needs to be defined so future roles beyond sales and finance can be added consistently.
- **Presentation-layer ownership** — needs a decision on whether presentation requirements live in the same LangGraph module as generation logic, or are tracked as a separate frontend-facing spec per role that references it.
- **Finance interface types (Section 2.5)** are not yet defined — charts, tables of computed figures, and other visual/numeric display needs will have to be specified when the finance module is built, since none of the three current sales-derived interface types (Rich Text Composer, Text Area, Table View) are designed for that.
- **Sales sub-role granularity** — Category extraction for sales needs to distinguish SDR / AE / CSM (Section 3), not treat "Sales" as one bucket; the companion Sales document covers why.
