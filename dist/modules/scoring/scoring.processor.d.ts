import { WorkerHost } from '@nestjs/bullmq';
import { Job as BullJob } from 'bullmq';
import { Repository } from 'typeorm';
import { Submission } from '../submissions/entities/submission.entity';
import { Job } from '../jobs/entities/job.entity';
import { ScoringService } from './scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
export declare class ScoringProcessor extends WorkerHost {
    private readonly submissionRepository;
    private readonly jobRepository;
    private readonly scoringService;
    private readonly usersService;
    private readonly notificationsService;
    private readonly logger;
    constructor(submissionRepository: Repository<Submission>, jobRepository: Repository<Job>, scoringService: ScoringService, usersService: UsersService, notificationsService: NotificationsService);
    process(bullJob: BullJob<{
        jobId: string;
    }>): Promise<any>;
}
