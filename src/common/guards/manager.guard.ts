import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { MANAGER_ONLY_KEY } from '../constants/index.js';
import { RequestUser } from '../interfaces/index.js';

interface RequestWithUser extends Request {
  user?: RequestUser;
}

@Injectable()
export class ManagerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const managerOnly = this.reflector.getAllAndOverride<boolean>(
      MANAGER_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const isAdminPath = this.isAdminPath(request.path);
    const requiresManager = managerOnly || isAdminPath;

    if (!requiresManager) {
      return true;
    }

    return request.user?.isManager === true;
  }

  private isAdminPath(path: string): boolean {
    return /(^|\/)admin(\/|$)/.test(path);
  }
}
