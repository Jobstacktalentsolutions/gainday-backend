# GAINDAY — Sales Role: Simulation Categories & Grading (Research-Backed)

This document is the content that fills the sales module referenced in the architecture document. It's based on research into how sales candidates are actually assessed in real hiring processes and sales training platforms — not invented categories.

**Scope constraint for this build:** the platform is text-first. Live, voice-driven, multi-turn AI-persona roleplay (what most commercial sales training tools like Hyperbound, Cold Call Coach, and Second Nature are built around) is a real category of sales assessment, but it requires a different generation and grading architecture than the current single-shot "task + anchor responses" model. This document splits categories into what fits the current architecture as single-turn written exercises, and what requires the multi-turn conversational build-out — so the MVP scope can be chosen deliberately.

---

## 1. How Sales Assessment Is Actually Structured

Real sales hiring maps closely to the sales funnel itself. Assessment tools and interview processes consistently organize around these stages: prospecting, cold outreach, discovery, demo, objection handling, closing/negotiation, and post-sale handoff. Scorecards used by sales training platforms typically grade candidates stage-by-stage (opening, discovery, objections, close) rather than with one holistic score — worth keeping in mind for how Gainday's four criteria get applied per task.

Separately from the live-conversation categories, there's a well-established set of **written/asynchronous exercises** used specifically in interview processes (not just training) — these map directly onto a text-first platform without needing a conversational agent at all.

---

## 2. Categories — Text-Native (Fit the Current Architecture Directly)

These can be built as single-shot tasks with a scenario, a candidate response, and anchor responses — no live agent needed.

### 2.1 Cold Outreach / Prospecting Email
**Real-world form:** candidate is given a target company/persona profile and writes a cold outreach email pitching a product.
**Gainday task shape:** scenario gives company profile, decision-maker persona, product/service context (drawn from the employer's business problem, if extracted). Candidate writes the email.
**What's graded:** structure and brevity, whether it speaks to a real pain point rather than the product's features, a single clear call-to-action, absence of generic mass-outreach tells.
**Maps to Gainday criteria:** written communication (primary), commercial/domain awareness (does it speak the buyer's language), judgment/execution (single clear CTA is a judgment call).
**Interface:** Rich Text Composer — no reply thread involved, candidate is producing a standalone deliverable.

### 2.2 Objection Handling (Written Response)
**Real-world form:** candidate is presented with a specific objection (price, competitor, timing, skepticism) and must respond.
**Gainday task shape:** present the objection as a message from a persona (can be framed as "the prospect just said X — draft your reply"), rather than a live back-and-forth.
**What's graded:** whether the response acknowledges the objection before countering it, avoids generic reassurance language, and moves the conversation toward a next step rather than just defending the product.
**Maps to Gainday criteria:** judgment/execution (primary), written communication, commercial/domain awareness.
**Note:** real assessment platforms use escalating difficulty here (harder objections at higher levels) — worth carrying into task generation as a difficulty parameter later, not required for MVP.
**Interface:** Text Area — the objection is shown as read-only scenario context above the input; kept simple as a single response field, not a chat/message-thread interface.

### 2.3 Pipeline / Lead Prioritization
**Real-world form:** candidate is given a mock CRM view — a list of leads with attributes (deal stage, last contact, deal size, urgency signals) — and must prioritize and justify the order.
**Gainday task shape:** this is structurally the closest sales category to your existing finance task pattern — a data table plus a classification/ranking decision plus written justification. It reuses the objective-component + open-ended-component pairing you already have, just with sales data instead of financial data.
**What's graded:** prioritization logic (deal size vs. urgency vs. probability to close), not just the final order — the reasoning matters more than the ranking itself.
**Maps to Gainday criteria:** problem-solving (primary), judgment/execution, commercial/domain awareness.
**Caution carried over from earlier discussion:** priority-ranking-only tasks were excluded from your taxonomy because ranking-by-priority often lacks genuine ground truth. This category avoids that trap only if the underlying data makes some orderings clearly better than others (e.g. an urgent, near-close, high-value deal should outrank a cold, early-stage, small deal) — don't generate lead sets so ambiguous that any order is defensible.
**Interface:** Table View + Response Panel — a data table (mock CRM columns) alongside a response area for the prioritization order and its written justification.

### 2.4 Closing / Negotiation Situational Judgment
**Real-world form:** candidate is given a hypothetical situation mid-negotiation (e.g. a prospect who's been engaged for months suddenly asks for a discount, or goes quiet) and must describe how they'd respond.
**Gainday task shape:** present the situation as narrative context, ask for a written response or described next action.
**What's graded:** whether the candidate protects deal value rather than defaulting to a discount, reads the situation correctly (stalling vs. genuine hesitation), and has a concrete next step rather than a vague answer.
**Maps to Gainday criteria:** judgment/execution (primary), commercial/domain awareness.
**Interface:** Text Area — situation described as read-only context, single written response.

### 2.5 Account Planning / Strategic Prioritization
**Real-world form:** candidate is given information about a named target account and asked to produce a plan — who the stakeholders are, how to approach them, what the strategy is.
**Gainday task shape:** longer-form written exercise; give account/company context (buyer roles, likely pain points) and ask for a structured plan.
**What's graded:** whether the candidate correctly identifies multiple stakeholders (economic buyer, technical evaluator, etc.) and sequences the approach logically, not just whether the plan sounds confident.
**Maps to Gainday criteria:** problem-solving, commercial/domain awareness, written communication.
**Note:** this is the most senior/AE-oriented category — likely lower priority for an MVP unless the target roles skew senior.
**Interface:** Rich Text Composer — longer-form standalone document, no reply thread.

---

## 3. Categories — Conversational (Require Multi-Turn Architecture, Not MVP-Ready)

These are the categories most commercial sales-assessment tools are actually built around, and they're worth naming even though they're out of scope for the current architecture:

- **Cold call roleplay** — candidate calls an AI-played prospect cold, must open, qualify, and get to a next step within a few minutes.
- **Discovery call roleplay** — candidate runs a live questioning conversation with an AI-played buyer persona who reveals needs incrementally based on what's asked.
- **Live objection roleplay** — same objection-handling skill as 2.2, but reactive and escalating in real time rather than a single written response.
- **Multi-stakeholder / negotiation roleplay** — more advanced: multiple competing interests in one live conversation.

Real platforms let personas vary tone (busy, skeptical, rude, friendly) and inject industry/competitor/pricing context dynamically — this is genuinely a different generation problem (an agent that reacts to the candidate turn-by-turn) and a different grading problem (scoring a transcript, not a single response). Flagging this clearly rather than quietly folding it into the current pipeline is the right call — it needs its own design pass when you're ready to build it.

**Interface:** none of the current interface types (Rich Text Composer, Text Area, Table View — see the pipeline document's Interface Type Taxonomy) support this. A live chat/message-thread interface would be needed, which is deliberately out of scope for now — this is itself part of why Section 3 is deferred, not just the generation/grading architecture.

---

## 4. Sub-Role Differentiation (Worth Deciding Now, Not Discovering Later)

"Sales" isn't monolithic — the categories above matter differently depending on which sales sub-role the job posting is for:

- **SDR/BDR (prospecting-focused):** cold outreach, objection handling, pipeline prioritization matter most. Closing and account planning are largely irrelevant.
- **AE (closing-focused):** objection handling, closing/negotiation, and account planning matter most. Cold outreach is less central.
- **CSM/Account Manager (retention-focused):** a category not detailed above but worth adding later — renewal/retention conversations, distinct from net-new selling.

This means the extraction stage's "Category" field for sales needs sub-role granularity (SDR vs. AE vs. CSM), not just "Sales" as a single bucket — otherwise task-type selection (Section 3.3 of the architecture doc, "constrained to plausible types") has nothing to constrain against within sales itself, and an SDR posting could generate an account-planning task that has nothing to do with the actual job.

---

## 5. Recommended MVP Scope

Given the text-first constraint and the goal of proving the architecture end-to-end before expanding:

| Category | Interface |
|---|---|
| 2.1 Cold Outreach Email | Rich Text Composer |
| 2.2 Objection Handling (written) | Text Area |
| 2.3 Pipeline Prioritization | Table View + Response Panel |
| 2.4 Closing/Negotiation Situational Judgment | Text Area |
| 2.5 Account Planning | Rich Text Composer |
| Section 3 (conversational, deferred) | Chat/message-thread — not built |

**Build first:** Cold Outreach Email (2.1), Objection Handling — written (2.2), Pipeline Prioritization (2.3). These three are fully text-native, map cleanly onto the existing task-pattern taxonomy (objective + open-ended pairing), cover both SDR- and AE-relevant skills, and exercise all three current interface types.

**Defer:** Closing/Negotiation Situational Judgment (2.4) and Account Planning (2.5) until the first three are validated — they're text-native too, so it's a low-cost addition later, not an architectural change.

**Explicitly out of scope until a conversational architecture exists:** all of Section 3.
