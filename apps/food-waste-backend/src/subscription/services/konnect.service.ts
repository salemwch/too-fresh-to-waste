import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface KonnectInitPaymentParams {
  amount: number;
  firstName: string;
  lastName: string;
  email: string;
  orderId: string;
  description: string;
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

@Injectable()
export class KonnectService {
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

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.walletId);
  }

  async initPayment(params: KonnectInitPaymentParams): Promise<KonnectPaymentResponse> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Payment service is not configured. Please contact support.',
      );
    }

    const body = {
      receiverWalletId: this.walletId,
      amount: params.amount,
      token: params.orderId,
      type: 'immediate',
      description: params.description,
      acceptedPaymentMethods: ['bank_card', 'e-DINAR'],
      lifespan: 30,
      checkoutForm: true,
      addPaymentFeesToAmount: true,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      silentWebhook: true,
      webhook: this.configService.get<string>(
        'KONNECT_WEBHOOK_URL',
        'http://localhost:3000/api/v1/subscriptions/webhook/konnect',
      ),
      successUrl: this.successUrl,
      failUrl: this.failUrl,
      theme: 'light',
    };

    try {
      const response = await fetch(`${this.apiUrl}/payments/init-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Konnect init-payment failed: ${response.status} — ${errorText}`);
        throw new ServiceUnavailableException('Payment initiation failed. Please try again.');
      }

      const data = (await response.json()) as KonnectPaymentResponse;
      this.logger.log(`Konnect payment initiated: ref=${data.paymentRef}`);
      return data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Konnect API error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Payment service temporarily unavailable.');
    }
  }

  async getPaymentDetails(paymentId: string): Promise<KonnectPaymentDetails> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Payment service is not configured.');
    }

    const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Konnect get-payment failed: ${response.status} — ${errorText}`);
      throw new ServiceUnavailableException('Could not verify payment status.');
    }

    return (await response.json()) as KonnectPaymentDetails;
  }
}
