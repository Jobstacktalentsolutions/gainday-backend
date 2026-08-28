import { Injectable, Logger } from '@nestjs/common';
import { Submission } from '../../db/schema';

type SubmissionWithSimulation = Submission & {
  simulation?: unknown;
};

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  async scoreSubmission(
    submission: SubmissionWithSimulation,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Scoring submission: ${submission.id}`);

    // Weights
    const weights = {
      problemSolving: 0.4,
      judgmentExecution: 0.2,
      writtenCommunication: 0.2,
      commercialDomainAwareness: 0.2,
    };

    // Calculate score for each category (mocked for initial setup)
    const problemSolvingScore = 85;
    const judgmentExecutionScore = 90;
    const writtenCommScore = 80;
    const commercialDomainAwarenessScore = 75;

    const overallScore =
      problemSolvingScore * weights.problemSolving +
      judgmentExecutionScore * weights.judgmentExecution +
      writtenCommScore * weights.writtenCommunication +
      commercialDomainAwarenessScore * weights.commercialDomainAwareness;

    return {
      status: 'SCORED' as const,
      overallScore: Math.round(overallScore * 100) / 100,
      categoryScores: {
        problemSolving: {
          score: problemSolvingScore,
          rationale:
            'Demonstrated strong reasoning and identified core issues correctly.',
          evidence:
            'Identified internal audit discrepancies as critical to team operations.',
        },
        judgmentExecution: {
          score: judgmentExecutionScore,
          rationale:
            'Followed instructions completely, strictly adhering to word limits.',
          evidence: 'Word counts were 235 (limit 250) and 130 (limit 150).',
        },
        writtenCommunication: {
          score: writtenCommScore,
          rationale: 'Very clear, structured responses with professional tone.',
          evidence:
            'Proper business greeting, logical paragraphs, clear bullet points.',
        },
        commercialDomainAwareness: {
          score: commercialDomainAwarenessScore,
          rationale:
            'Demonstrated good understanding of stakeholder interests and commercial tradeoffs.',
          evidence:
            'Acknowledged partner budget constraints when defending recommendations.',
        },
      },
    };
  }
}
