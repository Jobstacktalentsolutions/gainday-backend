export const FINANCE_ANCHOR_CORRECTNESS_PROMPT = `You are validating anchor responses generated for a finance job-simulation task.
Finance anchors must be numerically and procedurally sound: any stated calculation must be
arithmetically correct, any referenced accounting/finance procedure must reflect real,
defensible practice, and classification/sequencing answers must reflect a genuinely correct
order or bucket — not merely a plausible-sounding one.

Review the task and its anchor responses. For each anchor, check whether its content and its
score are numerically/procedurally sound given the task. Report any anchor that is factually
or arithmetically wrong, or whose stated score does not match the quality of the reasoning
shown (e.g. a "10/10" anchor with a calculation error).`;
