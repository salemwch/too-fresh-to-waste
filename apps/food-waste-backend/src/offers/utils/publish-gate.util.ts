import { ForbiddenException } from '@nestjs/common';
import { EstablishmentStatus } from '@foodwaste/shared';

/** The parts of an establishment that decide whether it may publish. */
export interface PublishGateInput {
  status: EstablishmentStatus;
  subscriptionStatus: 'trial' | 'paid' | 'suspended';
}

/**
 * Whether an establishment is allowed to have a **live** offer.
 *
 * Extracted as a pure function because two routes can publish an offer and they
 * kept drifting:
 *
 * - `PATCH /offers/:id/status` → `updateStatus()`
 * - `PATCH /offers/:id` with `{"status":"active"}` → `update()`
 *
 * The second one had no approval check at all. `UpdateOfferDto` carries an
 * optional `status` and `update()` spreads the DTO straight into
 * `findByIdAndUpdate`, so a merchant whose establishment was still PENDING could
 * publish by choosing the unguarded route. Ownership was verified; approval was
 * not.
 *
 * Keeping the decision here means both call sites share one implementation and
 * a test can drive it directly across every `EstablishmentStatus` rather than
 * re-describing the branches.
 *
 * Draft and cancelled are deliberately **not** gated - a merchant waiting on
 * approval is meant to be able to prepare listings.
 *
 * @throws ForbiddenException naming the blocking condition. A bare "forbidden"
 *         tells a merchant nothing they can act on.
 */
export function assertCanPublish(establishment: PublishGateInput): void {
  if (establishment.status !== EstablishmentStatus.ACTIVE) {
    throw new ForbiddenException(
      'Your establishment must be approved before you can activate offers. ' +
        `Current status: ${establishment.status}`,
    );
  }

  if (establishment.subscriptionStatus === 'suspended') {
    throw new ForbiddenException({
      code: 'TRIAL_EXPIRED',
      message:
        'Your subscription has expired. Please renew your subscription before publishing offers.',
    });
  }
}
