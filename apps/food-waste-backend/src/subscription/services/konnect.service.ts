import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const KONNECT_TIMEOUT_MS = 8_000;

interface KonnectInitPaymentParams {
  amount: number;
  firstName: string;
  lastName: string;
  email: string;
  orderId: string;
  description: string;
}

export interface KonnectPaymentOverrides {
  successUrl?: string;
  failUrl?: string;
  webhook?: string;
  lifespan?: number;
  addPaymentFeesToAmount?: boolean;
}

interface KonnectPaymentResponse {
  payUrl: string;
  paymentRef: string;
}

interface KonnectPaymentDetails {
  payment: {
    id: string;
    amount: number;
    status: string;
    failedReason?: string;
    transactions?: Array<{
      id: string;
      type: string;
      amount: number;
    }>;
  };
}

export function toMillimes(tndAmount: number): number {
  if (!Number.isFinite(tndAmount) || tndAmount < 0) {
    throw new Error(`Invalid TND amount: ${tndAmount}`);
  }
  return Math.round(tndAmount * 1000);
}

export function fromMillimes(millimes: number): number {
  if (!Number.isInteger(millimes) || millimes < 0) {
    throw new Error(`Invalid millimes amount: ${millimes}`);
  }
  return millimes / 1000;
}

@Injectable()
export class KonnectService implements OnModuleInit {
  private readonly logger = new Logger(KonnectService.name);
  private readonly apiKey: string;
  private readonly walletId: string;
  private readonly apiUrl: string;
  private readonly successUrl: string;
  private readonly failUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('KONNECT_API_KEY', '');
    this.walletId = this.configService.get<string>('KONNECT_WALLET_ID', '');
    this.apiUrl = this.configService.get<string>(
      'KONNECT_API_URL',
      'https://api.preprod.konnect.network/api/v2',
    );
    this.successUrl = this.configService.get<string>(
      'KONNECT_SUBSCRIPTION_SUCCESS_URL',
      'http://localhost:3001/merchant/subscription/success',
    );
    this.failUrl = this.configService.get<string>(
      'KONNECT_SUBSCRIPTION_FAIL_URL',
      'http://localhost:3001/merchant/subscription/failed',
    );
  }

  onModuleInit() {
    const masked = this.apiKey
      ? `${this.apiKey.slice(0, 8)}...${this.apiKey.slice(-4)}`
      : '(empty)';
    this.logger.log(
      `Konnect config — apiKey: ${masked}, walletId: ${this.walletId || '(empty)'}, apiUrl: ${this.apiUrl}`,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.walletId);
  }

  async initPayment(
    params: KonnectInitPaymentParams,
    overrides?: KonnectPaymentOverrides,
  ): Promise<KonnectPaymentResponse> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Payment service is not configured. Please contact support.',
      );
    }

    const body = {
      receiverWalletId: this.walletId,
      amount: params.amount,
      token: 'TND',
      type: 'immediate',
      description: params.description,
      acceptedPaymentMethods: ['bank_card', 'e-DINAR'],
      lifespan: overrides?.lifespan ?? 30,
      checkoutForm: true,
      addPaymentFeesToAmount: overrides?.addPaymentFeesToAmount ?? true,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      orderId: params.orderId,
      silentWebhook: true,
      webhook:
        overrides?.webhook ??
        this.configService.get<string>(
          'KONNECT_WEBHOOK_URL',
          'http://localhost:3000/api/v1/subscriptions/webhook/konnect',
        ),
      successUrl: overrides?.successUrl ?? this.successUrl,
      failUrl: overrides?.failUrl ?? this.failUrl,
      theme: 'light',
    };

    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), KONNECT_TIMEOUT_MS);

      const response = await fetch(`${this.apiUrl}/payments/init-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const tResponse = performance.now();
      this.logger.log(
        `[PERF] Konnect HTTP response: ${(tResponse - t0).toFixed(0)}ms (status=${response.status})`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Konnect init-payment failed: ${response.status} — ${errorText}`);
        throw new ServiceUnavailableException('Payment initiation failed. Please try again.');
      }

      const data = (await response.json()) as KonnectPaymentResponse;
      this.logger.log(
        `[PERF] Konnect total (incl. body parse): ${(performance.now() - t0).toFixed(0)}ms | ref=${data.paymentRef}`,
      );
      return data;
    } catch (error) {
      const elapsed = (performance.now() - t0).toFixed(0);
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        this.logger.error(
          `[PERF] Konnect TIMEOUT after ${elapsed}ms (limit=${KONNECT_TIMEOUT_MS}ms)`,
        );
        throw new ServiceUnavailableException('Payment service timed out. Please try again.');
      }
      this.logger.error(`Konnect API error after ${elapsed}ms: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Payment service temporarily unavailable.');
    }
  }

  async getPaymentDetails(paymentId: string): Promise<KonnectPaymentDetails> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Payment service is not configured.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KONNECT_TIMEOUT_MS);

    const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Konnect get-payment failed: ${response.status} — ${errorText}`);
      throw new ServiceUnavailableException('Could not verify payment status.');
    }

    return (await response.json()) as KonnectPaymentDetails;
  }
}
