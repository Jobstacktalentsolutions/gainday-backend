/**
 * Checks role inference against the labelled postings. Calls the same inferRole the pipeline uses, with
 * the chat model the app builds, and reports each posting's result. Sends the postings to the model, so it
 * needs the API key for the configured provider. It writes nothing to the database.
 *
 * Run with: pnpm roles:evaluate
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { ConfigService } from '@nestjs/config';
import { aiConfig } from '../../../../config/ai.config';
import { buildChatModel } from '../../../ai/ai.module';
import { inferRole } from '../role-inference';
import { ROLE_FIXTURES } from './role-fixtures';
import { isCorrect } from './scoring';

async function main(): Promise<void> {
  const config = new ConfigService({
    ai: {
      ...aiConfig,
      gemini: { ...aiConfig.gemini, apiKey: process.env.GEMINI_API_KEY },
      groq: { ...aiConfig.groq, apiKey: process.env.GROQ_API_KEY },
      fireworks: { ...aiConfig.fireworks, apiKey: process.env.FIREWORKS_API_KEY },
    },
  });
  const model = buildChatModel(config, 'generationModel', 'ai.generationTemperature');

  let correct = 0;
  for (const fixture of ROLE_FIXTURES) {
    const result = await inferRole(model, {
      jobDescription: fixture.jobDescription,
      requiredSkills: fixture.requiredSkills,
      chosenRole: null,
    });
    const ok = isCorrect(result.role, fixture.expected);
    if (ok) correct += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${fixture.id.padEnd(32)} expected ${fixture.expected.padEnd(18)} got "${result.role}"`,
    );
    console.log(`      because: ${result.rationale}`);
  }
  console.log(`\n${correct} of ${ROLE_FIXTURES.length} postings classified as expected.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
