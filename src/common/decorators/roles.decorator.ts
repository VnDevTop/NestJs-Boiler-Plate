import { SetMetadata } from '@nestjs/common';

import { ROLES_KEY } from '../constants/index.js';
import { Role } from '../enums/index.js';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
