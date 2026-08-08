import { PasswordHasherService } from './password-hasher.service';
import { BadRequestException } from '@nestjs/common';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(() => {
    service = new PasswordHasherService();
  });

  it('should hash password with Argon2id and verify successfully', async () => {
    const rawPassword = 'P@ssword123!';
    const hash = await service.hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');

    const isValid = await service.verifyPassword(rawPassword, hash);
    expect(isValid).toBe(true);

    const isInvalid = await service.verifyPassword('WrongPassword123!', hash);
    expect(isInvalid).toBe(false);
  });

  it('should reject weak passwords missing uppercase/lowercase/numbers/special chars', () => {
    expect(() => service.validatePasswordStrength('short1!')).toThrow(BadRequestException);
    expect(() => service.validatePasswordStrength('lowercaseonly1!')).toThrow(BadRequestException);
    expect(() => service.validatePasswordStrength('UPPERCASEONLY1!')).toThrow(BadRequestException);
    expect(() => service.validatePasswordStrength('NoSpecialNum123')).toThrow(BadRequestException);
  });
});
