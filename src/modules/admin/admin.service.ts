import { Injectable } from '@nestjs/common';

import {
  AdminDashboardResponseDto,
  AdminHealthResponseDto,
} from './dto/index.js';

@Injectable()
export class AdminService {
  getHealth(): AdminHealthResponseDto {
    return {
      status: 'ok',
      scope: 'admin',
      timestamp: new Date().toISOString(),
    };
  }

  getDashboard(): AdminDashboardResponseDto {
    return {
      message: 'Admin dashboard',
      scope: 'admin',
      timestamp: new Date().toISOString(),
    };
  }
}
