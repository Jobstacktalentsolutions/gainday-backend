import { Controller, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../db/schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getAdminStats();
  }

  @Put('users/:id/status')
  async setStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.adminService.setUserActiveStatus(id, body.isActive);
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
}
