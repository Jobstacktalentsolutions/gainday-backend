# GAINDAY — Customer Service Role: Simulation Categories & Grading (Research-Backed)

This document is the content that fills the customer service module referenced in the generation pipeline document (Section 2.2 there). It follows the same structure as the sales and finance documents: how the role is actually assessed, categories with interface tags, grading, sub-roles, and MVP scope.

Customer service differs from sales and finance in one way that drives most of what follows: **the correct answer is usually the correct application of a policy, and in Gainday that policy does not exist anywhere except inside the scenario the model writes.** In finance the risk is a wrong number; in sales it is generic craft; in customer service it is an answer key that contradicts the policy the model itself wrote. Section 5.2 is the mechanism that addresses this.

**Evidence note (read before trusting any claim here):** the sources are hiring-kit vendors, QA-software blogs, assessment vendors and one training vendor. None is peer-reviewed, and the scoring weights and pass bars some of them publish are vendor-defined, not validated. They were used for task formats and for rubric dimensions that several independent sources agreed on. Section 9 lists what was used and which recommendations are my own design reasoning.

**Scope constraint for this build:** text-first, same as sales and finance. Categories are split into what fits the current architecture (plus one small new interface component, Section 4) and what needs voice, live chat, or a product sandbox that does not exist.

---

## 1. How Customer Service Assessment Is Actually Structured

Six formats recur across sources:

1. **Written replies to realistic tickets.** The most common work-sample format. Examples: two or three anonymised tickets from the real queue, including one where the customer is angry and also wrong, answered in about half an hour and graded blind against a short rubric (PitchNHire); a 6–10 sentence email on a refund requested outside a 30-day window plus a 3–6 message chat reply to an escalated complaint with missing information (HireTruffle); a three-sentence reply to "This is ridiculous. Where is my order?!" (Amio).
2. **Situational judgment tests (SJTs).** A workplace scenario with several plausible responses; the candidate picks the one they would most and least likely do. Usually online, untimed, early-stage screens.
3. **Handoff summaries and ticket notes.** Summarise a fictional case in four bullets (Amio); write ticket notes after a fix, or hand off to billing after two transfers (HireTruffle).
4. **Simulations.** Chat simulation (eSkill), an animated work simulation (HR Avatar), and recorded audio or video answers to scenarios such as an angry caller on a Friday afternoon with a long queue (Vervoe).
5. **Product session and incident interview.** PitchNHire calls the hands-on product session the best predictor of ramp speed and uses an incident interview to separate owners from observers. Neither is a text simulation.
6. **Supplementary tests.** Typing, data entry, computer proficiency, personality, cognitive. PitchNHire advises against typing tests and personality questionnaires.

**Grading practice converges.** Independent sources score customer service work on largely the same dimensions:
- Kaizo's general support QA template: issue resolved 25%, accuracy 20%, process and policy adherence 15%, tone and empathy 15%, clarity 10%, ownership and proactivity 10%, efficiency 5%. Its email template adds "every question answered", "next steps and expectations" and "round trips avoided". Its complaints template weights acknowledgement and de-escalation, remedy offered, root cause, "ownership, no bouncing", policy and regulatory handling, follow-through, and handover documentation.
- HireTruffle scores written work 0–4 on empathy and tone, clarity and structure, information gathering, policy alignment and judgment, and ownership and next steps.
- Amio scores each answer 2 (strong), 1 (acceptable) or 0 (concerning).

**Auto-fail gates are standard QA practice.** Kaizo recommends four or five items that set the whole interaction to zero regardless of the weighted score: required verification not completed, customer data mishandled, deliberately incorrect or misleading information, abusive or dismissive conduct, a missed regulatory obligation. HireTruffle treats sharing restricted information or violating policy as a disqualifying anchor, and flags candidates for review when policy scores average below 2/4 even if the total is high.

**What this means for Gainday.** Most of the real-world material is about grading live agents against a scorecard. It transfers well because Gainday also grades written responses against a rubric. The step that does not transfer is that real scorecards check an agent against a company's actual policy. Gainday has to manufacture that policy first.

---

## 2. Categories — Fit the Current Architecture

Interface names refer to the pipeline document's taxonomy (Section 2.5) and the Case File Panel in Section 4 of this document. Built as `CASE_FILE_TEXT_AREA`. The answer widgets for choices and triage reuse existing objective components.

### 2.1 Policy-Bound Ticket Reply
**Real-world form:** reply to a customer message where the right answer depends on applying a policy: a refund requested outside the window, a delayed delivery, a plan change the customer wants but is not entitled to. The "angry and also wrong" customer is a deliberate variant.
**Gainday task shape:** a Case File (customer record, the ticket, the relevant policy excerpt) and a reply in a stated channel with a length limit. Email: roughly 6–10 sentences. Chat: a short message.
**Component type:** open-ended, graded by an LLM judge against a rubric that includes checklist items derived from the policy spec (correct outcome stated, no unauthorised commitment, next step with timing). The checklist items are keyed from the spec, not from the model's general sense of good service.
**What's graded:** acknowledges the specific situation before explaining policy; states the outcome clearly rather than hiding behind the rule; offers an authorised alternative instead of a flat "nothing I can do"; no promise outside the candidate's authority; next step with a timeframe; plain language; does not paste policy text or blame the customer.
**Maps to Gainday criteria:** judgment/execution (primary), written communication, problem-solving, commercial/domain awareness (choosing a remedy that preserves the relationship within authority).
**Interface:** Case File Panel + Text Area.

### 2.2 De-escalation & Boundary-Setting
**Real-world form:** a customer who is furious, abusive, or threatening a bad review or chargeback. Sources: the Friday-afternoon angry caller (Vervoe), the "customer threatens a bad review" and "customer calls the policy unfair" scenarios (Amio), repeated abusive language in chat (HireTruffle).
**Gainday task shape:** an escalated message with an intensity setting. The candidate responds in writing. Abuse, where present, stays mild and non-discriminatory (Section 5.3).
**Component type:** open-ended.
**What's graded:** the ACE sequence used by training vendors is a usable rubric vocabulary: acknowledge before explaining, clarify the real problem behind the complaint, engage the customer with options. Avoids "please calm down", mirroring the customer's anger, defensiveness, over-apologising without a solution, and unauthorised compensation. Sets a calm boundary on abuse, and escalates threats or safety concerns instead of handling them alone.
**Maps to Gainday criteria:** written communication and judgment/execution (primary), problem-solving.
**Caution:** ACE is a training-vendor framework, not a validated standard. Use it to write observable rubric items, not to require a fixed three-step structure in every reply.
**Interface:** Case File Panel (light) + Text Area.

### 2.3 Improper Request / Compliance Gate
**Real-world form:** the request that must not be granted: skip identity verification, disclose another person's information, mark a delivered item "not delivered", grant a refund outside the agent's authority. HireTruffle's bank includes verification failure (a miss is disqualifying) and falsely marking an item undelivered. The strong response refuses and offers the legitimate path.
**Gainday task shape:** a scenario containing one tempting-but-prohibited action. Text-only version: candidate writes the customer-facing reply, and the judge checks whether it grants the request. Fuller version (not built): first choose the next action from a short list that includes the prohibited action, then write the reply. It would use the existing single-best-action widget, keyed in code. The pairing is justified because the choice alone does not show whether the candidate can decline without damaging the relationship.
**Component type:** open-ended (text-only version) or paired objective + open-ended.
**What's graded:** did not take the prohibited action; names what is needed instead (verification step, documented exception path, escalation); stays courteous.
**Gate:** granting the prohibited action is a critical error (Section 5.5).
**Maps to Gainday criteria:** judgment/execution (primary), written communication.
**Interface:** Case File Panel + Text Area. The fuller version adds a single-best-action widget (not built).

### 2.4 Diagnostic Questioning
**Real-world form:** a vague report such as "it's not working" or "the app is broken". Strong answers ask two or three targeted questions to narrow the issue before suggesting anything; weak answers send a generic "can you explain more?" or guess a fix (Amio, HireTruffle, PitchNHire).
**Gainday task shape:** a vague report plus limited account data. Candidate selects the two most useful clarifying questions from five or six (multi-select under constraint), then writes the customer-facing message that asks them.
**Component type:** paired objective + open-ended. The selection tests diagnostic reasoning; the writing tests whether a stressed, non-technical customer could follow and act on it.
**Answer-key mechanism (design recommendation):** the model emits three plausible root causes and, for each candidate question, the answer it would return under each cause. Code marks a question useful if its answers differ across causes, and the best pair as the one that separates all causes. The key is then computed, not asserted.
**Maps to Gainday criteria:** problem-solving (primary), written communication.
**Risk:** the more technical the product, the more the model has to invent product behaviour. Keep products to common categories (login, billing, delivery, app crash) and avoid claims about how a specific real product works.
**Interface:** Case File Panel + Multi-select under constraint + Text Area.

### 2.5 Escalation & Handoff Summary
**Real-world form:** a case with a messy history gets passed to billing or a second-tier team. Strong handoffs include what was reported, what was tried, the customer's state and any risk, what the next team must do, and by when. Weak ones are long, blame the customer, or treat escalation as a way to clear the queue.
**Gainday task shape:** a thread of six to ten prior messages and notes. Candidate writes a handoff in a fixed format (for example four bullets). Optional first step: decide whether to escalate and to whom, where the policy makes that unambiguous.
**Component type:** open-ended with a fact checklist keyed from the spec. This is the most objectively gradable written category, because the facts that must appear are known in advance.
**What's graded:** required facts present and correct; nothing invented; concise; no blame; clear ask and deadline.
**Maps to Gainday criteria:** judgment/execution (primary: ownership, completeness), written communication, problem-solving.
**Interface:** Case File Panel + Text Area. The optional routing choice is not built.

### 2.6 Ticket Triage
**Real-world form:** three to five tickets at once. Strong answers apply explicit rules: urgency, customer risk, SLA impact, complexity, and set expectations for the tickets they do not get to first (HireTruffle, Amio).
**Pipeline tension:** the pipeline excludes standalone priority-ranking because it lacks ground truth. Triage works only if the policy defines the priority tiers and the data makes one ticket the unambiguous first pick.
**Gainday task shape:** a queue table with SLA timers, customer tier and impact, plus a short triage guideline in the Case File that defines priority tiers. Candidate selects the one ticket to work first, assigns an action to each other ticket (reply now, send a holding reply, escalate, defer), and justifies the first pick in about 60 words. Not a full ranking.
**Component type:** paired objective + open-ended. Code verifies that exactly one ticket is the correct first pick under the stated guideline.
**Maps to Gainday criteria:** problem-solving and judgment/execution (primary), commercial/domain awareness.
**Interface:** Case File Panel (queue as a tab, triage guideline as a tab) + Keyed classification (action per ticket) + Text Area. The first pick is the "Work first" bucket, so one objective component covers both decisions.

### 2.7 Pattern Spotting & Root-Cause Flag
**Real-world form:** noticing that several tickets share one cause and flagging it to product or documentation instead of answering each one in isolation (Amio, PitchNHire).
**Gainday task shape:** a table of 10–15 recent tickets. Candidate selects the tickets that share a cause (classification) and writes a short note to the product team.
**Component type:** paired objective + open-ended.
**Maps to Gainday criteria:** problem-solving, commercial/domain awareness, written communication.
**Note:** more relevant to experienced and lead roles than entry level.
**Interface:** Table View + Response Panel.

---

## 3. Categories — Not Buildable in the Current Scope

- **Live phone and voice roleplay.** Vervoe uses recorded audio and video answers; much real customer service hiring is phone-based. The text-first platform cannot test voice, pace, or active listening in real time. For phone-heavy postings the simulation measures written judgment only, and the employer should be told so.
- **Live chat simulation** (eSkill's chat simulation, interactive customer personas). Needs the multi-turn chat thread interface that is deliberately out of scope, plus transcript-level grading.
- **Animated work simulation** (HR Avatar). A vendor product; not a realistic build.
- **Product session.** PitchNHire's best predictor of ramp speed, but it needs a sandbox product to work in.
- **Incident interview.** A structured behavioural interview, not a simulation.
- **Typing, data-entry and computer proficiency tests; personality and cognitive batteries.** Not simulations of the work; one source advises against typing and personality tests.
- **QA review of another agent's reply** (support lead task): candidate scores a reply against a scorecard. Interesting for lead roles; deferred.

---

## 4. Interface Types for Customer Service

Extends the pipeline document's Section 2.5.

| Interface | Status | Used by |
|---|---|---|
| Text Area | Exists (from sales) | 2.1, 2.2, 2.3, 2.4, 2.5 |
| Table View + Response Panel | Exists (from sales) | 2.6, 2.7 |
| Structured Entry Form | Not needed: covered by existing objective widgets (multi-select, single best action, keyed classification) | none |
| Keyed classification (triage) | New objective type, reusing the classification widget | 2.6 |
| **Case File Panel** | **Built** (`CASE_FILE_TEXT_AREA`) | 2.1–2.6 |
| Rich Text Composer | Exists; not required for MVP | n/a |
| Chat thread, voice capture, product sandbox | Deferred | Section 3 |

**Case File Panel.** A read-only reference area shown alongside the response field, with tabs for customer record, ticket history, and the policy or knowledge-base excerpt. It exists because real agents work from a CRM and a knowledge base, and because the candidate cannot be expected to know a fictional company's rules. It is the text-and-records counterpart of the Table View.
- It must stay visible while the candidate writes. If tab-switch detection is part of the anti-cheat plan, everything the candidate needs must be inside the page so honest candidates are not flagged for looking things up.
- The task should state that the policy shown is the only policy that applies. Real-world assumptions about what a company "would" do must not affect the grade.

**Text Area requirement.** A visible word limit per task. Length constraints are central to customer service exercises (three sentences, 6–10 sentences, four bullets). Built: each task states its `wordLimit` in the payload, and the candidate counter reads it. Sentence counts are converted to word ranges by the template.

---

## 5. Customer Service Module Requirements (What Differs From the Generic Pipeline)

### 5.1 Extraction specifics
Beyond Category (with sub-role, Section 6), Intent, Problem and Expected Task, the module should extract or infer:
- **Channel:** email, chat, phone. Recruiter input has no channel field, so this is usually inferred. Default to written channels when the posting is silent, and flag phone-heavy roles (Section 3).
- **Industry context:** e-commerce, telecom, fintech or banking, SaaS, logistics. Regulated contexts (fintech, banking) bring verification and disclosure obligations into scope.
- **Seniority:** entry-level, experienced, lead. Controls how ambiguous the policy is and how many tasks involve discretion.
- **Locale:** currency, spelling variety, tone norms.
- **How the Problem maps to tasks:** examples that came out of the research: high refund disputes → 2.1 and 2.3; slow response or backlog → 2.6; poor escalation quality → 2.5; repeated issues reaching the queue → 2.7; churn → shared territory with sales CSM (Section 6).

### 5.2 The Policy & Case Spec: the answer key for customer service
The model should not write the scenario, the policy and the anchors in one pass. That produces anchors that quietly contradict the policy. Failure modes documented for LLM-written support replies (Respan) map directly onto anchor generation:
- **Generous fabrication:** the 10/10 anchor offers a remedy the written policy does not allow.
- **Conditional drift:** the anchor states an entitlement as unconditional and drops its conditions (proof of purchase, time window, channel).
- **Ambiguity over-confidence:** the anchor gives a firm answer where the policy says "manager discretion".

These findings come from AI support assistants, not hiring simulations; applying them to anchor generation is my inference.

**Design:**
1. The LLM first emits a **structured spec**: policy rules (conditions, windows, authorised remedies and the agent's authority limit, discretionary clauses, mandatory steps such as verification), customer record facts, the correct outcome or acceptable outcomes, forbidden commitments, information the candidate should gather, and facts a handoff must contain.
2. **Code derives** eligibility and the expected outcome (date arithmetic, amounts, windows), mirroring the finance rule that numbers come from code, not prose.
3. The Case File and the ticket text are **rendered from spec data**. The policy excerpt shown to the candidate is the spec's rule text, verbatim.
4. Anchors are generated **against the spec**, each tagged with the commitments it makes. The critic checks those commitments against the spec (Section 5.3).

### 5.3 Customer-service-specific critic checks
Added to the shared checks (novelty, duplicate, relevance, anchor correctness). Under current product decisions simulations publish without employer review, so the critic plus admin oversight are the only gates.
- **Commitment check:** every refund, credit, timeline or escalation promised in an anchor scoring 7 or above must be authorised by the spec. An unauthorised commitment appears only in low-scoring anchors, and is labelled as the defect it is. Built as an instruction in the anchor correctness prompt (an LLM check against the Policy tab and the gate), not as a deterministic check.
- **Deterministic facts:** eligibility, dates and amounts in the Case File are computed by code and consistent across ticket, record and policy.
- **Single defensible outcome:** either the spec yields one correct outcome, or it is explicitly marked discretionary and graded on reasoning against a defined set of acceptable options. Never a firm key on an ambiguous policy.
- **Completeness:** the Case File contains what the candidate needs, or the missing information is deliberate and listed in the spec as the information-gathering target.
- **Customer message safety and realism:** intensity matches the setting; abusive language is mild and generic, with no slurs or content targeting protected groups; no real company, brand or person names; no real-world incidents reused.
- **Anchor realism:** a 10/10 anchor respects the channel's length limit and does not read as an idealised template; low anchors show real, plausible defects, not strawmen.
- **Archetype diversity:** customer service scenarios converge on a few attractors (late delivery, refund outside window, password reset). This is my observation, not a sourced finding. Dedup should key on policy rule and customer situation, not just text similarity, so two scenarios with different wording but the same rule-and-situation pair count as duplicates.

### 5.4 Criteria framing (the four shared criteria, customer service interpretation)

| Criterion | Customer service interpretation | Rubric items from the research |
|---|---|---|
| Problem-solving | Diagnosing correctly, asking targeted questions, choosing a resolution that fits the issue, spotting root cause | Issue resolved, accuracy, information gathering, root cause |
| Judgment / execution | Applying the policy correctly, refusing improper requests, escalating at the right time, no unauthorised commitments, ownership and next steps with timing | Policy and process adherence, policy alignment and judgment, ownership, escalation, handover |
| Written communication | Specific rather than templated empathy, clear and scannable structure, plain language, channel-appropriate length | Tone and empathy, clarity and structure, grammar (kept small) |
| Commercial / domain awareness | Understanding what the policy protects and what the remedy costs against what the customer is worth; flagging repeat issues; recognising legal, safety and data-risk situations | Remedy proportional to value and risk, repeat-issue flagging, regulatory handling |

**Honest limit:** commercial/domain awareness is the weakest fit for entry-level customer service. If it carries a fixed share of the simulation score, tasks that barely exercise it will add noise. Recommendation: define it as customer-and-business-impact awareness, and require each task to include at least one observable rubric item for it, rather than inventing forced items.

**Placement of policy adherence:** keep it under judgment/execution, not domain awareness. If any aggregate score excludes the commercial dimension (the Capability Score currently does), policy adherence should still count.

### 5.5 Grading notes
**Illustrative anchor ladder for 2.1** (authored for this document; scenario: refund requested 10 days past a 30-day window, store credit is authorised, refunds outside the window need manager approval):

| Score | What the reply does |
|---|---|
| 10 | Acknowledges the specific disappointment; states clearly that a refund is not available under the 30-day window without hiding behind the rule; offers the authorised store credit and says how to claim it; names the documented exception path if one exists; gives a next step with timing; plain, concise, within the length limit |
| 7 | Correct outcome and an authorised alternative with a clear next step; tone somewhat templated or one needed detail (timing) missing |
| 5 | Correct outcome but flat: policy recited, alternative offered without explaining how to use it, empathy generic |
| 3 | Outcome unclear, or defensive or blaming tone, or skips the alternative ("nothing I can do"), or pastes policy text |
| 0 | Promises an unauthorised refund, misstates the policy, or is rude or dismissive (critical error) |

**Anchor wording:** per the QA rubric guidance, each level should be observable in the text, judge one behaviour per criterion, and stay within the candidate's control (a strict policy is not the candidate's failing). Record changes to anchor wording, since edits shift scores and break before-and-after comparison.

**Critical errors (gates).** Define them per task from the spec: granting the prohibited action, an unauthorised commitment, disclosing restricted data, abusive or dismissive tone. Decided: cap and flag. A triggered gate caps judgment/execution at 20 and marks the task `gateTriggered` for the employer. The cap applies only where the LLM owns judgment, so an answer key is never overridden. A single error should not erase the rest of an otherwise sound response, and gates should be rare, tied to rules visible in the Case File, and tested on the 0 and 3 anchors.

**SJT-style scoring.** HireTruffle keys options as most-aligned (6), acceptable (3–4), risky (1–2), misaligned (0). If forced-choice items are added, key them from the policy spec, not from general good-service opinion. Real SJTs are normally keyed by expert panels, and LLM-written keys on etiquette questions are unvalidated opinion. SJTs also test knowing what to do rather than doing it, so written replies are the higher-fidelity format. Treat SJTs as secondary.

**Calibration.** QA practice is to have several reviewers independently score the same ten or so interactions and treat disagreement as a sign the anchor wording is unclear. The equivalent here: an internal calibration set of customer service replies scored by humans, re-run to detect grader drift. Tone is the subjective part, so it matters more here than in finance.

**Tone and locale.** Norms for apology, formality and directness vary by region and employer. Over-apologising and scripted empathy are penalised in several sources, but warmth expectations differ. The rubric should grade clarity and fitness for the stated channel and employer context, not one house style. Keep grammar a small part of written communication, and do not penalise British, American or Nigerian English variants.

---

## 6. Sub-Role Differentiation

As with sales and finance, "customer service" is not one bucket; Category needs sub-role granularity.

- **Tier 1 support (email and chat):** 2.1, 2.2, 2.3, lighter 2.5.
- **Contact centre / phone-heavy:** 2.2 and 2.3 matter most; flag that voice is not tested.
- **Technical support:** 2.4, 2.1, 2.5, 2.7. Highest risk of invented product behaviour.
- **Complaints and escalations:** 2.2, 2.3, 2.5. Kaizo's complaints template emphasises de-escalation, remedy, root cause, ownership without bouncing, regulatory handling and handover documentation, with the highest pass mark of its templates (90%).
- **Support lead / QA:** 2.6, 2.7, and the deferred QA-review task.
- **Customer success / retention:** overlaps with the sales document's CSM sub-role. Routing needs a decision (Section 8) so a retention role does not generate from the wrong module.

---

## 7. Recommended MVP Scope

**Status (as built):** 2.1 to 2.6 are built as spec-backed templates. 2.7 (pattern spotting) is deferred to phase 3, as planned.


| Category | Interface | Phase |
|---|---|---|
| 2.1 Policy-Bound Ticket Reply | Case File Panel + Text Area | Build first |
| 2.2 De-escalation & Boundary-Setting | Case File Panel + Text Area | Build first |
| 2.3 Improper Request / Compliance Gate (text-only) | Case File Panel + Text Area | Build first |
| 2.4 Diagnostic Questioning | Case File Panel + Structured Entry Form + Text Area | Next |
| 2.5 Escalation & Handoff Summary | Case File Panel + Text Area (+ Structured Entry Form) | Next |
| 2.6 Ticket Triage | Table View + Structured Entry Form | Phase 2 |
| 2.7 Pattern Spotting | Table View + Response Panel | Phase 3 |
| Voice, live chat, product sandbox | n/a | Deferred |

**Why this order:** the first three share one interface (Case File Panel + Text Area), so the first build needs one small new component. They also exercise the hard part, the Policy & Case Spec mechanism (Section 5.2), without any form component. Once that mechanism is proven on open-ended replies, 2.4 and 2.5 add the Structured Entry Form and a fact-checklist rubric.

---

## 8. Open Items

- **Reconcile the criteria labels.** The pipeline document lists "Judgment / execution" as one criterion. The product's scoring weights treat Problem Solving & Judgement and Execution as separate dimensions. This document, like the sales and finance documents, inherits the pipeline grouping; the pipeline document should settle it.
- **Case File Panel spec:** tabs, supported content (text, small tables), maximum length, always-visible behaviour.
- **Gate handling:** decided as cap and flag (Section 5.5). Built: cap at 20 on judgment, `gateTriggered` per task. Not yet shown on the employer review page.
- **Commercial/domain awareness for customer service:** the definition in Section 5.4 is used. Its weight is 0.15 (`customer-service.anchor-config.ts`), and the one-item-per-task rule is not yet enforced.
- **Routing for customer success and retention roles:** still open. Retention tasks currently route to the customer service module only if the category says "Customer Service".
- **Channel defaults and employer disclosure:** default when the posting is silent, and what the employer is told for phone-heavy roles.
- **Calibration set:** who scores the human reference replies, and how tone is calibrated across locales.
- **SJT keying method,** if forced-choice items are added: policy-determined keys only, or expert-reviewed keys.
- **Content policy for generated customer messages:** exact limits on abusive language in 2.2.
- **Pipeline document follow-ups if this document is accepted:** add Case File Panel (and the Structured Entry Form if the finance document is accepted) to its interface taxonomy; note "structured spec first, derived artifacts second" as a pattern shared by finance (numbers from code) and customer service (answers from the policy spec).

---

## 8a. Implementation Map

- **Role module and templates:** `src/modules/generation/roles/customer-service/`, one spec template per task type.
- **Case file and rubric:** `case-file.ts` builds the tabs. Each template returns a `rubric` (checklist and gate), stored with the task and never sent to the candidate.
- **Objective answers:** `MULTI_SELECT_UNDER_CONSTRAINT` (2.4) and `KEYED_CLASSIFICATION` (2.6), both graded in code.
- **Grading:** checklist marks and gate results are stored per task (`checklist`, `gateTriggered`). A triggered gate caps judgment at 20 (`task-category-scores.ts`).
- **Anchors:** `customer-service.anchor-config.ts` (weights 0.25, 0.35, 0.25, 0.15).
- **Frontend:** `CaseFileTextAreaAnswer` (candidate), `CaseFileTextAreaView` (employer, read-only), and `KeyedClassificationKeyView` (answer key).

## 9. Sources and Evidence Quality

Primary basis (vendor and practitioner content):
- HireTruffle, customer service assessment kit — https://hiretruffle.com/assessments/customer-service-assessment-test-practice-hiring-kit (scenario bank, written samples, 0–4 dimensions, point scoring and pass bars)
- Amio, customer service interview questions — https://amio.io/blog/customer-service-interview-questions-that-prevent-bad-hires (ticket reply and handoff exercises, 2/1/0 scoring, red flags)
- PitchNHire, customer support representative hiring guide — https://www.pitchnhire.com/how-to-hire/customer-support-representative (mock tickets, product session, red flags)
- Kaizo, QA scorecard templates and QA rubrics — https://kaizo.com/blog/qa-scorecard-templates/, https://kaizo.com/blog/what-is-a-qa-rubric/
- Supportbench, building a QA scorecard — https://www.supportbench.com/?p=24139
- Vervoe, contact centre assessment — https://vervoe.com/assessment-library/contact-centre-representative-skills-assessment/
- eSkill, customer service assessment examples — https://www.eskill.com/resources/blog/customer-service-assessment-test-examples-for-improved-hiring
- HR Avatar, customer service representative test — https://www.hravatar.com/ta/tests/5975/customer-service-representative-with-email-and-calls.html
- Practice4me, customer service SJT — https://practice4me.com/customer-service-sjt
- Revolution Learning, ACE de-escalation framework — https://www.revolutionlearning.co.uk/blog/the-ace-de-escalation-framework/
- Respan, policy hallucination in support AI — https://www.respan.ai/resources/support-ai-policy-hallucination

**Lower confidence:** all weights, point scales and pass bars (HireTruffle's 60/40 split and 70/78 pass bars, Kaizo's per-template weights and pass marks) are vendor-defined and unvalidated; they inform rubric dimensions, not Gainday's scoring. QA scorecard material is for evaluating live agents, adapted here for candidates. The ACE framework is a training-vendor model. The eSkill, HR Avatar and Practice4me pages gave structure only; the item content and scoring were not published.

**My own design reasoning, not findings from the sources:** the Policy & Case Spec mechanism; applying the support-AI failure modes to anchor generation; the cause-by-question key for 2.4; the triage guideline that makes 2.6 gradable; cap-and-flag for gates; the archetype-diversity concern; placing policy adherence under judgment/execution; the locale and tone guidance; and the MVP ordering.
