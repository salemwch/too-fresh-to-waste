export interface TwilioWebhookData {
  MessageSid: string;
  MessageStatus:
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'failed'
    | 'undelivered'
    | 'receiving'
    | 'received';
  ErrorCode?: string;
  ErrorMessage?: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  NumSegments?: string;
  Price?: string;
  PriceUnit?: string;
  ApiVersion?: string;
  NumMedia?: string;
}

export interface TwilioMessageResponse {
  sid: string;
  to: string;
  from: string;
  status: string;
  body: string;
  dateCreated: Date | null;
  dateSent: Date | null;
  dateUpdated: Date | null;
  errorCode: number | null;
  errorMessage: string | null;
  numMedia: string;
  numSegments: string;
  price: string | null;
  priceUnit: string | null;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  uri: string;
  accountSid: string;
  apiVersion: string;
  messagingServiceSid: string | null;
  subresourceUris: Record<string, string>;
}

export interface OrderData {
  orderId: string;
  establishmentName: string;
  pickupCode: string;
  establishmentAddress?: string;
  pickupTime?: string;
}

export interface ReminderData {
  orderId: string;
  establishmentName: string;
  timeLeft: string;
  establishmentAddress?: string;
}

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string | undefined;
  country?: string | undefined;
  errorMessage?: string | undefined;
}

export interface OptOutStatus {
  phoneNumber: string;
  isOptedOut: boolean;
  optedOutAt?: Date;
  reason?: string;
}

export interface SmsMetrics {
  sent: number;
  delivered: number;
  failed: number;
  totalCost: number;
  currency: string;
}
