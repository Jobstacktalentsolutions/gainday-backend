import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SubmissionsService } from '../submissions.service';
import { StagedChatService } from './staged-chat.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../../db/schema';

// The candidate's reply body. Turn, task and submission come from the path.
const postReplySchema = z.object({
  text: z.string(),
  clientSentAt: z.string().datetime().nullable(),
  idempotencyKey: z.string().min(8).max(128),
});

/**
 * Staged chat routes (customer service doc Section 2.8). Only the candidate who owns the submission
 * can reach them. Future customer messages are never part of a response.
 */
@Controller('submissions/:submissionId/staged-chat')
export class StagedChatController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly stagedChat: StagedChatService,
  ) {}

  @Get(':taskId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  async getState(
    @Param('submissionId') submissionId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
  ) {
    const submission = this.stagedChat.assertOwned(
      await this.submissions.findById(submissionId),
      user.profileId,
    );
    return this.stagedChat.getState(submission, taskId);
  }

  @Post(':taskId/turns/:turn/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  async postReply(
    @Param('submissionId') submissionId: string,
    @Param('taskId') taskId: string,
    @Param('turn') turnParam: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
  ) {
    const turn = Number(turnParam);
    if (!Number.isInteger(turn) || turn < 1) {
      throw new BadRequestException('turn must be a positive whole number');
    }
    const parsed = postReplySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(`invalid reply: ${parsed.error.message}`);
    }
    const submission = this.stagedChat.assertOwned(
      await this.submissions.findById(submissionId),
      user.profileId,
    );
    return this.stagedChat.postReply(submission, taskId, {
      turn,
      text: parsed.data.text,
      clientSentAt: parsed.data.clientSentAt === null ? null : new Date(parsed.data.clientSentAt),
      idempotencyKey: parsed.data.idempotencyKey,
    });
  }
}
