import { Controller, Post, Body, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { GenerationService, GenerationResult } from './generation.service';
import { TestGenerateDto } from './dto/test-generate.dto';

const OUTPUT_DIR = join(process.cwd(), 'tmp', 'generation-test-runs');

/**
 * No-auth manual test endpoint for the generation pipeline — takes a bare job description
 * (+ optional skills/business problem), runs the real LangGraph pipeline end to end against a
 * throwaway job record, logs the full result to the terminal, and writes it to a timestamped
 * .txt file for inspection. Not part of the production API surface.
 */
@Controller('generation-test')
export class GenerationTestController {
  private readonly logger = new Logger(GenerationTestController.name);

  constructor(private readonly generationService: GenerationService) {}

  @Post('generate')
  async generate(
    @Body() dto: TestGenerateDto,
  ): Promise<GenerationResult & { outputFile: string }> {
    this.logger.log('Test generation requested');
    const start = Date.now();

    const result = await this.generationService.runTestGeneration(dto);

    const elapsedSeconds = ((Date.now() - start) / 1000).toFixed(1);
    this.logger.log(
      `Test generation complete in ${elapsedSeconds}s: category="${result.category}", ` +
        `${result.finalizedTasks.length} task(s), ${result.adminReviewItemsPersisted} sent to admin review.`,
    );
    console.log(JSON.stringify(result, null, 2));

    const outputFile = await this.writeResultToFile(result);
    this.logger.log(`Result written to ${outputFile}`);

    return { ...result, outputFile };
  }

  private async writeResultToFile(result: GenerationResult): Promise<string> {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const filename = `generation-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    const filePath = join(OUTPUT_DIR, filename);
    await writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
    return filePath;
  }
}
