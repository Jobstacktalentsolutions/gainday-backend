import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserRole } from '../../db/schema';
import { EMAIL_NOT_VERIFIED_CODE } from './guards/jwt-auth.guard';

describe('AuthController.login', () => {
  let controller: AuthController;
  const authService = {
    validateUser: jest.fn(),
    login: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const googleAuthService = {
    signIn: jest.fn(),
  };
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AuthController(
      authService as any,
      configService as any,
      googleAuthService as any,
    );
  });

  it('throws UnauthorizedException if credentials are invalid', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(
      controller.login({ email: 'test@example.com', password: 'bad' }, res),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException with emailVerified: false if employer is unverified', async () => {
    authService.validateUser.mockResolvedValue({
      id: 'emp-1',
      email: 'emp@example.com',
      role: UserRole.EMPLOYER,
      isEmailVerified: false,
    });

    try {
      await controller.login(
        { email: 'emp@example.com', password: 'correct' },
        res,
      );
      fail('Should have thrown ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as any;
      expect(response.code).toBe(EMAIL_NOT_VERIFIED_CODE);
      expect(response.emailVerified).toBe(false);
      expect(response.isEmailVerified).toBe(false);
      expect(response.email).toBe('emp@example.com');
      expect(response.role).toBe(UserRole.EMPLOYER);
    }

    expect(authService.login).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException if job seeker is unverified', async () => {
    authService.validateUser.mockResolvedValue({
      id: 'js-1',
      email: 'candidate@example.com',
      role: UserRole.JOB_SEEKER,
      isEmailVerified: false,
    });

    await expect(
      controller.login(
        { email: 'candidate@example.com', password: 'correct' },
        res,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('successfully logs in verified user and returns emailVerified: true', async () => {
    authService.validateUser.mockResolvedValue({
      id: 'emp-1',
      email: 'emp@example.com',
      role: UserRole.EMPLOYER,
      isEmailVerified: true,
    });
    authService.login.mockResolvedValue({
      access_token: 'jwt-token',
      user: {
        id: 'emp-1',
        email: 'emp@example.com',
        role: UserRole.EMPLOYER,
        isEmailVerified: true,
        emailVerified: true,
      },
    });

    const result = await controller.login(
      { email: 'emp@example.com', password: 'correct' },
      res,
    );

    expect(result.isEmailVerified).toBe(true);
    expect(result.emailVerified).toBe(true);
    expect(result.access_token).toBe('jwt-token');
    expect(result.user.emailVerified).toBe(true);
    expect(res.cookie).toHaveBeenCalled();
  });
});
