import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  employerProfiles,
  experienceReviews,
  jobSeekerProfiles,
  users,
  UserRole,
} from '../../db/schema';
import { buildTimeBuckets, type AnalyticsTimeframe } from '../admin/analytics-buckets';
import { CreateExperienceReviewDto } from './dto/create-experience-review.dto';
import { ListExperienceReviewsQueryDto } from './dto/experience-review-query.dto';

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class ReviewsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findMine(userId: string) {
    const [review] = await this.db
      .select({
        id: experienceReviews.id,
        rating: experienceReviews.rating,
        comment: experienceReviews.comment,
        createdAt: experienceReviews.createdAt,
      })
      .from(experienceReviews)
      .where(eq(experienceReviews.userId, userId))
      .limit(1);

    return { review: review ?? null };
  }

  async create(userId: string, dto: CreateExperienceReviewDto) {
    const comment = dto.comment?.trim();

    // Insert-or-nothing keeps the one-review-per-user rule safe against double submits.
    const [inserted] = await this.db
      .insert(experienceReviews)
      .values({ userId, rating: dto.rating, comment: comment || null })
      .onConflictDoNothing({ target: experienceReviews.userId })
      .returning({
        id: experienceReviews.id,
        rating: experienceReviews.rating,
        comment: experienceReviews.comment,
        createdAt: experienceReviews.createdAt,
      });

    if (!inserted) {
      throw new ConflictException('You have already shared your experience');
    }
    return inserted;
  }

  /**
   * Average rating across all reviews, plus a per-bucket average series for the chosen timeframe.
   * Buckets match the revenue chart. A bucket with no reviews has `average: null`.
   */
  async getSummary(timeframe: AnalyticsTimeframe) {
    const buckets = buildTimeBuckets(timeframe).map((bucket) => ({
      ...bucket,
      total: 0,
      count: 0,
    }));
    const windowStart = new Date(Math.min(...buckets.map((bucket) => bucket.startTime)));

    const recent = await this.db
      .select({ rating: experienceReviews.rating, createdAt: experienceReviews.createdAt })
      .from(experienceReviews)
      .where(gte(experienceReviews.createdAt, windowStart));

    for (const review of recent) {
      const time = review.createdAt.getTime();
      const bucket = buckets.find(
        (candidate) => time >= candidate.startTime && time < candidate.endTime,
      );
      if (bucket) {
        bucket.total += review.rating;
        bucket.count += 1;
      }
    }

    const [allTime] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${experienceReviews.rating}), 0)::int`,
        count: count(),
      })
      .from(experienceReviews);

    const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
    const periodCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

    return {
      timeframe,
      totals: {
        allTimeAverage: allTime.count > 0 ? roundToTwoDecimals(allTime.total / allTime.count) : null,
        allTimeCount: allTime.count,
        periodAverage: periodCount > 0 ? roundToTwoDecimals(periodTotal / periodCount) : null,
        periodCount,
      },
      series: buckets.map((bucket) => ({
        label: bucket.label,
        average: bucket.count > 0 ? roundToTwoDecimals(bucket.total / bucket.count) : null,
        count: bucket.count,
      })),
    };
  }

  async listReviews(query: ListExperienceReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select({
        id: experienceReviews.id,
        rating: experienceReviews.rating,
        comment: experienceReviews.comment,
        createdAt: experienceReviews.createdAt,
        role: users.role,
        email: users.email,
        candidateName: jobSeekerProfiles.fullName,
        companyName: employerProfiles.companyName,
      })
      .from(experienceReviews)
      .innerJoin(users, eq(users.id, experienceReviews.userId))
      .leftJoin(jobSeekerProfiles, eq(jobSeekerProfiles.userId, experienceReviews.userId))
      .leftJoin(employerProfiles, eq(employerProfiles.userId, experienceReviews.userId))
      .orderBy(desc(experienceReviews.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.db.select({ total: count() }).from(experienceReviews);
    const totalPages = Math.ceil(total / limit);

    return {
      items: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        role: row.role,
        email: row.email,
        reviewerName: row.role === UserRole.EMPLOYER ? row.companyName : row.candidateName,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
