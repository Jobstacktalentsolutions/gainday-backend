  # Executive Model & Pricing Guide — Google Gemini vs. Groq
  
  This guide provides a non-technical breakdown of the AI models powering Gainday's generation and grading pipelines. It details model selection based on task complexity, explains pricing in plain English, and demonstrates how far **$1.00 USD** goes in real-world production.
  
  ---
  
  ## 1. The Dynamic Model Strategy
  
  Rather than using one expensive model for everything, Gainday toggles between **Light Tier** and **Heavy Tier** models depending on the difficulty of the step.
  
  ```mermaid
  flowchart TD
      subgraph LIGHT_TIER["Light Tier (Fast & Low Cost)"]
          A["Category & Intent Extraction"]
          B["Candidate Pool Overgeneration"]
      end
  
      subgraph HEAVY_TIER["Heavy Tier (Deep JSON & Grading)"]
          C["Full Task Scenario Generation"]
          D["Benchmark Anchor Creation"]
          E["Candidate Response Grading"]
      end
  
      LIGHT_TIER -->|"Gemini 3.5 Flash-Lite OR Groq 20b"| F["Fast, Low-Cost Input Processing"]
      HEAVY_TIER -->|"Gemini 3.5 Flash OR Groq 120b"| G["Strict JSON & Deep Reasoning"]
  ```
  
  ---
  
  ## 2. Model Tiering Matrix
  
  | Complexity Level | Task Types | Google Model Option | Groq Model Option | Why This Choice? |
  | :--- | :--- | :--- | :--- | :--- |
  | **Light Tier** *(Simple)* | Extracting domain, intent, skills, and brainstorming pool items | **Gemini 3.5 Flash-Lite** | **Groq `gpt-oss-20b`** | High speed and low cost for straightforward text processing. |
  | **Heavy Tier** *(Complex)* | Writing scenarios, creating 5 scoring anchors, grading candidate answers | **Gemini 3.5 Flash** | **Groq `gpt-oss-120b`** | Strict JSON schema adherence, no broken formatting, high accuracy. |
  
  ---
  
  ## 3. Plain English Pricing Breakdown
  
  > **What is a "Token"?**
  > - **1 Token** ≈ ¾ of a word (or 4 characters).
  > - **1 Million Tokens** ≈ 750,000 words (roughly 15 full novels or 50 complete job postings with candidate submissions).
  
  > **Verified 2026-10-07** against official provider pricing (ai.google.dev/gemini-api/docs/pricing, groq.com). The previous version of this table used stale rates from an older Gemini generation (1.5/2.0-era) that no longer apply to the models actually configured in `ai.config.ts` (`gemini-3.5-flash-lite` / `gemini-3.5-flash`). Groq's rates were already accurate and are unchanged below.

  ### Provider Rate Card (per 1 Million Tokens)
  
  | Model Tier | Provider & Model | Reading (Input) | Writing (Output) | Cached Reading |
  | :--- | :--- | :--- | :--- | :--- |
  | **Light** | **Google Gemini 3.5 Flash-Lite** | $0.30 | $2.50 | $0.03 *(90% discount)* |
  | **Light** | **Groq `gpt-oss-20b`** | $0.075 | $0.30 | $0.0375 *(50% discount)* |
  | **Heavy** | **Google Gemini 3.5 Flash** | $1.50 | $9.00 | $0.15 *(90% discount)* |
  | **Heavy** | **Groq `gpt-oss-120b`** | $0.15 | $0.60 | $0.075 *(50% discount)* |

  On raw per-token price, Gemini 3.5 is now **~4x more expensive than Groq on the light tier** and **~10x more expensive on the heavy tier** — a much bigger gap than the near-parity this doc previously claimed.

  ---
  
  ## 4. What Does 1 Million Tokens Give You?
  
  A single **"Complete Unit"** consists of:
  1. **1 Full Job Posting Created** (4 customized work simulation tasks).
  2. **1 Candidate Submission Graded** (including 5 scoring benchmarks generated for each task).
  
  ```
  1 Complete Unit = ~50,000 Input Tokens + ~19,000 Output Tokens
  ```
  
  > **Note:** the figures below assume a Complete Unit's tokens split roughly **30% light-tier / 70% heavy-tier** by volume — back-solved from this doc's own numbers, not measured against production logs. If you want exact figures, pull the real light/heavy token split from usage logs.

  With **1 Million Tokens** on the Groq hybrid, you can process approximately:
  - **15 to 20 Complete Job Generation + Candidate Grading Packages**, OR
  - **Over 50 Candidate Gradings** (if reusing existing job benchmarks).

  On the Gemini 3.5 hybrid, the same 1 Million Tokens now gets you roughly **5 Complete Job Generation + Candidate Grading Packages** — about 3-4x fewer than Groq, reflecting Gemini 3.5's higher per-token price.
  
  ---
  
  ## 5. Simple Math: What Does $1.00 USD Buy?
  
  > Groq remains remarkably affordable. Gemini 3.5 is still usable at this volume, but no longer close to Groq on cost — see below.
  
  ```mermaid
  graph LR
      ONE_DOLLAR["$1.00 USD Budget"] --> GOOGLE["Google (Gemini 3.5 Hybrid)"]
      ONE_DOLLAR --> GROQ["Groq (GPT-OSS Hybrid)"]
  
      GOOGLE --> G_JOBS["~5 Complete Jobs + Candidates Graded"]
      GOOGLE --> G_GRADES["OR ~14 Candidate Submissions Graded"]
  
      GROQ --> Q_JOBS["~52–60 Complete Jobs + Candidates Graded"]
      GROQ --> Q_GRADES["OR ~210–250 Candidate Submissions Graded"]
  ```
  
  ### Dollar-for-Dollar Comparison
  
  | Provider Route | Cost per Complete Job + Candidate | What $1.00 USD Buys You |
  | :--- | :--- | :--- |
  | **Google Hybrid** *(3.5 Flash-Lite + 3.5 Flash)* | **~$0.19** *(19 cents)* | **~5 Complete Jobs + Candidates Graded** |
  | **Groq Hybrid** *(20b + 120b)* | **$0.017 – $0.019** *(1.7 – 1.9 cents)* | **~52 – 60 Complete Jobs + Candidates Graded** |

  Groq is now roughly **10x cheaper per job** than the Gemini 3.5 hybrid, driven mostly by `gemini-3.5-flash`'s heavy-tier price ($1.50/$9.00 vs. Groq's $0.15/$0.60).
  
  ---
  
  ## 6. Real-World Testing & Decision Guide
  
  > **Key Distinctions for Real-World Testing:**
  > 1. **Groq Prompt Caching:** Groq **does support automatic prompt caching specifically for the GPT-OSS family** (`gpt-oss-120b` & `gpt-oss-20b`), giving a **50% input discount** ($0.075/1M on 120b) and exempting cached tokens from rate limits.
  > 2. **Groq Speed:** Groq generates output tokens at ~300+ tokens/second (3x faster than Google), offering near-instant user responses.
  > 3. **Google Prompt Caching:** Gemini 3.5 Flash offers a **90% input discount** ($0.15/1M on Flash, $0.03/1M on Flash-Lite) on cached prompts stored up to 1 hour — but the uncached base price is now far higher than Groq's, so caching narrows the gap without closing it.
  
  ### Recommendation
  - **Use Groq (`gpt-oss-120b` / `gpt-oss-20b`)** if cost per job is the deciding factor — it's ~10x cheaper than the Gemini 3.5 hybrid at current rates, and still gives the strict-JSON reliability the heavy tier needs.
  - **Use Google Gemini 3.5 Flash / Flash-Lite** only if you specifically need Gemini-side features (e.g. the embedding model, which stays on Gemini regardless of this choice) or already rely heavily on its prompt caching and rate-limit behavior — not for raw cost efficiency, which has flipped decisively toward Groq since this doc was last accurate.
