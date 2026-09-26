import { Controller, Get } from '@nestjs/common';

import { ManagerOnly } from '../../common/decorators/index.js';
import { AdminService } from './admin.service.js';

@ManagerOnly()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }
}
