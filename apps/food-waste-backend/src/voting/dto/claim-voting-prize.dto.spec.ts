import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ClaimVotingPrizeDto } from './claim-voting-prize.dto';

describe('ClaimVotingPrizeDto', () => {
  it('accepts a valid 24-char ObjectId string', () => {
    const dto = plainToInstance(ClaimVotingPrizeDto, {
      establishmentId: '507f1f77bcf86cd799439011',
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a missing establishmentId', () => {
    const dto = plainToInstance(ClaimVotingPrizeDto, {});
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects a non-ObjectId string', () => {
    const dto = plainToInstance(ClaimVotingPrizeDto, { establishmentId: 'not-an-id' });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
