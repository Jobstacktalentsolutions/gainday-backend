import { Controller, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
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
