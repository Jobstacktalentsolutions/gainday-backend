import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../db/schema';
import { AllowUnverifiedEmail } from '../decorators/allow-unverified-email.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class SampleController {
  open() {}

  @AllowUnverifiedEmail()
  allowed() {}
}

const passportGuardPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);

function contextFor(
  handler: (...args: unknown[]) => unknown,
  user: { role: UserRole; isEmailVerified: boolean },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard email verification', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    // Stub the passport step so the test only exercises the verification check.
    jest.spyOn(passportGuardPrototype, 'canActivate').mockResolvedValue(true);
    guard = new JwtAuthGuard(new Reflector());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks an unverified employer with EMAIL_NOT_VERIFIED', async () => {
    const context = contextFor(SampleController.prototype.open, {
      role: UserRole.EMPLOYER,
      isEmailVerified: false,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
  });

  it('blocks an unverified job seeker', async () => {
    const context = contextFor(SampleController.prototype.open, {
      role: UserRole.JOB_SEEKER,
      isEmailVerified: false,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('lets a verified employer through', async () => {
    const context = contextFor(SampleController.prototype.open, {
      role: UserRole.EMPLOYER,
      isEmailVerified: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets an unverified employer reach routes marked @AllowUnverifiedEmail', async () => {
    const context = contextFor(SampleController.prototype.allowed, {
      role: UserRole.EMPLOYER,
      isEmailVerified: false,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('does not apply the check to admins', async () => {
    const context = contextFor(SampleController.prototype.open, {
      role: UserRole.ADMIN,
      isEmailVerified: false,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
