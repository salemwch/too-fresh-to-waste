/**
 * Orders Feature - Public API
 * Barrel exports for clean imports
 */

// Hooks
export { useCreateOrder } from './hooks/useCreateOrder';
export { useOrders } from './hooks/useOrders';

// Components
export { PhoneVerificationModal } from './components/PhoneVerificationModal';
export { OrderCard } from './components/OrderCard';

// Services
export { ordersService } from './services/ordersService';

// Types
export type {
  CreateOrderDto,
  Order,
  OrderItemDto,
  PickupTimeSlotDto,
  PopulatedEstablishment,
  PaginatedOrdersResponse,
  PhoneVerificationRequiredError,
} from './types/order.types';
export {
  OrderStatus,
  PaymentStatus,
  isPhoneVerificationRequired,
  isActiveOrder,
  isHistoryOrder,
  getEstablishmentName,
  getEstablishmentImage,
  getOfferImage,
} from './types/order.types';

// Screens
export { CheckoutScreen } from './screens/CheckoutScreen';
