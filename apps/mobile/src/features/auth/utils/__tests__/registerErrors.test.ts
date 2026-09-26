import { isRegisterFieldError, registerFieldErrors } from '../registerErrors';

describe('registerFieldErrors', () => {
  it('puts an already-registered email on the email field, in the language received', () => {
    const failure = {
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'Un compte existe déjà avec cette adresse e-mail.',
    };

    expect(registerFieldErrors(failure)).toEqual({
      email: 'Un compte existe déjà avec cette adresse e-mail.',
    });
    expect(isRegisterFieldError(failure)).toBe(true);
  });

  it('maps each validation error to its field, ignoring fields the form does not have', () => {
    const failure = {
      code: 'VALIDATION_FAILED',
      message: 'x',
      validationErrors: { email: 'بريد غير صالح', password: 'قصيرة', role: 'not allowed' },
    };

    expect(registerFieldErrors(failure)).toEqual({ email: 'بريد غير صالح', password: 'قصيرة' });
  });

  it('keeps the field-specific validation message over the general one', () => {
    expect(
      registerFieldErrors({
        code: 'PASSWORD_POLICY',
        message: 'general',
        validationErrors: { password: 'specific' },
      }),
    ).toEqual({ password: 'specific' });
  });

  it.each([
    // "email" in the English text used to route these to the email field.
    { code: 'VERIFICATION_SEND_FAILED', message: 'Could not send the verification email.' },
    { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    { message: 'No code at all (older backend)' },
    {},
  ])('leaves a general failure for the banner: %j', failure => {
    expect(registerFieldErrors(failure)).toEqual({});
    expect(isRegisterFieldError(failure)).toBe(false);
  });
});
