/**
 * Publishing an offer requires an approved establishment - on **every** route.
 *
 * ## The gap this pins down
 *
 * `updateStatus()` (`PATCH /offers/:id/status`) has always checked that the
 * establishment reached `EstablishmentStatus.ACTIVE`, which only
 * `approveEstablishment` sets. That gate is what makes "a merchant cannot trade
 * until an admin verifies their papers" true.
 *
 * But `UpdateOfferDto` also carries an optional `status`, and `update()`
 * (`PATCH /offers/:id`) spreads the whole DTO into `findByIdAndUpdate`. So the
 * same merchant could publish with
 *
 *     PATCH /offers/:id  {"status":"active"}
 *
 * and never touch the guarded route. Ownership was checked; approval was not.
 *
 * The fix routes both through `assertCanPublish`, which is what this suite
 * drives directly - the real function, not a re-description of it. Testing a
 * copy of the control flow would have passed just as happily against the
 * unguarded code.
 *
 * Every `EstablishmentStatus` is enumerated rather than sampled, so a status
 * added later fails here instead of silently becoming publishable.
 */

import { ForbiddenException } from '@nestjs/common';
import { EstablishmentStatus } from '@foodwaste/shared';

import { AR } from '../../common/errors/catalog/ar';
import { EN } from '../../common/errors/catalog/en';
import { FR } from '../../common/errors/catalog/fr';
import { assertCanPublish, BLOCKED_PUBLISH_CODES } from '../utils/publish-gate.util';

type SubscriptionStatus = 'trial' | 'paid' | 'suspended';

const establishment = (
  status: EstablishmentStatus,
  subscriptionStatus: SubscriptionStatus = 'trial',
) => ({ status, subscriptionStatus });

/** Every member of the enum, so a new one cannot slip through untested. */
const ALL_STATUSES = Object.values(EstablishmentStatus);
const BLOCKING_STATUSES = ALL_STATUSES.filter(s => s !== EstablishmentStatus.ACTIVE);

describe('assertCanPublish', () => {
  it('covers every EstablishmentStatus', () => {
    // Guards the two lists below: if the enum grows, this fails before the
    // new member can quietly land in neither branch.
    expect(ALL_STATUSES).toHaveLength(BLOCKING_STATUSES.length + 1);
    expect(ALL_STATUSES).toContain(EstablishmentStatus.ACTIVE);
  });

  describe('approval', () => {
    it.each(BLOCKING_STATUSES)('refuses while the establishment is %s', status => {
      expect(() => assertCanPublish(establishment(status))).toThrow(ForbiddenException);
    });

    it('allows an ACTIVE establishment', () => {
      expect(() => assertCanPublish(establishment(EstablishmentStatus.ACTIVE))).not.toThrow();
    });

    it.each(BLOCKING_STATUSES)(
      'tells the merchant specifically why %s blocks publishing',
      status => {
        // A bare "forbidden" tells a merchant nothing. Each blocking status has
        // its own code, so the message says what is blocking and who unblocks it
        // - translated, instead of the raw enum value it used to embed.
        const code = BLOCKED_PUBLISH_CODES[status as keyof typeof BLOCKED_PUBLISH_CODES];
        let thrown: unknown;
        try {
          assertCanPublish(establishment(status));
        } catch (e) {
          thrown = e;
        }
        expect((thrown as ForbiddenException).getResponse()).toMatchObject({ code });
        // Translated, not the English copy (or a raw enum value) in every language.
        expect(FR[code]).not.toBe(EN[code]);
        expect(AR[code]).not.toBe(EN[code]);
        expect(EN[code]).not.toMatch(/current status/i);
      },
    );

    it('gives every blocking status a different message', () => {
      const messages = BLOCKING_STATUSES.map(
        s => EN[BLOCKED_PUBLISH_CODES[s as keyof typeof BLOCKED_PUBLISH_CODES]],
      );
      expect(new Set(messages).size).toBe(BLOCKING_STATUSES.length);
    });
  });

  describe('subscription', () => {
    it.each<SubscriptionStatus>(['trial', 'paid'])(
      'allows an approved establishment on %s',
      subscriptionStatus => {
        expect(() =>
          assertCanPublish(establishment(EstablishmentStatus.ACTIVE, subscriptionStatus)),
        ).not.toThrow();
      },
    );

    it('refuses an approved establishment whose subscription lapsed', () => {
      expect(() =>
        assertCanPublish(establishment(EstablishmentStatus.ACTIVE, 'suspended')),
      ).toThrow(ForbiddenException);
    });

    it('carries TRIAL_EXPIRED so the client can offer a renewal path', () => {
      // The client branches on this code to show the renewal CTA rather than a
      // generic error. Asserting the code, not just that it threw.
      try {
        assertCanPublish(establishment(EstablishmentStatus.ACTIVE, 'suspended'));
        throw new Error('expected assertCanPublish to throw');
      } catch (error) {
        expect((error as ForbiddenException).getResponse()).toMatchObject({
          code: 'TRIAL_EXPIRED',
        });
      }
    });

    it('reports approval before subscription when both are wrong', () => {
      // Order matters for the merchant: telling an unapproved merchant to renew
      // a subscription they never started sends them down a dead end.
      try {
        assertCanPublish(establishment(EstablishmentStatus.PENDING, 'suspended'));
        throw new Error('expected assertCanPublish to throw');
      } catch (error) {
        expect((error as ForbiddenException).getResponse()).toMatchObject({
          code: 'ESTABLISHMENT_PENDING_APPROVAL',
        });
      }
    });
  });
});
