import { Controller, Get } from '@nestjs/common';

import { ManagerOnly } from '../../common/decorators/index.js';
import { AdminService } from './admin.service.js';
import type { AdminDashboard, AdminHealth } from './interfaces/index.js';

@ManagerOnly()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  
  @Get('health')
  getHealth(): AdminHealth {
    return this.adminService.getHealth();
  }
  
  @Get('dashboard')
  getDashboard(): AdminDashboard {
    return this.adminService.getDashboard();
  }
}