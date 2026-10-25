import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const VERSION_KEY = 'job-board:version';
const RANKING_TTL_SECONDS = 3 * 60 * 60;

/**
 * Caches each viewer's job ranking in Redis for a few hours. Every key carries a version number,
 * so invalidating everything is one increment: old keys stop matching and expire on their own.
 * Redis is an optimisation only: if it is unavailable the board is ranked from scratch.
 */
@Injectable()
export class JobBoardCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(JobBoardCacheService.name);
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      username: configService.get<string>('redis.username'),
      password: configService.get<string>('redis.password'),
      lazyConnect: true,
      // Fail fast when Redis is down, so the board is not held up waiting for the cache.
      enableOfflineQueue: false,
    });
  }

  async getRanking(viewerKey: string): Promise<string[] | null> {
    try {
      const version = await this.redis.get(VERSION_KEY);
      const cached = await this.redis.get(this.rankingKey(version, viewerKey));
      return cached === null ? null : (JSON.parse(cached) as string[]);
    } catch (err) {
      this.logger.warn(
        `Job board cache read failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async setRanking(viewerKey: string, jobIds: string[]): Promise<void> {
    try {
      const version = await this.redis.get(VERSION_KEY);
      await this.redis.set(
        this.rankingKey(version, viewerKey),
        JSON.stringify(jobIds),
        'EX',
        RANKING_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Job board cache write failed: ${(err as Error).message}`,
      );
    }
  }

  /** Called when a job goes live or its embedding changes: every cached ranking is now stale. */
  async invalidateAll(): Promise<void> {
    try {
      await this.redis.incr(VERSION_KEY);
    } catch (err) {
      this.logger.error(
        `Job board cache could not be invalidated, rankings may be stale for up to 3 hours: ${(err as Error).message}`,
      );
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  private rankingKey(version: string | null, viewerKey: string): string {
    return `job-board:ranking:v${version ?? 0}:${viewerKey}`;
  }
}
