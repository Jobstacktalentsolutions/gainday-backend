import { AuthService } from './auth.service';
import { UserRole } from '../../db/schema';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const HOUR = 60 * 60 * 1000;

describe('AuthService resend & password security', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithPassword: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findVerificationStateByEmail: jest.fn(),
    updateVerificationToken: jest.fn(),
    setPasswordResetToken: jest.fn(),
    findByValidPasswordResetToken: jest.fn(),
    updatePassword: jest.fn(),
  };
  const notificationsService = {
    sendVerificationEmail: jest.fn(),
    sendAdmin2faEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'auth.admin2fa.cooldownSeconds') return 60;
      if (key === 'auth.admin2fa.maxResends') return 3;
      if (key === 'auth.admin2fa.ttlMinutes') return 10;
      if (key === 'auth.emailVerification.cooldownSeconds') return 60;
      if (key === 'auth.emailVerification.maxResends') return 3;
      if (key === 'auth.emailVerification.ttlHours') return 24;
      if (key === 'auth.passwordReset.cooldownSeconds') return 60;
      if (key === 'auth.passwordReset.maxRequests') return 3;
      if (key === 'auth.passwordReset.ttlMinutes') return 60;
      return undefined;
    }),
  };

  let service: AuthService;

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

  beforeEach(() => {
    jest.resetAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === 'auth.admin2fa.cooldownSeconds') return 60;
      if (key === 'auth.admin2fa.maxResends') return 3;
      if (key === 'auth.admin2fa.ttlMinutes') return 10;
      if (key === 'auth.emailVerification.cooldownSeconds') return 60;
      if (key === 'auth.emailVerification.maxResends') return 3;
      if (key === 'auth.emailVerification.ttlHours') return 24;
      if (key === 'auth.passwordReset.cooldownSeconds') return 60;
      if (key === 'auth.passwordReset.maxRequests') return 3;
      if (key === 'auth.passwordReset.ttlMinutes') return 60;
      return undefined;
    });

    service = new AuthService(
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
      {} as never,
      { sign: jest.fn().mockReturnValue('mock-token') } as never,
      notificationsService as never,
      configService as never,
    );
  });

  describe('resendVerificationEmail', () => {
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
    });
  });

  describe('Admin 2FA Resend System', () => {
    it('throws error if challenge token does not exist', async () => {
      await expect(service.resendAdmin2fa('non-existent-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('initiates login and enforces resend cooldown and max attempts cap', async () => {
      const hashedPassword = await bcrypt.hash('adminpass123', 10);
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@gainday.com',
        role: UserRole.ADMIN,
        password: hashedPassword,
        isActive: true,
      });

      const { challengeToken } = await service.initiateAdminLogin(
        'admin@gainday.com',
        'adminpass123',
      );
      expect(challengeToken).toBeDefined();
      expect(notificationsService.sendAdmin2faEmail).toHaveBeenCalledTimes(1);

      // Attempt immediate resend (inside 60s cooldown)
      await expect(service.resendAdmin2fa(challengeToken)).rejects.toThrow(
        /Please wait \d+s before requesting a new code/,
      );

      // Fast forward time past cooldown for first resend (resend #1)
      const challenge = (service as any).admin2faChallenges.get(challengeToken);
      challenge.lastSentAt = Date.now() - 61 * 1000;
      const resend1 = await service.resendAdmin2fa(challengeToken);
      expect(resend1.success).toBe(true);
      expect(resend1.remainingResends).toBe(2);

      // Resend #2
      challenge.lastSentAt = Date.now() - 61 * 1000;
      const resend2 = await service.resendAdmin2fa(challengeToken);
      expect(resend2.remainingResends).toBe(1);

      // Resend #3 (hits maxResends = 3)
      challenge.lastSentAt = Date.now() - 61 * 1000;
      const resend3 = await service.resendAdmin2fa(challengeToken);
      expect(resend3.remainingResends).toBe(0);

      // Attempt 4th resend -> Should throw max resends limit reached and invalidate session
      challenge.lastSentAt = Date.now() - 61 * 1000;
      await expect(service.resendAdmin2fa(challengeToken)).rejects.toThrow(
        /Maximum resend limit of 3 attempts reached/,
      );

      // Verify challenge was cleaned up
      expect((service as any).admin2faChallenges.get(challengeToken)).toBeUndefined();
    });
  });

  describe('Password Reuse Prevention', () => {
    it('prevents changing password to the same current password', async () => {
      const currentHashedPassword = await bcrypt.hash('CurrentPassword123!', 10);
      usersService.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        password: currentHashedPassword,
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'CurrentPassword123!',
          newPassword: 'CurrentPassword123!',
          confirmNewPassword: 'CurrentPassword123!',
        }),
      ).rejects.toThrow('New password cannot be the same as your current password');
    });

    it('allows changing password when new password is different', async () => {
      const currentHashedPassword = await bcrypt.hash('CurrentPassword123!', 10);
      usersService.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        password: currentHashedPassword,
      });

      await service.changePassword('user-1', {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'BrandNewPassword123!',
        confirmNewPassword: 'BrandNewPassword123!',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('prevents resetting password to the previous password', async () => {
      const previousHashedPassword = await bcrypt.hash('PreviousPass123!', 10);
      usersService.findByValidPasswordResetToken.mockResolvedValue({
        id: 'user-1',
        password: previousHashedPassword,
      });

      await expect(
        service.resetPassword({
          token: 'valid-reset-token',
          password: 'PreviousPass123!',
          confirmPassword: 'PreviousPass123!',
        }),
      ).rejects.toThrow('New password cannot be the same as your previous password');
    });

    it('prevents admin from setting initial permanent password identical to temporary password', async () => {
      const tempHashedPassword = await bcrypt.hash('TempPassword123!', 10);
      usersService.findByIdWithPassword.mockResolvedValue({
        id: 'admin-1',
        role: UserRole.ADMIN,
        password: tempHashedPassword,
      });
      usersService.findById.mockResolvedValue({
        id: 'admin-1',
        role: UserRole.ADMIN,
      });

      await expect(
        service.setAdminInitialPassword('admin-1', {
          newPassword: 'TempPassword123!',
          confirmNewPassword: 'TempPassword123!',
        }),
      ).rejects.toThrow('New password cannot be the same as your temporary password');
    });
  });
});
