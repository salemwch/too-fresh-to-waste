export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

type PaymentMethod = 'cash' | 'card' | 'smt_gateway' | 'wallet';

export interface MerchantPayment {
  id: string;
  orderId: string;
  orderNumber?: string;
  customerId: string;
  customerName?: string;
  merchantId: string;
  establishmentId: string;
  establishmentName?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  description?: string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListResponse {
  payments: MerchantPayment[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface PaymentQueryFilters {
  status?: PaymentStatus;
  after?: string;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  currency: string;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;
}
