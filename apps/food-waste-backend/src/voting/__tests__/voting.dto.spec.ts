import { PrizeCategory } from '@foodwaste/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CastVoteDto } from '../dto/cast-vote.dto';
import { CreateCycleDto, CreatePrizeOptionDto } from '../dto/create-cycle.dto';
import { UpdateCycleDto } from '../dto/update-cycle.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid CreatePrizeOptionDto plain object. */
function validPrize(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    name: 'Smartphone',
    description: 'Brand new flagship phone',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    category: PrizeCategory.PHONE,
    value: '1000 DT',
    ...overrides,
  };
}

/** Build a valid CreateCycleDto plain object with `n` prizes (default 2). */
function validCyclePlain(
  overrides: Partial<Record<string, unknown>> = {},
  prizeCount = 2,
): Record<string, unknown> {
  return {
    name: 'Summer 2026',
    cycleStartDate: '2026-07-01T00:00:00.000Z',
    cycleEndDate: '2026-07-31T00:00:00.000Z',
    communityGoalTarget: 30000,
    minimumBags: 50,
    recipientCount: 5,
    prizes: Array.from({ length: prizeCount }, () => validPrize()),
    ...overrides,
  };
}

/** Extract constraint names from validation errors for easier assertions. */
function constraintNames(errors: Awaited<ReturnType<typeof validate>>): string[] {
  return errors.flatMap(e => Object.keys(e.constraints ?? {}));
}

/** Extract all error messages, including nested (children). */
function allMessages(errors: Awaited<ReturnType<typeof validate>>): string[] {
  const messages: string[] = [];
  for (const e of errors) {
    messages.push(...Object.values(e.constraints ?? {}));
    if (e.children?.length) {
      messages.push(...allMessages(e.children));
    }
  }
  return messages;
}

// ---------------------------------------------------------------------------
// CreateCycleDto
// ---------------------------------------------------------------------------
describe('CreateCycleDto', () => {
  async function validateCycle(plain: Record<string, unknown>) {
    const errors = await validate(plainToInstance(CreateCycleDto, plain), { whitelist: true });
    return errors;
  }

  describe('valid DTO', () => {
    it('passes validation with all required fields', async () => {
      const errors = await validateCycle(validCyclePlain());
      expect(errors).toHaveLength(0);
    });

    it('passes with exactly 10 prizes (max boundary)', async () => {
      const errors = await validateCycle(validCyclePlain({}, 10));
      expect(errors).toHaveLength(0);
    });

    it('passes with exactly 2 prizes (min boundary)', async () => {
      const errors = await validateCycle(validCyclePlain({}, 2));
      expect(errors).toHaveLength(0);
    });
  });

  describe('missing required fields', () => {
    it('fails when name is absent', async () => {
      const plain = validCyclePlain();
      delete plain['name'];
      const errors = await validateCycle(plain);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('fails when cycleStartDate is absent', async () => {
      const plain = validCyclePlain();
      delete plain['cycleStartDate'];
      const errors = await validateCycle(plain);
      expect(errors.some(e => e.property === 'cycleStartDate')).toBe(true);
    });

    it('fails when cycleEndDate is absent', async () => {
      const plain = validCyclePlain();
      delete plain['cycleEndDate'];
      const errors = await validateCycle(plain);
      expect(errors.some(e => e.property === 'cycleEndDate')).toBe(true);
    });

    it('fails when communityGoalTarget is absent', async () => {
      const plain = validCyclePlain();
      delete plain['communityGoalTarget'];
      const errors = await validateCycle(plain);
      expect(errors.some(e => e.property === 'communityGoalTarget')).toBe(true);
    });

    it('fails when prizes are absent', async () => {
      const plain = validCyclePlain();
      delete plain['prizes'];
      const errors = await validateCycle(plain);
      expect(errors.some(e => e.property === 'prizes')).toBe(true);
    });
  });

  describe('prizes array size', () => {
    it('fails when prizes has only 1 item (ArrayMinSize=2)', async () => {
      const errors = await validateCycle(validCyclePlain({}, 1));
      const prizeError = errors.find(e => e.property === 'prizes');
      expect(prizeError).toBeDefined();
      expect(Object.keys(prizeError!.constraints ?? {})).toContain('arrayMinSize');
    });

    it('fails when prizes has 11 items (ArrayMaxSize=10)', async () => {
      const errors = await validateCycle(validCyclePlain({}, 11));
      const prizeError = errors.find(e => e.property === 'prizes');
      expect(prizeError).toBeDefined();
      expect(Object.keys(prizeError!.constraints ?? {})).toContain('arrayMaxSize');
    });
  });

  describe('minimumBags bounds', () => {
    it('fails when minimumBags = 0 (Min=1)', async () => {
      const errors = await validateCycle(validCyclePlain({ minimumBags: 0 }));
      const err = errors.find(e => e.property === 'minimumBags');
      expect(err).toBeDefined();
      expect(constraintNames(errors)).toContain('min');
    });

    it('fails when minimumBags = 501 (Max=500)', async () => {
      const errors = await validateCycle(validCyclePlain({ minimumBags: 501 }));
      const err = errors.find(e => e.property === 'minimumBags');
      expect(err).toBeDefined();
      expect(constraintNames(errors)).toContain('max');
    });

    it('passes at boundary minimumBags = 1', async () => {
      const errors = await validateCycle(validCyclePlain({ minimumBags: 1 }));
      expect(errors.every(e => e.property !== 'minimumBags')).toBe(true);
    });

    it('passes at boundary minimumBags = 500', async () => {
      const errors = await validateCycle(validCyclePlain({ minimumBags: 500 }));
      expect(errors.every(e => e.property !== 'minimumBags')).toBe(true);
    });
  });

  describe('recipientCount bounds', () => {
    it('fails when recipientCount = 0 (Min=1)', async () => {
      const errors = await validateCycle(validCyclePlain({ recipientCount: 0 }));
      expect(errors.some(e => e.property === 'recipientCount')).toBe(true);
    });

    it('fails when recipientCount = 51 (Max=50)', async () => {
      const errors = await validateCycle(validCyclePlain({ recipientCount: 51 }));
      expect(errors.some(e => e.property === 'recipientCount')).toBe(true);
    });

    it('passes at boundary recipientCount = 50', async () => {
      const errors = await validateCycle(validCyclePlain({ recipientCount: 50 }));
      expect(errors.every(e => e.property !== 'recipientCount')).toBe(true);
    });
  });

  describe('communityGoalTarget bounds', () => {
    it('fails when communityGoalTarget = 0 (Min=1)', async () => {
      const errors = await validateCycle(validCyclePlain({ communityGoalTarget: 0 }));
      expect(errors.some(e => e.property === 'communityGoalTarget')).toBe(true);
    });

    it('passes when communityGoalTarget = 1', async () => {
      const errors = await validateCycle(validCyclePlain({ communityGoalTarget: 1 }));
      expect(errors.every(e => e.property !== 'communityGoalTarget')).toBe(true);
    });
  });

  describe('nested prize validation', () => {
    it('fails when a prize is missing its name', async () => {
      const badPrize = validPrize();
      delete badPrize['name'];
      const errors = await validateCycle(validCyclePlain({ prizes: [validPrize(), badPrize] }));
      // Nested errors bubble up under the prizes property children
      const prizeErrors = errors.find(e => e.property === 'prizes');
      expect(prizeErrors).toBeDefined();
      const messages = allMessages(errors);
      // At least one nested error must mention 'name' or isString
      expect(messages.some(m => /string|name/i.test(m))).toBe(true);
    });

    it('fails when a prize imageUrl does not match a trusted CDN domain', async () => {
      const badPrize = validPrize({ imageUrl: 'https://untrusted.example.com/img.jpg' });
      const errors = await validateCycle(validCyclePlain({ prizes: [validPrize(), badPrize] }));
      const messages = allMessages(errors);
      expect(messages.some(m => /CDN|imageUrl/i.test(m))).toBe(true);
    });

    it('passes when imageUrl uses storage.googleapis.com', async () => {
      const gcsPrize = validPrize({
        imageUrl: 'https://storage.googleapis.com/my-bucket/photo.jpg',
      });
      const errors = await validateCycle(validCyclePlain({ prizes: [gcsPrize, validPrize()] }));
      expect(errors).toHaveLength(0);
    });

    it('passes when imageUrl uses cdn.toofreshtoowaste.com', async () => {
      const cdnPrize = validPrize({
        imageUrl: 'https://cdn.toofreshtoowaste.com/prizes/phone.jpg',
      });
      const errors = await validateCycle(validCyclePlain({ prizes: [cdnPrize, validPrize()] }));
      expect(errors).toHaveLength(0);
    });

    it('fails when a prize has an invalid category enum', async () => {
      const badPrize = validPrize({ category: 'NOT_A_CATEGORY' });
      const errors = await validateCycle(validCyclePlain({ prizes: [validPrize(), badPrize] }));
      const messages = allMessages(errors);
      expect(messages.some(m => /enum|category/i.test(m) || /isEnum/i.test(m))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// CreatePrizeOptionDto (standalone nested DTO)
// ---------------------------------------------------------------------------
describe('CreatePrizeOptionDto', () => {
  async function validatePrize(plain: Record<string, unknown>) {
    const errors = await validate(plainToInstance(CreatePrizeOptionDto, plain));
    return errors;
  }

  it('passes with all valid fields', async () => {
    const errors = await validatePrize(validPrize());
    expect(errors).toHaveLength(0);
  });

  it('fails when name is missing', async () => {
    const plain = validPrize();
    delete plain['name'];
    const errors = await validatePrize(plain);
    expect(errors.some(e => e.property === 'name')).toBe(true);
  });

  it('fails when imageUrl does not match CDN pattern', async () => {
    const errors = await validatePrize(validPrize({ imageUrl: 'https://evil.com/steal.jpg' }));
    const err = errors.find(e => e.property === 'imageUrl');
    expect(err).toBeDefined();
    expect(Object.keys(err!.constraints ?? {})).toContain('matches');
  });

  it('fails when category is not a valid PrizeCategory enum value', async () => {
    const errors = await validatePrize(validPrize({ category: 'INVALID' }));
    const err = errors.find(e => e.property === 'category');
    expect(err).toBeDefined();
    expect(Object.keys(err!.constraints ?? {})).toContain('isEnum');
  });

  it('fails when value is a number instead of string', async () => {
    const errors = await validatePrize(validPrize({ value: 1000 }));
    const err = errors.find(e => e.property === 'value');
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CastVoteDto
// ---------------------------------------------------------------------------
describe('CastVoteDto', () => {
  async function validateVote(plain: Record<string, unknown>) {
    const errors = await validate(plainToInstance(CastVoteDto, plain));
    return errors;
  }

  it('passes with a valid MongoDB ObjectId', async () => {
    const errors = await validateVote({ prizeId: '507f1f77bcf86cd799439011' });
    expect(errors).toHaveLength(0);
  });

  it('fails when prizeId is an invalid ObjectId string', async () => {
    const errors = await validateVote({ prizeId: 'not-an-object-id' });
    const err = errors.find(e => e.property === 'prizeId');
    expect(err).toBeDefined();
    expect(Object.keys(err!.constraints ?? {})).toContain('isMongoId');
  });

  it('fails when prizeId is absent', async () => {
    const errors = await validateVote({});
    const err = errors.find(e => e.property === 'prizeId');
    expect(err).toBeDefined();
  });

  it('fails when prizeId is an empty string', async () => {
    const errors = await validateVote({ prizeId: '' });
    const err = errors.find(e => e.property === 'prizeId');
    expect(err).toBeDefined();
  });

  it('fails when prizeId is a number', async () => {
    const errors = await validateVote({ prizeId: 12345 });
    const err = errors.find(e => e.property === 'prizeId');
    expect(err).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// UpdateCycleDto
// ---------------------------------------------------------------------------
describe('UpdateCycleDto', () => {
  async function validateUpdate(plain: Record<string, unknown>) {
    const errors = await validate(plainToInstance(UpdateCycleDto, plain), { whitelist: true });
    return errors;
  }

  describe('all fields optional', () => {
    it('passes with an empty DTO (all optional)', async () => {
      const errors = await validateUpdate({});
      expect(errors).toHaveLength(0);
    });
  });

  describe('partial updates', () => {
    it('passes when only name is provided', async () => {
      const errors = await validateUpdate({ name: 'New Name' });
      expect(errors).toHaveLength(0);
    });

    it('passes when only minimumBags is provided', async () => {
      const errors = await validateUpdate({ minimumBags: 10 });
      expect(errors).toHaveLength(0);
    });

    it('passes when only prizes are updated (with 2 valid prizes)', async () => {
      const errors = await validateUpdate({ prizes: [validPrize(), validPrize()] });
      expect(errors).toHaveLength(0);
    });

    it('passes a full valid partial update with multiple fields', async () => {
      const errors = await validateUpdate({
        name: 'Updated Cycle',
        minimumBags: 100,
        recipientCount: 10,
        communityGoalTarget: 50000,
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid types', () => {
    it('fails when name is a number', async () => {
      const errors = await validateUpdate({ name: 123 });
      const err = errors.find(e => e.property === 'name');
      expect(err).toBeDefined();
    });

    it('fails when cycleStartDate is not a valid ISO date string', async () => {
      const errors = await validateUpdate({ cycleStartDate: 'not-a-date' });
      const err = errors.find(e => e.property === 'cycleStartDate');
      expect(err).toBeDefined();
    });

    it('fails when minimumBags = 0 (Min=1)', async () => {
      const errors = await validateUpdate({ minimumBags: 0 });
      expect(errors.some(e => e.property === 'minimumBags')).toBe(true);
    });

    it('fails when minimumBags = 501 (Max=500)', async () => {
      const errors = await validateUpdate({ minimumBags: 501 });
      expect(errors.some(e => e.property === 'minimumBags')).toBe(true);
    });

    it('fails when recipientCount = 51 (Max=50)', async () => {
      const errors = await validateUpdate({ recipientCount: 51 });
      expect(errors.some(e => e.property === 'recipientCount')).toBe(true);
    });

    it('fails when communityGoalTarget = 0 (Min=1)', async () => {
      const errors = await validateUpdate({ communityGoalTarget: 0 });
      expect(errors.some(e => e.property === 'communityGoalTarget')).toBe(true);
    });

    it('fails when prizes has only 1 item (ArrayMinSize=2)', async () => {
      const errors = await validateUpdate({ prizes: [validPrize()] });
      const prizeError = errors.find(e => e.property === 'prizes');
      expect(prizeError).toBeDefined();
      expect(Object.keys(prizeError!.constraints ?? {})).toContain('arrayMinSize');
    });

    it('fails when prizes has 11 items (ArrayMaxSize=10)', async () => {
      const errors = await validateUpdate({
        prizes: Array.from({ length: 11 }, () => validPrize()),
      });
      const prizeError = errors.find(e => e.property === 'prizes');
      expect(prizeError).toBeDefined();
      expect(Object.keys(prizeError!.constraints ?? {})).toContain('arrayMaxSize');
    });
  });
});
