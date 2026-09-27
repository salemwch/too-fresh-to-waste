import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { toFieldErrors } from '../../common/errors/validation-errors';
import {
  MerchantEarningsRowsQueryDto,
  MerchantSalesQueryDto,
} from '../dto/merchant-sales-query.dto';

const errors = (cls: new () => object, input: object) => validateSync(plainToInstance(cls, input));

describe('MerchantSalesQueryDto', () => {
  it.each(['today', '7d', '30d', 'month', 'all'])('accepts period=%s', period => {
    expect(errors(MerchantSalesQueryDto, { period })).toHaveLength(0);
  });

  it('rejects any other period with the VALIDATION_ENUM code', () => {
    const validationErrors = errors(MerchantSalesQueryDto, { period: '90d' });
    const [fieldError] = toFieldErrors(validationErrors);
    expect(fieldError?.field).toBe('period');
    expect(fieldError?.code).toBe('VALIDATION_ENUM');
  });

  it('defaults to month', () => {
    expect(plainToInstance(MerchantSalesQueryDto, {}).period).toBe('month');
  });

  it('rejects a non-mongo-id establishmentId', () => {
    const validationErrors = errors(MerchantSalesQueryDto, { establishmentId: 'not-an-id' });
    const [fieldError] = toFieldErrors(validationErrors);
    expect(fieldError?.field).toBe('establishmentId');
    expect(fieldError?.code).toBe('VALIDATION_ID');
  });
});

describe('MerchantEarningsRowsQueryDto', () => {
  it('tab defaults to earnings, limit is capped at 50', () => {
    expect(plainToInstance(MerchantEarningsRowsQueryDto, {}).tab).toBe('earnings');
    expect(errors(MerchantEarningsRowsQueryDto, { limit: '51' })).not.toHaveLength(0);
  });

  it('rejects any other tab with the VALIDATION_ENUM code', () => {
    const validationErrors = errors(MerchantEarningsRowsQueryDto, { tab: 'settled' });
    const [fieldError] = toFieldErrors(validationErrors);
    expect(fieldError?.field).toBe('tab');
    expect(fieldError?.code).toBe('VALIDATION_ENUM');
  });

  it('accepts every declared tab', () => {
    for (const tab of ['earnings', 'refunded', 'verifying']) {
      expect(errors(MerchantEarningsRowsQueryDto, { tab })).toHaveLength(0);
    }
  });

  it('rejects a limit below 1 or above 50', () => {
    expect(errors(MerchantEarningsRowsQueryDto, { limit: '0' })).not.toHaveLength(0);
    expect(errors(MerchantEarningsRowsQueryDto, { limit: '50' })).toHaveLength(0);
  });
});
