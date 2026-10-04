import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, GenerationReviewStatus } from '../../db/schema';
import { QuestionBankTaskContent } from '../../db/schema/question-bank.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import {
  ListUsersQueryDto,
  ListJobsQueryDto,
  ListGenerationReviewsQueryDto,
} from './dto/pagination-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats(
    @Query('timeframe') timeframe?: 'day' | 'week' | 'month' | 'year' | 'all',
  ) {
    return this.adminService.getAdminStats(timeframe);
  }

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('candidates/:id')
  async getCandidateDetail(@Param('id') id: string) {
    return this.adminService.getCandidateDetail(id);
  }

  @Post('admins')
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Delete('admins/:id')
  async deleteAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ) {
    return this.adminService.deleteAdmin(id, admin?.id);
  }

  @Get('jobs')
  async listJobs(@Query() query: ListJobsQueryDto) {
    return this.adminService.listJobs(query);
  }

  @Get('jobs/:id')
  async getJobDetail(@Param('id') id: string) {
    return this.adminService.getJobDetail(id);
  }

  @Put('jobs/:id/status')
  async updateJobStatus(
    @Param('id') id: string,
    @Body() body: { status: any },
  ) {
    return this.adminService.updateJobStatus(id, body.status);
  }

  @Put('users/:id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean; suspensionReason?: string },
    @CurrentUser() admin: any,
  ) {
    return this.adminService.setUserActiveStatus(
      id,
      body.isActive,
      admin?.id,
      body.suspensionReason,
    );
  }

  @Put('submissions/:id/anti-cheat-review')
  async reviewAntiCheat(
    @Param('id') id: string,
    @Body() body: { action: 'UPHOLD' | 'OVERTURN' },
  ) {
    return this.adminService.reviewAntiCheatFlag(id, body.action);
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    return this.adminService.deleteInappropriateJob(id);
  }

  @Get('task-pattern-types')
  async listTaskPatternTypes() {
    return this.adminService.listTaskPatternTypes();
  }

  @Get('generation-reviews')
  async listGenerationReviews(
    @Query() query: ListGenerationReviewsQueryDto,
  ) {
    return this.adminService.listGenerationReviewItems(query);
  }

  @Put('generation-reviews/:id/approve')
  async approveGenerationReview(
    @Param('id') id: string,
    @Body()
    body: { taskContent: QuestionBankTaskContent },
    @CurrentUser() admin: any,
  ) {
    return this.adminService.approveGenerationReviewWithEdits(
      id,
      admin.profileId,
      body.taskContent,
    );
  }

  @Put('generation-reviews/:id/reject')
  async rejectGenerationReview(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ) {
    return this.adminService.rejectGenerationReview(id, admin.profileId);
  }
}
