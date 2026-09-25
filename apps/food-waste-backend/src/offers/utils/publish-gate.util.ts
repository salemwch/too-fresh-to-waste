import { ForbiddenException } from '@nestjs/common';
import { EstablishmentStatus } from '@foodwaste/shared';

import { appError, type ErrorCode } from '../../common/errors';

/** The parts of an establishment that decide whether it may publish. */
export interface PublishGateInput {
  status: EstablishmentStatus;
  subscriptionStatus: 'trial' | 'paid' | 'suspended';
}

/**
 * One code per status that blocks publishing, so the merchant is told what
 * blocks them and who unblocks it - in their language, not as a raw enum
 * value. Typed over every non-ACTIVE status: a status added to the enum does
 * not compile until it has a message here.
 */
export const BLOCKED_PUBLISH_CODES: Readonly<
  Record<Exclude<EstablishmentStatus, EstablishmentStatus.ACTIVE>, ErrorCode>
> = {
  [EstablishmentStatus.PENDING]: 'ESTABLISHMENT_PENDING_APPROVAL',
  [EstablishmentStatus.SUSPENDED]: 'ESTABLISHMENT_SUSPENDED',
  [EstablishmentStatus.REJECTED]: 'ESTABLISHMENT_REJECTED',
  [EstablishmentStatus.INACTIVE]: 'ESTABLISHMENT_INACTIVE',
};

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
 * @throws ForbiddenException with the code of the blocking condition. A bare
 *         "forbidden" tells a merchant nothing they can act on.
 */
export function assertCanPublish(establishment: PublishGateInput): void {
  if (establishment.status !== EstablishmentStatus.ACTIVE) {
    throw new ForbiddenException(
      appError(BLOCKED_PUBLISH_CODES[establishment.status], undefined, {
        status: establishment.status,
      }),
    );
  }

  if (establishment.subscriptionStatus === 'suspended') {
    throw new ForbiddenException(appError('TRIAL_EXPIRED'));
  }
}
