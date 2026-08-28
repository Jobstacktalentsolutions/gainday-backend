# Gainday Backend

Gainday replaces traditional, CV-first hiring with role-specific, AI-generated work simulations. Instead of reviewing keyword-matched CVs, employers receive a ranked shortlist of candidates proven through realistic on-the-job scenarios. Candidates receive fair, skill-based evaluations, detailed feedback, and a portable Capability Score.

This repository hosts the **NestJS backend engine** for the Gainday platform.

---

## 🚀 Key Features & Flow Support

### 1. Employer Workspace
*   **Job Posting**: Multi-step flow capturing core details, required skills, and the specific business problem the hire needs to solve.
*   **Simulation Builder**: AI-generated work simulations dynamically constructed from the job description and stated business problem. Supports task editing and full regeneration.
*   **Submissions Ranking**: Candidates are ranked by overall score. Supports deep-dive reviews of step-by-step performance.
*   **Candidate Unlocks**: Secure unlock flow for accessing contact details using flat-rate linear pricing (e.g., fixed fee per candidate). Supports a free-tier launch configuration toggle.

### 2. Candidate (Job Seeker) Experience
*   **Job Board**: Public board to search, filter, and view open positions.
*   **Monitored Simulation Workspace**: Scenario-based tasks completed under a unified 30-minute timer. Includes connection drops auto-resume.
*   **Browser-Based Anti-Cheat**: Tab-switching detection, full-screen exit tracking, and idle-time analysis.
*   **Feedback & Scoring**: Detailed feedback reports outlining strengths and areas for improvement along with portable rolling Capability Scores.

### 3. AI Engine & Grading Framework
Every submission is graded across five core categories to compute a composite score (0-100):
*   **Problem Solving & Judgement** (30% - *increases to 40% if no prioritization task exists*)
*   **Execution & Instruction Following** (20%)
*   **Written Communication** (20%)
*   **Commercial/Domain Awareness** (20%)
*   **Prioritization Accuracy** (10%)

### 4. Admin Portal
*   Platform metrics dashboard.
*   User account moderation (suspend/activate).
*   Flag review queue to **uphold** or **overturn** candidate disqualifications.
*   AI generation oversight and manual overrides.

---

## 🛠️ Architecture & Tech Stack

*   **Framework**: [NestJS](https://nestjs.com/) (v11)
*   **Database**: PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/)
*   **Task Queues & Async Processing**: [BullMQ](https://docs.bullmq.io/) backed by Redis
*   **Package Manager**: `pnpm` (v10)

---

## 📁 Folder Structure

The project code is organized cleanly inside `src/` to support feature modularity:

```
src/
├── config/                  # Configuration schemas and dynamic env parsing
├── db/                      # Drizzle schema, client, and migration runner
└── modules/
    ├── auth/                # Session and role-based registration/login
    ├── users/               # Candidate/Employer profiles & capability scores
    ├── jobs/                # Jobs CRUD, publication, and auto-expiry logic
    ├── simulations/         # Simulation task generation and updates
    ├── submissions/         # Answer capture, resume sessions, and unlock states
    ├── scoring/             # Category scoring calculation & background BullMQ batch scoring processor
    ├── payments/            # Candidate unlock quote calculations and checkouts
    ├── admin/               # Administrative stats, account locks, and flag reviews
    └── notifications/       # Mail services and batch alerts dispatch
```

---

## ⚙️ Project Setup

### Prerequisites
*   Node.js (v24+)
*   pnpm (v10+)
*   PostgreSQL
*   Redis (for queues)

### 1. Installation
```bash
pnpm install
```

### 2. Environment Configuration
Create a `.env` file in the root of the project:
```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db>
REDIS_URL=redis://<user>:<password>@<host>:<port>
JWT_SECRET=super-secret-jwt-key
JWT_EXPIRES_IN=7d
FREE_TIER_LAUNCH_ACTIVE=true
```

### 3. Run the Application
```bash
# development mode
pnpm start:dev

# production build & start
pnpm build
pnpm start:prod
```

### 4. Running Tests
```bash
# unit tests
pnpm test

# e2e tests
pnpm test:e2e
```

### 5. Database Migrations (Drizzle)
Schema changes are made in `src/db/schema/*.ts`, then a migration is generated and applied — never edit generated SQL files or the database by hand.

```bash
# generate a new SQL migration from schema changes
pnpm db:generate

# apply pending migrations
pnpm db:migrate

# browse the database with Drizzle Studio
pnpm db:studio
```
