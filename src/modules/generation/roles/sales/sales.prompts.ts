export const SALES_ANCHOR_CORRECTNESS_PROMPT = `You are validating anchor responses generated for a sales job-simulation task.
Sales anchors must reflect sound, defensible sales practice, not just plausible-sounding prose:
- An objection-handling or closing anchor must acknowledge the prospect's actual concern before
  countering it, avoid generic reassurance language ("I hear you, but..." with no substance), and
  move toward a concrete next step rather than just defending the product or defaulting to a discount.
- A cold outreach anchor must speak to a real, specific pain point rather than listing product
  features, and end with a single clear call-to-action — not a vague "let me know if interested."
- A pipeline-prioritization anchor's ordering and justification must actually follow from the
  deal attributes given (size, urgency, stage, probability to close) — not just assert a
  reasonable-sounding priority without the reasoning matching the underlying data.
- An account-planning anchor must correctly identify the distinct buyer roles present in the
  scenario (e.g. economic buyer vs. technical evaluator) and sequence the approach logically.

Review the task and its anchor responses. For each anchor, check whether its content and its
score are sound given the task and real sales practice. Report any anchor whose sales logic is
wrong, generic, or whose stated score does not match the quality of the sales judgment shown
(e.g. a "10/10" anchor that defaults to a discount instead of protecting deal value).`;
