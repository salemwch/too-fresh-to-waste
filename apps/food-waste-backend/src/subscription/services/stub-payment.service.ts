import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import {
  KonnectService,
  KonnectInitPaymentParams,
  KonnectPaymentOverrides,
  KonnectPaymentResponse,
  KonnectPaymentDetails,
} from './konnect.service';

import { appError } from '../../common/errors';
/** Marks a reference as stub-issued: `stub-<millimes>-<digest>`. */
const STUB_REF_PATTERN = /^stub-(\d+)-([0-9a-f]{12})$/;

/**
 * Deterministic in-process stand-in for Konnect, used by load and concurrency
 * tests. Activated only by `PAYMENT_PROVIDER=stub`, which the provider factory
 * refuses to honour when `NODE_ENV=production`.
 *
 * It extends KonnectService rather than implementing a parallel interface, so
 * the compiler enforces that it keeps the same contract: if the real client
 * gains a method or changes a signature, this stops compiling instead of
 * silently diverging from the thing it stands in for.
 *
 * **Why it is not a canned "completed" response.** The webhook validates the
 * amount it gets back against `toMillimes(attempt.amount)` and, on a mismatch,
 * takes the anomalous branch — flagging the attempt and opening a refund
 * request rather than confirming the order. A stub returning a fixed amount
 * would therefore drive every test down the failure path while looking like it
 * worked. The amount is instead carried *in the reference itself*, so
 * `getPaymentDetails` can reconstruct it exactly, for any reference, with no
 * stored state:
 *
 *   initPayment({ amount: 12500 })  ->  paymentRef "stub-12500-a3f9c1d0e7b2"
 *   getPaymentDetails("stub-12500-a3f9c1d0e7b2")  ->  payment.amount 12500
 *
 * **`amount` arrives in millimes, already converted.** `initOrderPayment` calls
 * `toMillimes(order.pricing.total)` before handing it over, and the real client
 * passes it straight to Konnect. Converting again here inflated every amount by
 * 1000x, and because the webhook compares what the provider reports against
 * `toMillimes(attempt.amount)`, the mismatch sent each payment down the
 * anomalous branch — flagged, refund request opened, order never confirmed.
 * That is the precise failure this stub exists to avoid, so the value is stored
 * exactly as received.
 *
 * Being stateless is what makes it usable under load: k6 runs many VUs across
 * requests, and CI restarts the process between suites, so anything held in a
 * Map would be lost or unshared. The digest is derived from the order id, so a
 * given order always produces the same reference — replaying a webhook in a
 * concurrency test hits the identical code path the real provider would.
 */
@Injectable()
export class StubPaymentService extends KonnectService {
  private readonly stubLogger = new Logger(StubPaymentService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  override onModuleInit(): void {
    this.stubLogger.warn(
      'PAYMENT_PROVIDER=stub — payments are simulated in-process. ' +
        'No money moves and no request reaches Konnect. Never valid in production.',
    );
  }

  /** Always configured: there are no credentials to be missing. */
  override isConfigured(): boolean {
    return true;
  }

  // `async` with nothing to await. The base class returns a Promise and the
  // repo's promise-function-async rule requires async on anything that does, so
  // require-await is disabled here specifically: the whole point of the stub is
  // that it does no I/O. Throwing from an async method surfaces as a rejection,
  // matching the real client's behaviour on a failed HTTP call.
  // eslint-disable-next-line require-await
  override async initPayment(
    params: KonnectInitPaymentParams,
    _overrides?: KonnectPaymentOverrides,
  ): Promise<KonnectPaymentResponse> {
    // The real client rejects a non-positive amount at the API boundary; keep
    // the same failure mode so tests cannot pass here and fail in production.
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException(appError('PAYMENT_AMOUNT_INVALID'));
    }

    // Already millimes — see the class comment. Konnect's API takes an integer
    // number of millimes, so a fractional value here means a caller has not
    // converted and would be silently rounded rather than caught.
    if (!Number.isInteger(params.amount)) {
      throw new BadRequestException(appError('PAYMENT_AMOUNT_INVALID'));
    }

    const millimes = params.amount;
    const digest = createHash('sha256').update(params.orderId).digest('hex').slice(0, 12);
    const paymentRef = `stub-${millimes}-${digest}`;

    // A well-formed URL a client could open. Nothing serves it — the tests
    // drive completion by calling the webhook, exactly as Konnect would.
    const payUrl = `${this.stubBaseUrl()}/payments/stub/${paymentRef}`;

    this.stubLogger.log(
      `Stub payment initialised for order ${params.orderId}: ${paymentRef} (${millimes} millimes)`,
    );

    return { payUrl, paymentRef };
  }

  // eslint-disable-next-line require-await
  override async getPaymentDetails(paymentId: string): Promise<KonnectPaymentDetails> {
    const match = STUB_REF_PATTERN.exec(paymentId);

    // An unrecognised reference throws, which is what the real client does for
    // a non-2xx lookup. The webhook treats that as "cannot verify" and returns
    // without settling — the behaviour we want a bad reference to produce.
    if (!match) {
      throw new BadRequestException(appError('PAYMENT_NOT_FOUND'));
    }

    const millimes = Number.parseInt(match[1] as string, 10);
    const digest = match[2] as string;

    return {
      payment: {
        id: `stub-pay-${digest}`,
        amount: millimes,
        status: 'completed',
        transactions: [
          {
            id: `stub-txn-${digest}`,
            type: 'card',
            amount: millimes,
          },
        ],
      },
    };
  }

  private stubBaseUrl(): string {
    return this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }
}
