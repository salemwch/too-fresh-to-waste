/**
 * Delivery fee - re-exported from `@foodwaste/shared`.
 *
 * The implementation lives there, not here, because the mobile checkout screen
 * quotes this fee and the backend charges it. They must agree, and they
 * previously did not: mobile carried its own flat `DELIVERY_FEE_TND = 4` with a
 * comment reading "change both together". When the backend moved to distance
 * bands the app kept quoting 4 TND, so a customer would have seen one total and
 * been charged another.
 *
 * This file stays as the import path the orders module already uses, so the
 * move cost no call-site churn.
 */

export {
  DEFAULT_DRIVER_SHARE,
  DELIVERY_FEE_AT_LIMIT,
  DELIVERY_FEE_BANDS,
  DELIVERY_FEE_STEP_FEE,
  DELIVERY_FEE_STEP_KM,
  DELIVERY_FEE_TABLE_LIMIT_KM,
  calculateDeliveryFee,
  splitDeliveryFee,
} from '@foodwaste/shared';

export type { DeliveryFeeBand, DeliveryFeeSplit } from '@foodwaste/shared';
