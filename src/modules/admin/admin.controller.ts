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

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getAdminStats();
  }

  @Get('users')
  async listUsers(@Query('role') role?: UserRole) {
    return this.adminService.listUsers(role);
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
  async listJobs() {
    return this.adminService.listJobs();
  }

  @Put('users/:id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser() admin: any,
  ) {
    return this.adminService.setUserActiveStatus(id, body.isActive, admin?.id);
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
    @Query('status') status?: GenerationReviewStatus,
  ) {
    return this.adminService.listGenerationReviewItems(status);
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
