/**
 * Navigation Types
 * Type-safe navigation definitions for the entire app
 */

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type {
  CompositeNavigationProp,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Root Navigator Param List
 * Top-level navigator that handles auth state
 */
export interface RootNavigatorParamList extends Record<string, object | undefined> {
  AuthStack: NavigatorScreenParams<AuthStackParamList> | undefined;
  MainStack: undefined;
  DriverStack: undefined;
}

/**
 * Auth Stack Param List
 * Unauthenticated screens
 */
export interface AuthStackParamList extends Record<string, object | undefined> {
  Welcome: undefined;
  Onboarding2: undefined;
  Onboarding3: undefined;
  Login: undefined;
  Register: { referralCode?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string; token: string };
  // email is optional: Universal Link magic links carry only the token.
  // status is set by web fallback redirect (foodwaste://verify-email?status=success).
  VerifyEmail: { email?: string; token?: string; status?: string };
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
  ForceChangePassword: undefined;
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

  // Order Modals (OrderDetails moved to OrdersStack)
  OrderHistory: undefined;
  Checkout: { offerId: string; quantity?: number };

  // Loyalty
  Loyalty: undefined;

  // Leaderboard
  Leaderboard: undefined;

  // Donation Impact
  DonationImpact: undefined;

  // Profile Modals (EditProfile moved to ProfileStack)
  Settings: undefined;
  Privacy: undefined;
  Security: undefined;

  // Establishment Modals
  EstablishmentDetails: { establishmentId: string };
}

/**
 * Orders Stack Param List
 * Nested stack inside Orders tab (list → detail flow)
 */
export interface OrdersStackParamList extends Record<string, object | undefined> {
  OrdersList: undefined;
  OrderDetails: { orderId: string };
}

/**
 * Profile Stack Param List
 * Nested stack inside Profile tab (profile → edit flow)
 */
export interface ProfileStackParamList extends Record<string, object | undefined> {
  ProfileMain: undefined;
  EditProfile: undefined;
  ContactSupport: undefined;
}

/**
 * Driver Stack Param List
 * Driver role navigation (order list → order details → active order)
 */
export interface DriverStackParamList extends Record<string, object | undefined> {
  DriverOrdersList: undefined;
  DriverOrderDetail: { orderId: string };
  DriverActiveOrder: { orderId: string };
}

/**
 * Tab Navigator Param List
 * Bottom tab screens — each tab wraps a NativeStack navigator
 */
export interface TabParamList extends Record<string, object | undefined> {
  Home: undefined;
  Search: { category?: string } | undefined;
  Favorites: undefined;
  Orders: undefined;
  Profile: undefined;
}

/**
 * Home Stack Param List
 * NativeStack wrapper inside Home tab
 */
export interface HomeStackParamList extends Record<string, object | undefined> {
  HomeMain: undefined;
}

/**
 * Search Stack Param List
 * NativeStack wrapper inside Search tab
 */
export interface SearchStackParamList extends Record<string, object | undefined> {
  SearchMain: undefined;
}

/**
 * Favorites Stack Param List
 * NativeStack wrapper inside Favorites tab
 */
export interface FavoritesStackParamList extends Record<string, object | undefined> {
  FavoritesMain: undefined;
}

/**
 * Navigation Props for Auth Stack Screens
 */
export type WelcomeScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
export type Onboarding2ScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Onboarding2'
>;
export type Onboarding3ScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Onboarding3'
>;

export type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export type RegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;

export type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

type ResetPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ResetPassword'
>;

export type VerifyEmailScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'VerifyEmail'
>;

type VerifyPhoneScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'VerifyPhone'>;

export type MFAVerificationScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'MFAVerification'
>;

/**
 * Navigation Props for Main Stack Screens
 */
export type MainStackNavigationProp = NativeStackNavigationProp<MainStackParamList>;

export type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Home'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

export type SearchScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<SearchStackParamList, 'SearchMain'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Search'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

export type FavoritesScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<FavoritesStackParamList, 'FavoritesMain'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Favorites'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

export type OrdersScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<OrdersStackParamList, 'OrdersList'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Orders'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

export type ProfileScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Profile'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

export type EditProfileScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Profile'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

/**
 * Navigation Props for Driver Stack Screens
 */
export type DriverOrdersListNavigationProp = NativeStackNavigationProp<
  DriverStackParamList,
  'DriverOrdersList'
>;

export type DriverOrderDetailNavigationProp = NativeStackNavigationProp<
  DriverStackParamList,
  'DriverOrderDetail'
>;

export type DriverActiveOrderNavigationProp = NativeStackNavigationProp<
  DriverStackParamList,
  'DriverActiveOrder'
>;

/**
 * Route Props for Screens with Parameters
 */
type ResetPasswordRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;
export type VerifyEmailRouteProp = RouteProp<AuthStackParamList, 'VerifyEmail'>;
type VerifyPhoneRouteProp = RouteProp<AuthStackParamList, 'VerifyPhone'>;
export type MFAVerificationRouteProp = RouteProp<AuthStackParamList, 'MFAVerification'>;
export type DriverOrderDetailRouteProp = RouteProp<DriverStackParamList, 'DriverOrderDetail'>;
export type DriverActiveOrderRouteProp = RouteProp<DriverStackParamList, 'DriverActiveOrder'>;

/**
 * Combined Navigation & Route Props
 * Helper types for screens that need both navigation and route props
 */
export interface ResetPasswordScreenProps {
  navigation: ResetPasswordScreenNavigationProp;
  route: ResetPasswordRouteProp;
}

export interface VerifyPhoneScreenProps {
  navigation: VerifyPhoneScreenNavigationProp;
  route: VerifyPhoneRouteProp;
}
