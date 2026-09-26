import { Injectable } from '@nestjs/common';

import { AdminDashboard, AdminHealth } from './interfaces/index.js';

@Injectable()
export class AdminService {
  getHealth(): AdminHealth {
    return {
      status: 'ok',
      scope: 'admin',
      timestamp: new Date().toISOString(),
    };
  }
  
  getDashboard(): AdminDashboard {
    return {
      message: 'Admin dashboard',
      scope: 'admin',
      timestamp: new Date().toISOString(),
    };
  }
}