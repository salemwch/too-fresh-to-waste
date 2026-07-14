'use client';

import { ReviewsPage } from '@/components/dashboard/merchant/reviews/reviews-page';
import { ProGate } from '@/components/dashboard/merchant/pro-gate';

export default function MerchantReviewsPage() {
  return (
    <ProGate>
      <ReviewsPage />
    </ProGate>
  );
}
