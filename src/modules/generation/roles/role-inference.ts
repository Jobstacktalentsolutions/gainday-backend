import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RoleCategory } from './role-category.enum';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';

/**
 * The one place a job's role is inferred. The extraction step and the job description parser both use
 * these instructions, so the two cannot disagree. Routing is not decided by keywords here: the model
 * reads the posting, and code only checks the shape of the answer.
 */

export const roleInferenceSchema = z.object({
  role: z
    .string()
    .describe('The role as "Top > Sub-role", e.g. "Finance > Private Equity" or "Logistics > Fleet Operations".'),
  rationale: z
    .string()
    .describe('One sentence: the work the posting describes (responsibilities, tools, outputs) that decided the role.'),
});

export type RoleInference = z.infer<typeof roleInferenceSchema>;

export function roleInferenceInstructions(): string {
  const supported = Object.values(RoleCategory).join(', ');
  return `Decide the job's role from the work it describes: the responsibilities, the tools, the skills and
the outputs. Do not decide from the job title or from a single word in the posting. A title such as
"Customer Success Manager" can describe support work or sales work, and only the described work tells them
apart.

Supported top-level roles: ${supported}. Use one of these when the work fits it. If the work fits none of
them, name its domain in the posting's own terms (2-4 words). Add the sub-role after " > " when the work
makes a specific one clear, e.g. "Finance > Private Equity". Do not force the work into a role it does not
fit, and do not favour any role.`;
}

export interface InferRoleInput {
  jobDescription: string;
  requiredSkills: string[];
  /** The role the employer chose on the form, if any. Its top level is kept; see resolveCategory. */
  chosenRole: string | null;
}

/** Asks the model for the job's role and returns it with the rationale for the logs. */
export async function inferRole(model: BaseChatModel, input: InferRoleInput): Promise<RoleInference> {
  const structured = withGeminiSafeStructuredOutput(model, roleInferenceSchema);
  return structured.invoke([
    new SystemMessage(roleInferenceInstructions()),
    new HumanMessage(JSON.stringify(input)),
  ]);
}
