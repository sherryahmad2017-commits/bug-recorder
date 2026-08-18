import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDto } from './signup.dto';

async function validateSignup(overrides: Partial<Record<keyof SignupDto, string>>) {
  const dto = plainToInstance(SignupDto, {
    email: 'dev@example.com',
    password: 'Passw0rd123',
    fullName: 'Dev User',
    organisationName: 'Acme Agency',
    ...overrides,
  });
  return validate(dto);
}

describe('SignupDto validation', () => {
  it('accepts a well-formed signup payload', async () => {
    const errors = await validateSignup({});
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateSignup({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it.each([
    ['short1A', 'too short'],
    ['alllowercase1', 'missing uppercase'],
    ['ALLUPPERCASE1', 'missing lowercase'],
    ['NoDigitsHere', 'missing a digit'],
  ])('rejects password "%s" (%s)', async (password) => {
    const errors = await validateSignup({ password });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects an empty organisation name', async () => {
    const errors = await validateSignup({ organisationName: '' });
    expect(errors.some((e) => e.property === 'organisationName')).toBe(true);
  });
});
