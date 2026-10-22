import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import {
  defer,
  filter,
  map,
  merge,
  Observable,
  Subject,
  takeWhile,
} from 'rxjs';
import { GENERATION_QUEUE } from './generation.constants';
import { GenerationProgress } from './generation-progress';

export type GenerationStreamEvent =
  | { type: 'progress'; payload: GenerationProgress }
  | { type: 'done'; payload: null }
  | { type: 'error'; payload: string };

interface QueueSignal {
  bullJobId: string;
  event: GenerationStreamEvent;
}

export const generationBullJobId = (jobId: string): string =>
  `generate-${jobId}`;

const isGenerationProgress = (value: unknown): value is GenerationProgress =>
  typeof value === 'object' && value !== null && 'stage' in value;

/**
 * Shares one BullMQ QueueEvents listener across all open progress streams and exposes each job's
 * progress as an Observable. The processor reports progress via job.updateProgress, so state is
 * Redis-backed and works across API instances.
 */
@Injectable()
export class GenerationProgressService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly signals = new Subject<QueueSignal>();
  private queueEvents: QueueEvents;

  constructor(
    @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.queueEvents = new QueueEvents(GENERATION_QUEUE, {
      connection: {
        host: this.configService.get<string>('redis.host'),
        port: this.configService.get<number>('redis.port'),
        username: this.configService.get<string>('redis.username'),
        password: this.configService.get<string>('redis.password'),
      },
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      if (!isGenerationProgress(data)) return;
      this.signals.next({
        bullJobId: jobId,
        event: { type: 'progress', payload: data },
      });
    });
    this.queueEvents.on('completed', ({ jobId }) => {
      this.signals.next({
        bullJobId: jobId,
        event: { type: 'done', payload: null },
      });
    });
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.signals.next({
        bullJobId: jobId,
        event: { type: 'error', payload: failedReason },
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
    this.signals.complete();
  }

  /**
   * Emits the job's current state first (so a reconnecting client resumes), then live updates.
   * Completes after the terminal done/error event.
   */
  watch(jobId: string): Observable<GenerationStreamEvent> {
    const bullJobId = generationBullJobId(jobId);

    const live$ = this.signals.pipe(
      filter((signal) => signal.bullJobId === bullJobId),
      map((signal) => signal.event),
    );
    const current$ = defer(() => this.currentEvent(bullJobId));

    return merge(live$, current$).pipe(
      filter((event): event is GenerationStreamEvent => event !== null),
      takeWhile((event) => event.type === 'progress', true),
    );
  }

  private async currentEvent(
    bullJobId: string,
  ): Promise<GenerationStreamEvent | null> {
    const job = await this.queue.getJob(bullJobId);
    if (!job) return null;

    const state = await job.getState();
    if (state === 'completed') return { type: 'done', payload: null };
    if (state === 'failed') {
      return { type: 'error', payload: job.failedReason };
    }
    if (isGenerationProgress(job.progress)) {
      return { type: 'progress', payload: job.progress };
    }
    return null;
  }
}
