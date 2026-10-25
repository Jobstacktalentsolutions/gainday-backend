# GAINDAY — Finance Role: Simulation Categories & Grading

This document specifies the finance role: how finance is assessed, the task categories, how each is graded, and what is built. It is the content behind the finance module (`src/modules/generation/roles/finance/`) and follows the structure of the sales document.

The biggest design risk in finance is not variety or tone. Many finance tasks have one correct numeric answer, so a wrong answer key silently penalises candidates. Every figure a candidate sees, and every answer the grader checks, is therefore derived in code from raw inputs. The model never writes a derived number.

**Evidence note:** the research drew on a mix of source quality. The strongest source is the Financial Executives International (FEI) hiring guide on screening financial analysts. Assessment vendors and e-tray guides were used for task formats. Only findings that several independent sources agreed on were used. The source links in Section 11 were not re-checked in the review that produced this revision.

---

## 1. How Finance Assessment Is Structured

Five formats recur across finance hiring:

1. **Work samples**: short, fictional, identical for every candidate, scored against an anchored rubric (for example, a budget-vs-actual variance with a written explanation for a non-finance leader).
2. **Accounting practicals**: bank reconciliation, journal entries, classifying transactions. Common for bookkeeper, AP/AR and accounts-assistant roles.
3. **E-tray / in-basket**: a simulated inbox; the candidate prioritises, replies and escalates. Scoring centres on written judgment.
4. **Numerical reasoning tests**: timed multiple choice over tables and charts. These are aptitude screens, not job simulations, and are not built here.
5. **Case studies**: profitability, ROI, market entry. Long-form and high wrong-answer risk; deferred.

Rubric practice from the FEI guide that this design follows: the same prompt and figures for every candidate; reconcile totals before explaining; reward stating what cannot be concluded; **score analytical and presentation quality separately**.

---

## 2. Categories

Each category names its real-world form, the Gainday task shape, the components it uses, and what is graded. Interface and component names match the code.

### 2.1 Reconciliation & Cash Control (built)
- **Real-world form:** reconcile a bank statement to the cash ledger. Each reconciling item adjusts either the bank side or the ledger side. Compute the adjusted balance.
- **Gainday task shape:** a table of reconciling items with amounts, plus the bank and ledger balances, which the code derives. The candidate chooses a side for each item and enters the adjusted balance.
- **Components:** objective `RECONCILIATION` (side per item, adjusted balance), paired with `WRITTEN_JUSTIFICATION` (which entries need posting before period end, and why).
- **Derivation:** the code solves backwards from the adjusted balance, so both reconciliations hold exactly.
- **Graded:** each item's side is one part, the adjusted balance is one part. Partial credit per part.
- **Maps to criteria:** problem-solving and judgment (answer key); written communication and commercial awareness (justification).
- **Interface:** Table View + Reconciliation answer + Text Area.

### 2.2 Capex vs Opex & Journal Entries (built)
- **Real-world form:** decide whether a transaction is capitalised or expensed, and post the journal entry.
- **Gainday task shape:** transactions with amounts. The candidate posts a balanced entry per clear-cut transaction. One transaction is deliberately ambiguous; it is shown but not keyed.
- **Components:** objective `JOURNAL_ENTRY` (account, side and amount per line), paired with `WRITTEN_JUSTIFICATION` for the ambiguous transaction.
- **Caution:** the correct treatment of an edge case can depend on the accounting framework (IFRS vs US GAAP) and policy. Only clear-cut transactions are keyed. The ambiguous one is graded on written reasoning, never a fixed label.
- **Graded:** an entry counts only when all its lines match the key exactly. Lines for transactions the key does not contain are ignored.
- **Interface:** Table View + Journal Entry answer + Text Area.

### 2.3 Variance Analysis & Explanation (built)
- **Real-world form:** the FEI work sample: budget and actual by line; find the material drivers and explain them to a non-finance leader.
- **Gainday task shape:** a budget-vs-actual table. The candidate computes the variance and the variance percentage for each line, then writes an explanation.
- **Components:** objective `NUMERIC_TABLE` (variance in currency and in percent), paired with `INTERPRETATION_ANALYSIS`.
- **Graded:** each cell is one part, checked against its column tolerance. The explanation is graded on the written criteria.
- **Interface:** Table View + Numeric Table answer + Text Area.

### 2.4 Stakeholder Communication & Pushback (built)
- **Real-world form:** reply to a frustrated department head or answer a CFO question, in writing.
- **Gainday task shape:** a stakeholder message as read-only context, then a written response. The task contains no figures, so the text states none.
- **Components:** pure open-ended `STAKEHOLDER_PUSHBACK_RESPONSE`.
- **Graded:** all four criteria by the LLM grader against anchors.
- **Interface:** Text Area.

### 2.5 Forecast Update (built)
- **Real-world form:** the FEI "forecast update after a change in volume or pricing".
- **Gainday task shape:** a forecast's base assumptions and a change (price, units, one-off cost), shown as a base-vs-revised table. The candidate computes the revised operating result, then explains its effect.
- **Components:** objective `NUMERIC_INPUT` (revised operating result, tolerance one whole unit), paired with `INTERPRETATION_ANALYSIS`.
- **Not built:** the full FEI version, where the candidate edits a spreadsheet model with a control check, needs a Spreadsheet Grid (Section 3). The "choose among options then answer pushback" variant is also not built.
- **Interface:** Table View + Numeric Input + Text Area.

### 2.6 Statement & Data Interpretation (built, charts included)
- **Real-world form:** read figures from statements and draw a conclusion: margin trends across periods.
- **Gainday task shape:** a period table and a chart drawn from the same figures. The candidate computes gross and operating margins per period, then flags what to raise with the CFO.
- **Components:** objective `NUMERIC_TABLE` (margin per period, to one decimal place), paired with `INTERPRETATION_ANALYSIS`.
- **Chart rule:** the chart shows only figures that also appear in the table, so the two cannot disagree.
- **Interface:** Table View with Chart + Numeric Table answer + Text Area.

---

## 3. Categories Not Built (need interfaces or architecture not in scope)

- **Spreadsheet model build / forecast model**: needs a Spreadsheet Grid and a way to grade formulas and structure, not just final values. High value for FP&A; high build cost.
- **E-tray / in-basket**: needs an Inbox View. Prioritisation is graded as reasoning (why this order, what was delegated), against planted conflicts with clear right answers, never as a bare priority ranking. The pipeline excludes standalone priority ranking for that reason.
- **Three-slide presentation to a mock leadership panel**: needs slide authoring and live Q&A. The text-native substitute is an executive summary in the Rich Text Composer, which is not built as a finance task yet.
- **Strategic / investment case (ROI, NPV, market entry, M&A)**: multi-step calculations plus judgment; the highest wrong-answer-key risk. Defer until the answer-key mechanism is proven on the categories above in production.
- **Valuation, DCF, LBO**: specialist territory. Out of scope for MVP.

---

## 4. Interface Types and Components

| Interface / component | Status | Used by |
|---|---|---|
| Table View + Response Panel | Built (shared with sales) | 2.1, 2.2, 2.3, 2.5 |
| Table View with Chart | Built | 2.6 |
| Text Area | Built (shared with sales) | Written parts of every category |
| Numeric Input | Built (existing objective type) | 2.5 |
| Reconciliation answer | Built | 2.1 |
| Journal Entry answer | Built | 2.2 |
| Numeric Table answer | Built | 2.3, 2.6 |
| Spreadsheet Grid | Not built | Model build (Section 3) |
| Inbox View | Not built | E-tray (Section 3) |

**Table formatting:** amounts use accounting format (negatives in parentheses, two decimals, currency code shown in the column header with the period). Mislabelled periods and units are a known source of numeric error, so the period sits in the column header itself.

**Charts:** a chart is read-only and built from the table's own figures. A candidate reads it, and the table beside it carries the exact values. The LLM never draws or describes a chart's numbers.

---

## 5. Figure Derivation (how the numbers are made)

The model supplies raw inputs only: balances, transaction amounts, budgets and actuals, prices and volumes, and the treatment label or the kind of each item. Code derives everything else.

| Category | The model supplies | Code derives |
|---|---|---|
| 2.1 | Adjusted balance; items with a kind (for example, outstanding cheque) | Bank and ledger balances; the side of each item |
| 2.2 | Transactions with a treatment (capitalise, expense, or ambiguous) | The balanced journal entry per clear-cut transaction |
| 2.3 | Budget and actual per line | Variance and variance percentage |
| 2.5 | Base assumptions and the change | Revised operating result |
| 2.6 | Revenue, cost of sales and operating expenses per period | Gross and operating margin; chart series |

**Figures:** the generator states figures from the data table and the LLM critic reviews them. There is no deterministic figure check. Tasks with no table, such as pushback, state no numbers.

**Regeneration:** when the model's inputs cannot form a valid task (for example, a balance would be negative), the slot regenerates like any other critic failure.

---

**Chart types built.** Four chart types are supported, each with a finance task that uses it:
- **Bar** (Statement analysis, 2.6): period amounts side by side.
- **Line** (Trend over periods): revenue across periods. The candidate computes the change across the whole period, which the line does not state.
- **Combo** (Revenue and units): revenue as bars, units sold as a line on a second axis. The candidate computes revenue per unit.
- **Waterfall** (Variance bridge): budget, then named drivers, then actual. The candidate computes the variance the drivers do not explain, which the chart leaves out.

No chart shows the value the candidate is asked to compute. Pie, area and stacked charts are not built, since no task yet needs a share of the whole.

## 6. Grading

### 6.1 Deterministic and LLM parts
- **Objective parts** are checked against the stored answer key in code, with partial credit per part. This applies to `NUMERIC_INPUT`, `RECONCILIATION`, `JOURNAL_ENTRY` and `NUMERIC_TABLE`. Other objective types (for example, the sales classification) have no key by design and stay with the LLM grader.
- **Open-ended parts** are graded by the LLM grader against anchors, as before.

### 6.2 Answer keys are computed by code, never by the LLM
Recent financial-QA research reports that LLMs fail on multi-step calculations: rounding drift, wrong period or column, incorrect compounding. A wrong key silently penalises candidates, so keys come only from the code derivation in Section 5. Anchors for finance tasks are checked against the same key.

### 6.3 Finance critic checks
- **Narrative–data consistency:** implemented (Section 5).
- **Single defensible answer:** by construction. Each key is derived from one set of inputs, and the ambiguous item is excluded from the key.
- **Independent re-computation:** not separately implemented. The derivation is deterministic and covered by unit tests against hand-computed values.
- **Framework consistency:** not implemented. Scenarios are kept to rules that are the same across frameworks; labelling the framework in the scenario is still open (Section 9).
- **Anchor soundness:** finance anchors must cite figures that match the key (`finance.anchor-config.ts`).

### 6.4 Combining the two sources
A task with an objective part is scored as follows:
- **Problem-solving and judgment** come from the answer-key result: the share of parts correct.
- **Written communication and commercial awareness** come from the LLM grader reading the open-ended answer.

Every finance task therefore assesses all four criteria. Pairing each objective part with a short written answer is a deliberate change from the research draft, which had left written communication out of pure-objective tasks. The reason is that a category left out of the score makes the capability score incomparable across roles.

### 6.5 Grading notes
- **Tolerance:** amounts shown and graded to the cent are exact (one cent). Derived currency figures may be rounded to one whole unit. Percentages are shown to one decimal place and may differ by 0.05.
- **Own-figure (follow-through) credit:** not adopted. A candidate's later answer is not credited against their own earlier wrong figure. Each task has one key, so an early slip only costs the parts that depend on it.
- **Presentation and analysis:** scored separately, as the FEI guide recommends. Written communication is the presentation criterion.

---

## 7. Sub-Role Differentiation

As with sales, "finance" is not one bucket. The Category field should carry sub-role granularity, or task-type selection has nothing to constrain against.

- **Accounting / reconciliation / finance operations** (bookkeeper, accounts assistant, AP/AR): 2.1, 2.2, 2.4. Heavily objective.
- **FP&A / financial analyst**: 2.3, 2.5, 2.6, 2.4. Mixed objective and written explanation.
- **Finance manager / business partner**: 2.3, 2.4, and the strategic case once available. Emphasis shifts from execution to accountability for the result.

Sub-role extraction is not yet specialised: the finance module registers the top-level `Finance` category, and prefix matching routes every sub-role to it.

---

## 8. MVP Scope and Status

| Category | Interface | Status |
|---|---|---|
| 2.1 Reconciliation & Cash Control | Table View + Reconciliation answer | Built |
| 2.2 Capex vs Opex & Journal Entries | Table View + Journal Entry answer | Built |
| 2.3 Variance Analysis & Explanation | Table View + Numeric Table answer | Built |
| 2.4 Stakeholder Communication & Pushback | Text Area | Built |
| 2.5 Forecast Update | Table View + Numeric Input | Built (scenario "choose option" variant not built) |
| 2.6 Statement & Data Interpretation | Table View with Chart + Numeric Table answer | Built |
| Spreadsheet model build | Spreadsheet Grid | Not built |
| E-tray / in-basket | Inbox View | Not built |
| Presentation, strategic case, valuation | n/a | Not built / out of scope |

**Why this order was chosen:** 2.1 is the simplest deterministic case and proves the answer-key path end to end. 2.3 exercises the paired objective and open-ended pattern most closely to the real work sample. 2.4 reuses the Text Area with no new build.

---

## 9. Open Items

- **Framework and currency extraction** (Section 6.3): when the posting is silent, the generator should label the accounting framework and currency in the scenario. Currency is already a required input of every figure-bearing template. The framework label is not yet extracted.
- **Journal entry on reconciliations:** 2.1 posts the reconciling items' side only. Posting the book-side journal entries as well is a possible extension.
- **Sub-role specialisation** (Section 7).
- **Chart coverage:** bar and line only. Pie charts are excluded unless composition is the point.
- **Employer editing:** figure-based tasks can have their wording edited but not their figures. The employer editor shows the answer key read-only. Locking the figure fields in the editor itself, so the employer doesn't see an error on save, is a follow-up.
- **Spreadsheet Grid and Inbox View:** Section 3.

---

## 10. Implementation Map

- **Templates:** `src/modules/generation/roles/finance/templates/` (one per category), each built on `defineTaskSpec` in `roles/task-spec.ts`.
- **Formatting and tolerances:** `roles/finance/finance-format.ts`.
- **Objective grading:** `src/modules/grading/objective/objective-grader.ts`.
- **Score merge:** `src/modules/grading/task-category-scores.ts`.
- **Answer validation on submit:** `src/modules/submissions/answer-validation.ts`.
- **Candidate view (answer key stripped):** `src/modules/simulations/candidate-task.util.ts`.
- **Employer edit lock:** `SimulationsService.lockFigures`.
- **Frontend:** `features/candidate/components/objectiveAnswers/` (three answers), `features/simulation-tasks/charts/TaskChart.tsx`, `features/simulation-tasks/componentEditors/objective/DerivedKeyViews.tsx`.

---

## 11. Sources and Evidence Quality

Primary basis:
- Financial Executives International, "Screening Financial Analyst Candidates: Skills and Work-Sample Tests": https://jobs.financialexecutives.org/career-resources/hiring-guides-4/screening-financial-analyst-candidates-skills-and-work-sample-tests-48
- Finbound, "E-Tray Exercise Finance Guide": https://www.finbound.org/blog/e-tray-exercise-finance-guide
- Jobicy, "Bank Reconciliation and Cash Control Skills Test": https://jobicy.com/tests/bank-reconciliation-and-cash-control-skills-test
- Adaface and TestGorilla financial-analyst and Excel test descriptions: https://www.adaface.com/no/assessment-test/financial-analyst-test, https://www.testgorilla.com/test-library/role-specific-skills-tests/financial-modeling-in-excel-test-2/
- Yardstick, FP&A work-sample exercises: https://www.yardstick.team/work-samples/effective-work-sample-exercises-for-hiring-top-fp-a-manager-talent
- JobTestPrep and GraduatesFirst on in-basket / e-tray formats: https://www.jobtestprep.co.uk/job-simulation, https://www.graduatesfirst.com/finance-assessment-tests

LLM numerical-reliability findings (basis for Section 6.2):
- CIFQA, deterministic tool-grounded financial QA: https://arxiv.org/pdf/2608.26114
- FrontierFinance, real-world financial task benchmark: https://arxiv.org/pdf/2604.05912
- VeriFin, verification of LLM-generated financial claims: https://arxiv.org/pdf/2608.10213

Lower confidence: chart-format claims rest on numerical-reasoning prep and vendor pages (for example https://jobcannon.io/blog/numerical-reasoning-test-guide and https://www.intervyo.co.uk/assessments/numerical-reasoning-test) rather than an authoritative assessment-design source. The no-own-figure-credit rule, the reconciliation derivation, and framework-dependence of classification answers are design decisions from general accounting practice, not findings from the sources above.
