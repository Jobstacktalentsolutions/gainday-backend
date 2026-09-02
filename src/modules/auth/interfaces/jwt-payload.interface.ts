import { UserRole } from '../../../db/schema';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  profileId?: string;
}
