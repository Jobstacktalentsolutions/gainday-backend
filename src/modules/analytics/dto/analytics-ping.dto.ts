import { IsUUID } from 'class-validator';

export class AnalyticsPingDto {
  /** The first-party visitor id the frontend generated and keeps in a cookie. */
  @IsUUID()
  visitorId!: string;
}
