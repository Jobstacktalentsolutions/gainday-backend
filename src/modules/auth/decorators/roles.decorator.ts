import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../db/schema';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
