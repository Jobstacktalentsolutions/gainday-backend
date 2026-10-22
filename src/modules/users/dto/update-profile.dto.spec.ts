import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

const phoneErrors = async (phoneNumber: unknown) => {
  const dto = plainToInstance(UpdateProfileDto, { phoneNumber });
  const errors = await validate(dto);
  return errors.find((error) => error.property === 'phoneNumber');
};

describe('UpdateProfileDto phoneNumber', () => {
  it('accepts a valid international number', async () => {
    expect(await phoneErrors('+447911123456')).toBeUndefined();
  });

  it('accepts an empty string, which clears the number', async () => {
    expect(await phoneErrors('')).toBeUndefined();
  });

  it('rejects a national-format number without a country code', async () => {
    expect(await phoneErrors('07911123456')).toBeDefined();
  });

  it('rejects an international number that is not valid', async () => {
    expect(await phoneErrors('+44 123')).toBeDefined();
  });

  it('rejects a number that is not E.164 (contains spaces)', async () => {
    expect(await phoneErrors('+44 7911 123456')).toBeDefined();
  });
});
