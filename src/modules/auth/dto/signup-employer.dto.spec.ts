import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupEmployerDto } from './signup-employer.dto';

const base = {
  fullName: 'Ana',
  email: 'ana@example.com',
  companyName: 'Acme',
  password: 'longenough',
  confirmPassword: 'longenough',
  agreedToTerms: true,
};

const redirectErrors = async (redirectPath: unknown) => {
  const errors = await validate(plainToInstance(SignupEmployerDto, { ...base, redirectPath }));
  return errors.find((error) => error.property === 'redirectPath');
};

describe('SignupEmployerDto redirectPath', () => {
  it('accepts a same-site path', async () => {
    expect(await redirectErrors('/employer/billing?buy=GROWTH')).toBeUndefined();
  });

  it('accepts no redirect at all', async () => {
    expect(await redirectErrors(undefined)).toBeUndefined();
  });

  it('rejects an external URL', async () => {
    expect(await redirectErrors('https://evil.example')).toBeDefined();
  });

  it('rejects a protocol-relative URL', async () => {
    expect(await redirectErrors('//evil.example/employer')).toBeDefined();
  });
});
