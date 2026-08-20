# GAINDAY — REQUIREMENTS SPECIFICATION

## 1. PROJECT PHILOSOPHY

### 1.1 Core Problem
Hiring is broken at the screening stage. Employers waste hours reading CVs that say very little about whether a candidate can actually do the job. Job seekers spend time applying to roles only to be filtered out by keyword-matching algorithms or unconscious bias — before anyone has seen what they can do.

### 1.2 Core Solution
Gainday replaces CV-first screening with a role-specific AI-generated work simulation. Every applicant is judged on what they can actually do, not what they wrote on a document. Employers get a ranked shortlist of proven candidates. Job seekers get fair, skill-based evaluation and a portable score they carry to every future application.

### 1.3 Guiding Design Principle
**"Don't generate assessments. Generate workdays."**
The candidate should not feel like they are taking a test. They should feel like they've just started the job. A realistic, scenario-based simulation is:
- More engaging than a question set
- Harder to cheat on than isolated MCQs
- More representative of actual on-the-job performance

This principle governs the design of every candidate-facing task: tasks should mimic real workplace inputs (Slack/Teams-style messages, dashboards, stakeholder pushback) rather than reading as exam questions.

### 1.4 Product Positioning
Gainday is not selling "assessments" as a feature. It is selling outcomes:

**For Employers:** Less time spent screening, better hiring decisions, fewer mis-hires, higher confidence before interview, a shortlist they can trust — instead of reading through dozens/hundreds of CVs.

**For Candidates:** A fair shot regardless of CV gaps, career breaks, or non-traditional background. Judged on demonstrated capability, not credentials or network. Feedback after every simulation. A professional reputation (Capability Score) that compounds over time and keeps working for them after a single role is filled.

### 1.5 Vertical & Scope for V1
- Starting vertical: **Finance** (specifically associate/analyst-level roles). Expandable to other verticals (Sales, etc.) later — the Role Category field and AI engine should be built to generalize, but content/testing focus is Finance-only for launch.
- Single-hire assumption: each job posting is assumed to result in **one** accepted candidate. Multi-hire postings (hiring several people from one posting) are explicitly **out of scope for V1**.c

---

## 2. TARGET USERS & PERSONAS

### 2.1 Employer Persona — "The Hiring Manager"
**Who they are:** A founder, team lead, HR professional, or operations manager at a finance company. Hiring for an associate or analyst-level role.

**Their problem:** Posted a job, received ~80 applications, no reliable way to tell who is actually good. Wants a shortlist of 3–5 people they can interview with confidence.

**What they need from Gainday:** A fast job-posting flow, AI-generated simulations they can trust, a clear ranked result, and a simple way to reach the candidates they want — without spending hours speculating over CVs.

### 2.2 Job Seeker Persona — "The Ambitious Applicant"
**Who they are:** A junior to mid-level professional (0–10 years experience) actively looking for a role at a financial institution. Applies to multiple jobs per week, rarely hears back.

Two sub-profiles:
- Has a thin/unimpressive CV but knows they can do the work
- Has a strong CV but is still filtered out by ATS/keyword systems before a human sees it

**Their problem:** Screened out before anyone has actually evaluated them. No way to demonstrate ability beyond a document.

**What they need from Gainday:** A fair shot — a simulation that tests real skills, puts them in front of employers, and gives feedback on performance.

### 2.3 Admin (internal / platform operator)
Not a public-facing persona, but a required role: platform operators who need oversight and control tools (see Section 6).

---

## 3. PLATFORM STRUCTURE

Two public-facing user types, plus an internal admin role:
- **Employer** — posts jobs, reviews ranked applicants, unlocks contact details
- **Job Seeker** — discovers jobs, completes work simulations, builds a Capability Score
- **Admin** — internal platform oversight (see Section 6)

Job posting is **free**. Employers pay only to unlock contact details of specific candidates (see Section 4.9 for the current pricing model and its launch caveat).

---

## 4. EMPLOYER FLOW — FULL SPECIFICATION

### 4.1 Sign Up / Log In
Fields required: full name, company name, email address, phone number, password.
- No KYC or document verification required.
- Email confirmation is optional but recommended (not a blocker to platform access).
- Returning employers go straight to their dashboard.

### 4.2 Employer Dashboard
Shows:
- All active job posts with live status: **Draft, Active, Under Review, Shortlist Ready, Closed/Filled**
- Notification badge for new submissions
- Button to post a new job
- A section to browse candidate Capability Scores directly and unlock a candidate's contact details **independent of any specific job posting** (marketplace-style browsing)

### 4.3 Post a Job — Step 1 of 3: Job Details
Fields:
- Job Title (text, required)
- Job Description (rich text, required)
- Required Skills (tag input, required)
- Role Category (dropdown — Finance to start; expandable, required)
- Location (text or "Remote", required)
- Employment Type (dropdown: Full-time, Part-time, Contract, required)
- Salary Range (min/max + currency, required)
- Application Deadline (date, required)
- "What problem do you need this hire to solve?" (long text, required)

**Critical field note:** the business-problem answer is the core input the AI uses to build at least one task in the simulation that places the candidate directly inside the employer's real business challenge. This is a core product differentiator and must be preserved end-to-end into the AI engine's prompt construction.

**Behavior requirements:**
- Draft auto-save: if an employer leaves mid-form, progress must persist as a **Draft**-status job.
- Once a job is **published**, Job Details become **locked** — no further edits to core fields (see 4.4 for what remains editable after publish, if anything — currently none; a republish/new-post is required for material changes).

### 4.4 Post a Job — Step 2 of 3: Simulation Builder
- No manual assessment set-up required. The AI engine automatically generates a complete role-specific work simulation from Job Details + the stated business problem (see Section 5).
- The generated simulation is a **connected sequence of realistic tasks**, not a plain question list. Example task types: triaging/prioritizing incoming messages, interpreting a dashboard and briefing a stakeholder, choosing between competing priorities under a constraint, responding to stakeholder pushback.
- At least one task is built directly around the employer's stated business problem.
- The employer can:
  - Accept the simulation as-is (no action needed)
  - Edit the wording/specifics of any task
  - Remove a task
  - **Regenerate** the entire simulation if the initial output misses the mark (this must exist — editing alone is not sufficient recourse for a poor generation)

### 4.5 Post a Job — Step 3 of 3: Review & Publish
Shows:
- Job title and role category
- Number and type of simulation tasks
- Time estimate shown to candidates: **30 minutes**
- Confirmation checkbox: "I confirm this job post is accurate and the simulation reflects what I need."

On Publish: job goes live on the public board, and Job Details + Simulation become locked from further edits.

### 4.6 Job Published Confirmation
- Success message confirming the job is live
- Unique shareable link (e.g. `gainday.co/apply/[job-slug]`) for manual posting to external job boards
- Gainday does **not** auto-publish to or integrate with external platforms
- Button to return to dashboard

### 4.7 Reviewing Submissions
Employer receives batched email notifications as submissions arrive (e.g. "You have 12 new submissions for [Job Title]").

**Submissions Table** — one row per applicant:
- Applicant alias (real name hidden until unlocked)
- Overall Score (0–100)
- Category breakdown (5 categories — see Section 5.2)
- Historical Capability Score, if available
- Time taken to complete (context only, not part of ranking)
- Submission date/time
- Status: Pending Review / Shortlisted / Accepted
- **Anti-cheat flag indicator** — visible per submission if the candidate triggered a monitoring violation

Sorted by overall score by default. Filterable/sortable. Selectable via checkbox for bulk unlock action.

**Candidate Detail View** (on row click):
- Full task-by-task breakdown with AI evaluation notes and supporting evidence per score
- Capability Score history, if the candidate has prior Gainday activity
- Contact information blurred until unlocked

### 4.8 Deadline Expiry
If the Application Deadline passes and no candidate has been hired, the job **auto-closes**. (Exact post-expiry state — archived vs. reopenable — is an open decision; see Section 8.)

### 4.9 Unlocking Candidate Contact Details
- Employer selects one or more candidates (individually or as a top-X shortlist) from the Submissions View or the dashboard's candidate-browsing section.
- Running summary shows number selected and total cost.
- **Pricing model:** fixed price per candidate × number of candidates selected. No percentage-based fee. No bundle discount tiers in the agreed model (note: an earlier draft proposed bundle/cart-style upsell pricing — this was **not** adopted; flat linear pricing is the agreed model).
- On confirmation, full contact details (name, email, phone, any other application-provided details) are revealed. Employer contacts candidates directly, outside the platform.

**Launch caveat (critical implementation note):** This entire pricing flow — candidate selection, running total, checkout — must be fully built into the schema and UI now. **However, payment is not actually charged at launch.** Early users unlock candidates for free. The UI must behave identically to the priced version (so nothing looks "free" by omission) so that enabling real charging later is a config/flag change, not a rebuild. The mechanism to toggle this on is an Admin-side concern in principle, though full monetization control is out of scope for the Admin panel in this build (see Section 6) — the toggle may need to be a backend config value rather than an admin UI control for V1.

### 4.10 Accepting a Candidate & Closing the Role
- Employer selects one candidate, clicks Accept.
- Confirmation prompt: "Are you sure you want to mark [Candidate] as hired for [Job Title]? This will close the role."
- On confirmation:
  - Job marked **Filled**, removed from public board
  - Accepted candidate receives email: "Congratulations — you have been selected by [Company Name] for [Job Title]. They will be in touch shortly."
  - All other candidates receive email: "Thank you for applying to [Job Title] at [Company Name]. The role has been filled. Keep your Capability Score active for future opportunities."
  - Dashboard shows role as Closed

### 4.11 Employer Account / Settings
Basic screen required: edit company/contact details, change password, notification preferences. (Not present in original spec drafts — confirmed gap, must be built.)

---

## 5. THE AI ENGINE — HOW IT WORKS

### 5.1 Simulation Generation
- Input: job description, required skills, role category, and the employer's stated business problem.
- Output: a connected sequence of role-specific tasks (not isolated questions), calibrated to the role.
- At least one task must be derived directly from the employer's stated business problem.
- Must support **regeneration** on employer request (full re-generation, not incremental patch).
- Employer can edit generated task text before publish.

### 5.2 Scoring Framework
**This is the single authoritative scoring framework.** Earlier drafts of this project produced three competing frameworks (differing categories and weights); this version supersedes all of them.

Every submission is scored across five categories, so results are comparable across jobs and can roll up cleanly into the Capability Score:

| Category | Weight | Grading mechanism |
|---|---|---|
| Problem Solving & Judgement | 30% | LLM-as-judge against a rubric: did they identify the real issue and propose sensible action |
| Execution | 20% | Completeness/instruction-following check (did they answer the task, follow constraints like word limits) |
| Written Communication | 20% | LLM-graded clarity and structure of written responses |
| Commercial/Domain Awareness | 20% | LLM-graded against rubric for correct trade-off/stakeholder/business reasoning |
| Prioritization Accuracy | 10%* | Compared against an expert-defined ideal ranking, where a ranking/drag-drop task exists in the simulation |

*If a given simulation has no ranking task, this 10% redistributes into Problem Solving & Judgement (bringing it to 40% for that simulation only).

**Time taken to complete** is captured and shown to the employer as metadata/context. It is explicitly **not** part of the weighted score — speed is not treated as a quality signal.

Each category returns a score (0–100) with a short rationale and supporting evidence (e.g. "Identified the root cause before proposing solutions and considered operational constraints" rather than a bare number). A composite Overall Score is the weighted average across categories. All submissions for a job are scored **in a single batch** after the submission window/deadline closes — not scored one-by-one as they arrive.

### 5.3 Explicitly Excluded Scoring Concepts (and why)
These were proposed at various points and are **deliberately not included**, given current medium (text-based responses, structured inputs, optional voice-to-text) and current AI grading capability:

- **Innovation/uniqueness of answer** — not computable in isolation; would require comparing against a pool of other candidates' answers, which doesn't exist for the first submission, and "different" is not validated as "better."
- **Speed as a quality metric** — captured as metadata only, not scored (see 5.2).
- **Confidence** (as a behavioral trait) — requires vocal/delivery/prosody analysis; not extractable from a text transcript.
- **Initiative, Adaptability, Risk Awareness (behavioral profiling)** — inferring stable personality traits from a single ~20–30 minute writing sample is both a technical stretch (no validated mechanism from text alone) and a validity/liability concern for a hiring product. Not included without proper psychometric validation, which is out of scope.
- **Analytical Thinking as a separate category from Problem Solving** — redundant in a text-based medium; folded into Problem Solving & Judgement rather than double-counted.

### 5.4 Capability Score
- A persistent, portable score belonging to the job seeker across **all** activity on Gainday, not just one job.
- Updated with each new completed simulation, using the same 5 categories as Section 5.2.
- Rolling weighted average, broken down by domain (e.g. Finance, Sales) — each domain has its own sub-score.
- Valid for **18 months** from date of completion. After 18 months, a score is marked expired and excluded from employer-facing views, but **remains visible on the candidate's own dashboard**.
- Percentile context shown where possible (e.g. "Your Finance score places you in the top 22% of all Finance candidates on Gainday").
- The Capability Score is **not a separately-scored construct** — it is an aggregate of consistent per-assessment scores over time. This is why category consistency across all simulations (Section 5.2) matters: without it, there is nothing valid to roll up.

---

## 6. JOB SEEKER FLOW — FULL SPECIFICATION

### 6.1 Job Board (Public)
- No account required to browse.
- Cards show: job title, company name, location, employment type, salary range, role category, date posted, "Apply Now" button.
- Search bar + filters (role, location, salary, employment type).

### 6.2 Job Detail Page
- Full job description, required skills, and the employer's stated problem shown transparently as: "What this hire needs to solve:" (intentional — signals authenticity/transparency to the candidate).
- Prominent Apply Now button.

### 6.3 Authentication Prompt (Optional)
- If logged in: proceeds directly to Pre-Simulation screen.
- If not logged in: can apply as a guest by entering contact info directly, with an encouragement message: "Creating an account takes 30 seconds and lets you track your Capability Score, see your results history, and apply faster next time. Want to sign up first?"

### 6.4 Pre-Simulation Screen (Anti-Cheat & Setup)
- Informs candidate the simulation is monitored: microphone access requested, full-screen lock for duration, tab-switching/focus loss triggers a warning (second violation ends the session and is logged as a flag), and **idle-time tracking** is used to flag suspicious inactivity/cheating patterns.
- **Webcam is explicitly not required** — client direction confirmed webcam monitoring is unnecessary; idle-time tracking plus tab-switch/full-screen detection is the agreed anti-cheat mechanism instead.
- Reminds candidate dishonest behavior disqualifies them.
- Requests browser permissions (microphone required); full screen triggers automatically on "Begin."
- Shows logistics: number/type of tasks, 30-minute time allowance, submission deadline.

**Technical note (must be implemented exactly as stated — this is a stated product/trust commitment, not just a UI note):** the system does **not** record or store audio footage. Mic access exists only to create a monitored environment and deter dishonest behavior — not for surveillance recording. Full-screen lock, tab-switch detection, and idle-time tracking are enforced via browser APIs only.

Candidate clicks Begin Simulation.

### 6.5 The Work Simulation
- Candidate is placed into a realistic scenario for the role, working through a connected sequence of tasks under a single 30-minute timer, with a persistent progress indicator.
- Example task types (see Section 5.1 for generation source):
  - **Triage & prioritize** — rank incoming messages/requests (drag-and-drop), then briefly justify the ranking
  - **Interpret & summarize** — read a data set/dashboard, write a concise brief for a senior stakeholder under a word limit
  - **Trade-off decision** — choose between competing priorities under a real constraint (e.g. budget), justify the choice
  - **Stakeholder response** — respond in writing to a challenging stakeholder question/pushback
- At least one task is built directly around the employer's stated business problem (not explicitly labeled as such to the candidate).
- **Auto-submit on timeout:** if the 30-minute timer expires, whatever has been completed is automatically submitted.
- **Session resume on connection drop:** if a candidate's connection drops mid-simulation, they can resume the same session (same timer, does not reset) until the timer expires. This does **not** count as a cheating violation.
- On completion, candidate clicks Submit Simulation.

### 6.6 Post-Submission Confirmation
- Confirmation message: "Your work simulation has been submitted. Results are currently being reviewed."
- If guest: prompt to sign up to receive results and track Capability Score.
- If logged in: informed they'll receive a results summary by email once all submissions are reviewed.

### 6.7 Candidate Results Notification
Sent once the employer's submission window closes and batch scoring runs. Email contains:
- Overall score
- Category breakdown (5 categories, Section 5.2)
- AI-generated summary of response quality, with strengths and areas to improve
- Updated Capability Score
- Prompt to sign up/log in for full breakdown on dashboard

### 6.8 Disqualification Notice
If a candidate was flagged and disqualified for an anti-cheat violation, they see a clear notice of disqualification. **No score is shown** in this case. (This is the candidate-facing counterpart to the Admin flag-review queue in Section 7 — an admin can uphold or overturn this disqualification.)

### 6.9 Candidate Dashboard (Registered Users Only)
Shows:
- **Capability Score** — composite score across all simulations completed on Gainday, not just one job
- **Score Breakdown by Category** — per-domain sub-scores (e.g. Finance: 78, Sales: 65)
- **My Applications** — list of jobs applied to, with status per job (pending / reviewed / not selected / hired) and a **withdraw application** action
- **Simulation & Application History**
- **Improvement Suggestions** — AI-generated feedback drawn from most recent responses

### 6.10 Job Seeker Account / Settings
Required, currently a confirmed gap in prior drafts: password reset, edit profile details, basic account management, and (at minimum, even if built later) account deletion / data export given personal data is being handled.

---

## 7. ADMIN PANEL — LEAN SCOPE

**Ownership model:** Frontend builds the entire Admin panel solo, with no UI/UX design involvement, to protect timeline. Backend integrates as with any other feature.

### 7.1 In Scope
- **Admin login** — separate role-based auth, distinct from employer/job seeker accounts
- **Dashboard** — totals for: active jobs, active users, submissions this week, jobs filled vs. open
- **User management** — search, view, edit, suspend, or delete employer and job seeker accounts; view a user's full activity history
- **Content moderation** — remove inappropriate job posts; review queue for anti-cheat-flagged submissions, with the ability to **uphold or overturn** a disqualification
- **AI engine oversight** — view any generated simulation (for debugging/QC); manually regenerate or override a simulation; view submissions the scoring engine failed to score

### 7.2 Explicitly Out of Scope for This Build
- Support/ticketing tooling
- Analytics (conversion rates, time-to-fill, drop-off metrics)
- Monetization control (pricing toggle UI — see 4.9 launch caveat; this may need to be a backend config value instead)
- Capability Score administration (manual override/audit log for score disputes)

These are explicitly deferred, not forgotten — worth revisiting post-launch.

---

## 8. OPEN / UNCLARIFIED DECISIONS

These are known gaps that have been surfaced but not yet resolved with the client. Flagging them here so they aren't silently assumed one way during implementation:

1. **Post-deadline-expiry state** — when a job auto-closes on deadline with no hire made, does it become permanently archived, or can the employer reopen/extend it?
2. **Editing a published job** — currently locked entirely once published. Is there any employer need to make minor edits (e.g. fixing a typo in the job description) without a full republish? Not yet raised with the client.
3. **Multi-hire postings** — confirmed out of scope for V1, but worth flagging as a likely V2 request given the persona (some employers will want to hire more than one analyst from a single posting).
4. **Monetization toggle ownership** — since Admin monetization control is out of scope, how/where does the eventual "turn on real pricing" switch get flipped? Currently assumed to be a backend config flag, not an admin UI control, for V1.
5. **Anti-cheat flag review outcome** — when an Admin overturns a disqualification, does the candidate's submission re-enter scoring automatically, or does it require a manual backend action to reinstate it?
6. **Role Category expansion** — Finance is the only vertical actively supported/tested at launch, but the field and AI engine are meant to generalize. No decision yet on when/how Sales or other verticals get activated.
7. **Guest applicant data retention** — if a guest applies without an account and never signs up, how long is their data retained, and can they be later matched to an account if they sign up afterward?

---

## 9. SUPERSEDED / REJECTED APPROACHES (for context, not implementation)

Recorded so the team doesn't reintroduce approaches that were considered and dropped during scoping:

- **Percentage-based unlock fee** (tied to job salary) — replaced by flat fixed-price-per-candidate model (Section 4.9).
- **Bundle/cart-style unlock pricing** (e.g. "unlock 5 for £149, save £96") — proposed at one point, not adopted. Current model is flat linear pricing only.
- **MCQ + separate open-ended question format** — replaced entirely by the connected work-simulation format (Section 6.5).
- **Behavioral Profile (AI-inferred personality traits)** — proposed, explicitly rejected for this build (Section 5.3).
- **"Innovation/uniqueness of answer" as a scored dimension** — proposed, explicitly rejected (Section 5.3).
- **Webcam requirement for anti-cheat** — dropped in favor of idle-time tracking + mic + tab-switch/full-screen detection (Section 6.4 reflects the final decision).
