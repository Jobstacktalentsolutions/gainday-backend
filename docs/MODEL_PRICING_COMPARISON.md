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
  
      LIGHT_TIER -->|"Gemini Flash-Lite OR Groq 20b"| F["Fast, Low-Cost Input Processing"]
      HEAVY_TIER -->|"Gemini Flash OR Groq 120b"| G["Strict JSON & Deep Reasoning"]
  ```
  
  ---
  
  ## 2. Model Tiering Matrix
  
  | Complexity Level | Task Types | Google Model Option | Groq Model Option | Why This Choice? |
  | :--- | :--- | :--- | :--- | :--- |
  | **Light Tier** *(Simple)* | Extracting domain, intent, skills, and brainstorming pool items | **Gemini Flash-Lite** | **Groq `gpt-oss-20b`** | High speed and low cost for straightforward text processing. |
  | **Heavy Tier** *(Complex)* | Writing scenarios, creating 5 scoring anchors, grading candidate answers | **Gemini Flash (3.5/3.8)** | **Groq `gpt-oss-120b`** | Strict JSON schema adherence, no broken formatting, high accuracy. |
  
  ---
  
  ## 3. Plain English Pricing Breakdown
  
  > **What is a "Token"?**
  > - **1 Token** ≈ ¾ of a word (or 4 characters).
  > - **1 Million Tokens** ≈ 750,000 words (roughly 15 full novels or 50 complete job postings with candidate submissions).
  
  ### Provider Rate Card (per 1 Million Tokens)
  
  | Model Tier | Provider & Model | Reading (Input) | Writing (Output) | Cached Reading |
  | :--- | :--- | :--- | :--- | :--- |
  | **Light** | **Google Gemini Flash-Lite** | $0.10 | $0.40 | $0.01 *(90% discount)* |
  | **Light** | **Groq `gpt-oss-20b`** | $0.075 | $0.30 | $0.0375 *(50% discount)* |
  | **Heavy** | **Google Gemini Flash** | $0.15 | $0.60 | $0.015 *(90% discount)* |
  | **Heavy** | **Groq `gpt-oss-120b`** | $0.15 | $0.60 | $0.075 *(50% discount)* |
  
  ---
  
  ## 4. What Does 1 Million Tokens Give You?
  
  A single **"Complete Unit"** consists of:
  1. **1 Full Job Posting Created** (4 customized work simulation tasks).
  2. **1 Candidate Submission Graded** (including 5 scoring benchmarks generated for each task).
  
  ```
  1 Complete Unit = ~50,000 Input Tokens + ~19,000 Output Tokens
  ```
  
  With **1 Million Tokens**, you can process approximately:
  - **15 to 20 Complete Job Generation + Candidate Grading Packages**, OR
  - **Over 50 Candidate Gradings** (if reusing existing job benchmarks).
  
  ---
  
  ## 5. Simple Math: What Does $1.00 USD Buy?
  
  > Both Google and Groq offer remarkably affordable pricing. $1.00 USD provides substantial processing volume on both platforms.
  
  ```mermaid
  graph LR
      ONE_DOLLAR["$1.00 USD Budget"] --> GOOGLE["Google (Gemini Hybrid)"]
      ONE_DOLLAR --> GROQ["Groq (GPT-OSS Hybrid)"]
  
      GOOGLE --> G_JOBS["~58 Complete Jobs + Candidates Graded"]
      GOOGLE --> G_GRADES["OR ~230 Candidate Submissions Graded"]
  
      GROQ --> Q_JOBS["~52–60 Complete Jobs + Candidates Graded"]
      GROQ --> Q_GRADES["OR ~210–250 Candidate Submissions Graded"]
  ```
  
  ### Dollar-for-Dollar Comparison
  
  | Provider Route | Cost per Complete Job + Candidate | What $1.00 USD Buys You |
  | :--- | :--- | :--- |
  | **Google Hybrid** *(Flash-Lite + Flash)* | **$0.017** *(1.7 cents)* | **~58 Complete Jobs + Candidates Graded** |
  | **Groq Hybrid** *(20b + 120b)* | **$0.017 – $0.019** *(1.7 – 1.9 cents)* | **~52 – 60 Complete Jobs + Candidates Graded** |
  
  ---
  
  ## 6. Real-World Testing & Decision Guide
  
  > **Key Distinctions for Real-World Testing:**
  > 1. **Groq Prompt Caching:** Groq **does support automatic prompt caching specifically for the GPT-OSS family** (`gpt-oss-120b` & `gpt-oss-20b`), giving a **50% input discount** ($0.075/1M on 120b) and exempting cached tokens from rate limits.
  > 2. **Groq Speed:** Groq generates output tokens at ~300+ tokens/second (3x faster than Google), offering near-instant user responses.
  > 3. **Google Prompt Caching:** Google's Gemini Flash offers a higher **90% input discount** ($0.015/1M) on cached prompts stored up to 1 hour.
  
  ### Recommendation
  - **Use Google Gemini Flash / Flash-Lite** if you want seamless rate limits, prompt caching, and maximum cost efficiency per dollar.
  - **Use Groq (`gpt-oss-120b`)** if your highest priority is sub-second generation speed and interactive UX responsiveness.
