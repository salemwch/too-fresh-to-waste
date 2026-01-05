/**
 * Navigation Types
 * Type-safe navigation definitions for the entire app
 */

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Root Navigator Param List
 * Top-level navigator that handles auth state
 */
export interface RootNavigatorParamList extends Record<string, object | undefined> {
  AuthStack: { screen?: keyof AuthStackParamList; params?: any } | undefined;
  MainStack: undefined;
}

/**
 * Auth Stack Param List
 * Unauthenticated screens
 */
export interface AuthStackParamList extends Record<string, object | undefined> {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string; token: string };
  VerifyEmail: { email: string; token?: string };
  VerifyPhone: {
    phoneNumber?: string;
    fromEmailVerification?: boolean;
    requiresPhoneSetup?: boolean;
    onVerificationComplete?: () => void;
  };
  MFAVerification: {
    mfaToken: string;
    userId: string;
  };
}

/**
 * Main Stack Param List
 * Authenticated screens and modals
 */
export interface MainStackParamList extends Record<string, object | undefined> {
  // Tab Navigator
  MainTabs: undefined;

  // Offer Modals
  OfferDetails: { offerId: string };

  // Order Modals
  OrderDetails: { orderId: string };
  OrderHistory: undefined;
  Checkout: { offerId: string };

  // Profile Modals
  EditProfile: undefined;
  Settings: undefined;
  Privacy: undefined;
  Security: undefined;

  // Establishment Modals
  EstablishmentDetails: { establishmentId: string };

  // Map Modals
  NearbyOffers:
    | {
        latitude?: number;
        longitude?: number;
        initialRadius?: number;
      }
    | undefined;
}

/**
 * Tab Navigator Param List
 * Bottom tab screens
 */
export interface TabParamList extends Record<string, object | undefined> {
  Home: undefined;
  Search: { category?: string } | undefined;
  Favorites: undefined;
  Orders: undefined;
  Profile: undefined;
}

/**
 * Navigation Props for Auth Stack Screens
 */
export type WelcomeScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export type RegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;

export type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

export type ResetPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ResetPassword'
>;

export type VerifyEmailScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'VerifyEmail'
>;

export type VerifyPhoneScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'VerifyPhone'
>;

export type MFAVerificationScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'MFAVerification'
>;

/**
 * Navigation Props for Main Stack Screens
 */
export type MainStackNavigationProp = NativeStackNavigationProp<MainStackParamList>;

export type OfferDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OfferDetails'
>;

export type OrderDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OrderDetails'
>;

export type CheckoutScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'Checkout'
>;

/**
 * Navigation Props for Tab Screens
 * Composite navigation prop for accessing parent navigators
 */
export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type SearchScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Search'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type FavoritesScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Favorites'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type OrdersScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Orders'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<MainStackParamList>
>;

/**
 * Route Props for Screens with Parameters
 */
export type ResetPasswordRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;
export type VerifyEmailRouteProp = RouteProp<AuthStackParamList, 'VerifyEmail'>;
export type VerifyPhoneRouteProp = RouteProp<AuthStackParamList, 'VerifyPhone'>;
export type MFAVerificationRouteProp = RouteProp<AuthStackParamList, 'MFAVerification'>;
export type OfferDetailsRouteProp = RouteProp<MainStackParamList, 'OfferDetails'>;
export type OrderDetailsRouteProp = RouteProp<MainStackParamList, 'OrderDetails'>;
export type CheckoutRouteProp = RouteProp<MainStackParamList, 'Checkout'>;
export type EstablishmentDetailsRouteProp = RouteProp<MainStackParamList, 'EstablishmentDetails'>;
export type NearbyOffersRouteProp = RouteProp<MainStackParamList, 'NearbyOffers'>;

/**
 * Combined Navigation & Route Props
 * Helper types for screens that need both navigation and route props
 */
export interface ResetPasswordScreenProps {
  navigation: ResetPasswordScreenNavigationProp;
  route: ResetPasswordRouteProp;
}

export interface VerifyEmailScreenProps {
  navigation: VerifyEmailScreenNavigationProp;
  route: VerifyEmailRouteProp;
}

export interface VerifyPhoneScreenProps {
  navigation: VerifyPhoneScreenNavigationProp;
  route: VerifyPhoneRouteProp;
}

export interface MFAVerificationScreenProps {
  navigation: MFAVerificationScreenNavigationProp;
  route: MFAVerificationRouteProp;
}

export interface OfferDetailsScreenProps {
  navigation: OfferDetailsScreenNavigationProp;
  route: OfferDetailsRouteProp;
}

export interface OrderDetailsScreenProps {
  navigation: OrderDetailsScreenNavigationProp;
  route: OrderDetailsRouteProp;
}

export interface CheckoutScreenProps {
  navigation: CheckoutScreenNavigationProp;
  route: CheckoutRouteProp;
}

/**
 * Navigation Utilities
 */
export type NavigateFunction = <T extends keyof MainStackParamList>(
  screen: T,
  params?: MainStackParamList[T],
) => void;

export type AuthNavigateFunction = <T extends keyof AuthStackParamList>(
  screen: T,
  params?: AuthStackParamList[T],
) => void;
