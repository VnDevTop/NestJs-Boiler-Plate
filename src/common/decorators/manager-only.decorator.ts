import { SetMetadata } from '@nestjs/common';

import { MANAGER_ONLY_KEY } from '../constants/index.js';

export const ManagerOnly = () => SetMetadata(MANAGER_ONLY_KEY, true);
