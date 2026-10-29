import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../db/schema';
import { AnalyticsIdentityService } from './analytics-identity.service';

describe('AnalyticsIdentityService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new AnalyticsIdentityService(jwt);

  it('reads the user from a valid Bearer token', () => {
    const token = jwt.sign({ sub: 'user-1', role: UserRole.EMPLOYER });

    expect(service.resolve(`Bearer ${token}`)).toEqual({
      userId: 'user-1',
      role: UserRole.EMPLOYER,
    });
  });

  it('treats a missing header as anonymous', () => {
    expect(service.resolve(undefined)).toBeNull();
  });

  it('treats a token signed with another secret as anonymous', () => {
    const forged = new JwtService({ secret: 'other' }).sign({
      sub: 'user-1',
      role: UserRole.ADMIN,
    });

    expect(service.resolve(`Bearer ${forged}`)).toBeNull();
  });
});
