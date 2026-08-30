import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import {
  categoryExtractionSchema,
  intentProblemExtractionSchema,
} from '../schemas/extraction.schema';

const CATEGORY_EXTRACTION_PROMPT = `You are extracting the job Category from a recruiter's job
posting input. Category is the domain and sub-domain of the role (e.g. "Finance > Reconciliation",
or "Sales"). Must be one of these top-level domains where possible: Finance, Sales. If a sub-domain
is evident from the description, include it after " > ".`;

export function extractionNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const categoryModel = ctx.generationModel.withStructuredOutput<
      z.infer<typeof categoryExtractionSchema>
    >(categoryExtractionSchema);
    const categoryResult = await categoryModel.invoke([
      new SystemMessage(CATEGORY_EXTRACTION_PROMPT),
      new HumanMessage(
        JSON.stringify({
          jobDescription: state.jobDescription,
          requiredSkills: state.requiredSkills,
        }),
      ),
    ]);

    const roleModule = ctx.roleRegistry.resolve(categoryResult.category);

    const intentProblemPrompt = `You are extracting Intent and Problem from a recruiter's job
posting input, for a role in the category "${categoryResult.category}".

${roleModule.extraction.intentFramingGuidance}
${roleModule.extraction.expectedTaskGuidance}

Intent is always required: the skills and competencies the employer expects the hire to
demonstrate. Problem is the specific business problem the employer describes wanting this hire
to help solve — extract it ONLY if it is actually stated in the input. If no business problem is
stated, return null for problem. Never invent or infer a problem that is not present.`;

    const intentProblemModel = ctx.generationModel.withStructuredOutput<
      z.infer<typeof intentProblemExtractionSchema>
    >(intentProblemExtractionSchema);
    const intentProblemResult = await intentProblemModel.invoke([
      new SystemMessage(intentProblemPrompt),
      new HumanMessage(
        JSON.stringify({
          jobDescription: state.jobDescription,
          requiredSkills: state.requiredSkills,
          businessProblemRaw: state.businessProblemRaw ?? null,
        }),
      ),
    ]);

    return {
      category: categoryResult.category,
      roleModule,
      intent: intentProblemResult.intent,
      problem: intentProblemResult.problem,
    };
  };
}
