import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

const identity = {
  email: 'ana@example.com',
  emailVerified: true,
  googleId: 'google-sub-123',
};

const account = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'ana@example.com',
  role: 'JOB_SEEKER',
  googleId: null,
  isEmailVerified: true,
  isActive: true,
  suspensionReason: null,
  ...overrides,
});

describe('GoogleAuthService.signIn', () => {
  let verifier: { verify: jest.Mock };
  let usersService: {
    findByEmailWithPassword: jest.Mock;
    linkGoogleAccount: jest.Mock;
  };
  let authService: {
    assertAccountActive: jest.Mock;
    login: jest.Mock;
  };
  let service: GoogleAuthService;

  beforeEach(() => {
    verifier = { verify: jest.fn().mockResolvedValue(identity) };
    usersService = {
      findByEmailWithPassword: jest.fn().mockResolvedValue(account()),
      linkGoogleAccount: jest.fn().mockResolvedValue(undefined),
    };
    authService = {
      assertAccountActive: jest.fn(),
      login: jest.fn().mockResolvedValue({
        access_token: 'jwt',
        user: { id: 'user-1', role: 'JOB_SEEKER' },
      }),
    };
    service = new GoogleAuthService(
      verifier as never,
      usersService as never,
      authService as never,
    );
  });

  it('signs in an existing candidate and links the Google ID on first use', async () => {
    const result = await service.signIn('credential');

    expect(usersService.linkGoogleAccount).toHaveBeenCalledWith(
      'user-1',
      'google-sub-123',
    );
    expect(authService.login).toHaveBeenCalled();
    expect(result).toEqual({
      access_token: 'jwt',
      user: { id: 'user-1', role: 'JOB_SEEKER' },
      isEmailVerified: true,
    });
  });

  it('signs in an existing employer through the same session as password login', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(
      account({ role: 'EMPLOYER', googleId: 'google-sub-123' }),
    );

    const result = await service.signIn('credential');

    expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
    expect(result.access_token).toBe('jwt');
  });

  it('refuses a Google email with no Gainday account, and creates nothing', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    await expect(service.signIn('credential')).rejects.toThrow(
      new UnauthorizedException(
        'No Gainday account uses this Google email. Sign up first.',
      ),
    );
    expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('refuses an unverified Google email before looking anything up', async () => {
    verifier.verify.mockResolvedValue({ ...identity, emailVerified: false });

    await expect(service.signIn('credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.findByEmailWithPassword).not.toHaveBeenCalled();
  });

  it('refuses an admin and points them at the admin login page', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(
      account({ role: 'ADMIN' }),
    );

    await expect(service.signIn('credential')).rejects.toThrow(
      new ForbiddenException(
        'Administrators must sign in from the admin login page.',
      ),
    );
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('applies the same suspension rule as password login', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(
      account({ isActive: false, suspensionReason: 'spam' }),
    );
    authService.assertAccountActive.mockImplementation(() => {
      throw new ForbiddenException('Your account has been suspended: spam.');
    });

    await expect(service.signIn('credential')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authService.assertAccountActive).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false, suspensionReason: 'spam' }),
    );
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('refuses an account already linked to a different Google account', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(
      account({ googleId: 'some-other-google-sub' }),
    );

    await expect(service.signIn('credential')).rejects.toThrow(
      new UnauthorizedException(
        'This account is linked to a different Google account.',
      ),
    );
    expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
  });

  it('marks an account verified when Google confirms it, even if it was already linked', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(
      account({ googleId: 'google-sub-123', isEmailVerified: false }),
    );

    await service.signIn('credential');

    expect(usersService.linkGoogleAccount).toHaveBeenCalledWith(
      'user-1',
      'google-sub-123',
    );
  });
});
