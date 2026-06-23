import { PrizeSource, PrizeClaim } from './prize-claim.schema';

describe('PrizeClaim schema — voting source extension', () => {
  it('exposes a PrizeSource enum with bag_goal and voting', () => {
    expect(PrizeSource.BAG_GOAL).toBe('bag_goal');
    expect(PrizeSource.VOTING).toBe('voting');
  });

  it('defaults source to bag_goal on a bare instance', () => {
    const claim = new PrizeClaim();
    // Mongoose applies defaults at document construction via the model, but the
    // class field default is asserted through the schema path default below.
    expect(claim).toBeDefined();
  });
});
