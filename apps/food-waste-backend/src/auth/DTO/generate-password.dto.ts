import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@foodwaste/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Body of `POST /auth/generate-password`.
 *
 * @rationale The handler previously typed its body as an inline
 * `{ length?: number }`. An inline type carries no `class-validator` metadata,
 * so the global ValidationPipe had nothing to validate and passed the value
 * straight through — on a route that is `@Public()`, meaning any anonymous
 * caller could ask the server to allocate a string of arbitrary length.
 *
 * Bounds come from the shared password policy rather than local literals, so
 * the generator can never be asked for a length the validator would reject.
 */
export class GeneratePasswordDto {
  @ApiPropertyOptional({
    description: 'Length of the generated password.',
    minimum: PASSWORD_MIN_LENGTH,
    maximum: PASSWORD_MAX_LENGTH,
    default: 16,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PASSWORD_MIN_LENGTH)
  @Max(PASSWORD_MAX_LENGTH)
  length?: number;
}
