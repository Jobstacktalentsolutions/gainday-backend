import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { intentProblemExtractionSchema } from '../schemas/extraction.schema';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import { resolveCategory } from '../roles/category-routing';
import { inferRole } from '../roles/role-inference';

const logger = new Logger('GenerationPipeline:extraction');

export function extractionNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    logger.log(`Starting extraction for job ${state.jobId}`);

    // The role is inferred from the posting by the shared classifier (see role-inference.ts). The
    // employer's chosen top level is kept by resolveCategory; the inferred sub-role refines it.
    const inferred = await inferRole(ctx.generationModel, {
      jobDescription: state.jobDescription,
      requiredSkills: state.requiredSkills,
      chosenRole: state.declaredRole ?? null,
    });
    const category = resolveCategory(state.declaredRole, inferred.role);
    logger.log(`Category extracted: "${category}" — ${inferred.rationale}`);

    const roleModule = ctx.roleRegistry.resolve(category);
    logger.log(
      `Resolved role module for "${category}" (${roleModule.allowedTaskPatternTypes.length} allowed task pattern types)`,
    );

    const intentProblemPrompt = `You are extracting Intent and Problem from a recruiter's job
posting input, for a role in the category "${category}".

${roleModule.extraction.intentFramingGuidance}
${roleModule.extraction.expectedTaskGuidance}

Intent is always required: the skills and competencies the employer expects the hire to
demonstrate. Problem is the specific business problem the employer describes wanting this hire
to help solve — extract it ONLY if it is actually stated in the input. If no business problem is
stated, return null for problem. Never invent or infer a problem that is not present.`;

    const intentProblemModel = withGeminiSafeStructuredOutput(
      ctx.generationModel,
      intentProblemExtractionSchema,
    );
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
    logger.log(
      `Intent/problem extracted: intent="${intentProblemResult.intent}", problem=${intentProblemResult.problem ? `"${intentProblemResult.problem}"` : 'null'}`,
    );

    return {
      category: category,
      roleModule,
      intent: intentProblemResult.intent,
      problem: intentProblemResult.problem,
    };
  };
}
