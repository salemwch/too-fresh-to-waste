/**
 * Navigation - Index
 * Central export point for all navigation components and types
 */

// Navigators
export { RootNavigator } from './RootNavigator';
export { AuthStack } from './AuthStack';
export { MainStack } from './MainStack';
export { TabNavigator } from './TabNavigator';

// Components
export { ProtectedRoute } from './ProtectedRoute';
export type { ProtectedRouteProps } from './ProtectedRoute';

// Types
export type {
  // Param Lists
  RootNavigatorParamList,
  AuthStackParamList,
  MainStackParamList,
  TabParamList,

  // Auth Navigation Props
  LoginScreenNavigationProp,
  RegisterScreenNavigationProp,
  ForgotPasswordScreenNavigationProp,
  VerifyEmailScreenNavigationProp,
  MFAVerificationScreenNavigationProp,

  // Main Stack Navigation Props
  MainStackNavigationProp,
  OfferDetailsScreenNavigationProp,
  OrderDetailsScreenNavigationProp,
  CheckoutScreenNavigationProp,

  // Tab Navigation Props
  HomeScreenNavigationProp,
  SearchScreenNavigationProp,
  FavoritesScreenNavigationProp,
  OrdersScreenNavigationProp,
  ProfileScreenNavigationProp,

  // Route Props
  VerifyEmailRouteProp,
  MFAVerificationRouteProp,
  OfferDetailsRouteProp,
  OrderDetailsRouteProp,
  CheckoutRouteProp,
  EstablishmentDetailsRouteProp,
  NearbyOffersRouteProp,

  // Combined Props
  VerifyEmailScreenProps,
  MFAVerificationScreenProps,
  OfferDetailsScreenProps,
  OrderDetailsScreenProps,
  CheckoutScreenProps,

  // Utility Types
  NavigateFunction,
  AuthNavigateFunction,
} from './types';
