import { Injectable, Logger } from '@nestjs/common';
import { Submission } from '../submissions/entities/submission.entity';
import { SimulationTask } from '../simulations/entities/simulation.entity';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  async scoreSubmission(submission: Submission): Promise<Partial<Submission>> {
    this.logger.log(`Scoring submission: ${submission.id}`);
    
    // Check if the simulation contains a prioritization task
    const simulation = submission.simulation;
    const hasPrioritization = simulation?.tasks?.some(t => t.type === 'TRIAGE_PRIORITIZATION') || false;

    // Weights
    const weights = {
      problemSolving: hasPrioritization ? 0.30 : 0.40,
      execution: 0.20,
      writtenCommunication: 0.20,
      domainAwareness: 0.20,
      prioritization: hasPrioritization ? 0.10 : 0.00,
    };

    // Calculate score for each category (mocked for initial setup)
    const problemSolvingScore = 85;
    const executionScore = 90;
    const writtenCommScore = 80;
    const domainAwarenessScore = 75;
    const prioritizationScore = hasPrioritization ? 100 : 0;

    const overallScore = 
      (problemSolvingScore * weights.problemSolving) +
      (executionScore * weights.execution) +
      (writtenCommScore * weights.writtenCommunication) +
      (domainAwarenessScore * weights.domainAwareness) +
      (prioritizationScore * weights.prioritization);

    return {
      status: 'SCORED' as any,
      overallScore: Math.round(overallScore * 100) / 100,
      categoryScores: {
        problemSolving: {
          score: problemSolvingScore,
          rationale: 'Demonstrated strong reasoning and identified core issues correctly.',
          evidence: 'Identified internal audit discrepancies as critical to team operations.',
        },
        execution: {
          score: executionScore,
          rationale: 'Followed instructions completely, strictly adhering to word limits.',
          evidence: 'Word counts were 235 (limit 250) and 130 (limit 150).',
        },
        writtenCommunication: {
          score: writtenCommScore,
          rationale: 'Very clear, structured responses with professional tone.',
          evidence: 'Proper business greeting, logical paragraphs, clear bullet points.',
        },
        domainAwareness: {
          score: domainAwarenessScore,
          rationale: 'Demonstrated good understanding of stakeholder interests and commercial tradeoffs.',
          evidence: 'Acknowledged partner budget constraints when defending recommendations.',
        },
        prioritization: {
          score: prioritizationScore,
          rationale: hasPrioritization ? 'Perfect match with expert-defined priority matrix.' : 'N/A',
          evidence: hasPrioritization ? 'Ranked options: Wire Transfer -> Q2 reports -> Prospect -> Lunch.' : 'N/A',
        },
      },
    };
  }
}
