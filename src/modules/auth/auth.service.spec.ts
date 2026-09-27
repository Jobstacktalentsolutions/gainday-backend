import { AuthService } from './auth.service';
import { UserRole } from '../../db/schema';

const HOUR = 60 * 60 * 1000;

describe('AuthService.resendVerificationEmail', () => {
  const usersService = {
    findVerificationStateByEmail: jest.fn(),
    updateVerificationToken: jest.fn(),
  };
  const notificationsService = { sendVerificationEmail: jest.fn() };

  const service = new AuthService(
    {} as never,
    usersService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notificationsService as never,
  );

  const unverified = (token: string | null, issuedMsAgo?: number) => ({
    id: 'user-1',
    role: UserRole.JOB_SEEKER,
    isEmailVerified: false,
    emailVerificationToken: token,
    emailVerificationExpires:
      issuedMsAgo === undefined
        ? null
        : new Date(Date.now() - issuedMsAgo + 24 * HOUR),
  });

  beforeEach(() => jest.resetAllMocks());

  it('does nothing for unknown emails', async () => {
    usersService.findVerificationStateByEmail.mockResolvedValue(null);
    await service.resendVerificationEmail('a@b.co');
    expect(notificationsService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does nothing for already verified users', async () => {
    usersService.findVerificationStateByEmail.mockResolvedValue({
      ...unverified('tok', 5 * 60 * 1000),
      isEmailVerified: true,
    });
    await service.resendVerificationEmail('a@b.co');
    expect(notificationsService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('skips the send inside the cooldown window', async () => {
    usersService.findVerificationStateByEmail.mockResolvedValue(
      unverified('tok', 10 * 1000),
    );
    await service.resendVerificationEmail('a@b.co');
    expect(notificationsService.sendVerificationEmail).not.toHaveBeenCalled();
    expect(usersService.updateVerificationToken).not.toHaveBeenCalled();
  });

  it('reuses a live token and refreshes its expiry after the cooldown', async () => {
    usersService.findVerificationStateByEmail.mockResolvedValue(
      unverified('tok', 5 * 60 * 1000),
    );
    await service.resendVerificationEmail('a@b.co');
    expect(usersService.updateVerificationToken).toHaveBeenCalledWith(
      'user-1',
      'tok',
      expect.any(Date),
    );
    expect(notificationsService.sendVerificationEmail).toHaveBeenCalledWith(
      'a@b.co',
      'tok',
      UserRole.JOB_SEEKER,
    );
  });

  it('issues a fresh token when the previous one expired or is missing', async () => {
    usersService.findVerificationStateByEmail.mockResolvedValue(
      unverified('old', 25 * HOUR),
    );
    await service.resendVerificationEmail('a@b.co');
    const [, token] = notificationsService.sendVerificationEmail.mock
      .calls[0] as [string, string, UserRole];
    expect(token).not.toBe('old');
    expect(token).toHaveLength(64);

    jest.resetAllMocks();
    usersService.findVerificationStateByEmail.mockResolvedValue(
      unverified(null),
    );
    await service.resendVerificationEmail('a@b.co');
    expect(notificationsService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
