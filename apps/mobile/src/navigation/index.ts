/**
 * Navigation - Index
 * Central export point for all navigation components and types
 */

// Navigators
export { RootNavigator } from './RootNavigator';
export { AuthStack } from './AuthStack';
export { MainStack } from './MainStack';
export { TabNavigator } from './TabNavigator';
export { HomeStack } from './HomeStack';
export { SearchStack } from './SearchStack';
export { FavoritesStack } from './FavoritesStack';

// Shared header config
export { getDefaultScreenOptions, getModalScreenOptions, getAuthScreenOptions } from './headerConfig';

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
  HomeStackParamList,
  SearchStackParamList,
  FavoritesStackParamList,
  OrdersStackParamList,
  ProfileStackParamList,

  // Auth Navigation Props
  LoginScreenNavigationProp,
  RegisterScreenNavigationProp,
  ForgotPasswordScreenNavigationProp,
  VerifyEmailScreenNavigationProp,
  MFAVerificationScreenNavigationProp,

  // Main Stack Navigation Props
  MainStackNavigationProp,
  OfferDetailsScreenNavigationProp,
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
