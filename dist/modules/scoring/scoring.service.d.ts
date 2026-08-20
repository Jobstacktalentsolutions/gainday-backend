import { Submission } from '../submissions/entities/submission.entity';
export declare class ScoringService {
    private readonly logger;
    scoreSubmission(submission: Submission): Promise<Partial<Submission>>;
}
