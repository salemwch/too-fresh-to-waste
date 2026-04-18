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
}

/**
 * Auth Stack Param List
 * Unauthenticated screens
 */
export interface AuthStackParamList extends Record<string, object | undefined> {
  Welcome: undefined;
  Login: undefined;
  Register: { referralCode?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string; token: string };
  // email is optional: Universal Link magic links carry only the token.
  VerifyEmail: { email?: string; token?: string };
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

  // Order Modals (OrderDetails moved to OrdersStack)
  OrderHistory: undefined;
  Checkout: { offerId: string; quantity?: number };

  // Loyalty
  Loyalty: undefined;

  // Leaderboard
  Leaderboard: undefined;

  // Profile Modals (EditProfile moved to ProfileStack)
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

type OfferDetailsScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'OfferDetails'
>;

/**
 * Navigation Props for OrdersStack Screens (nested inside Orders tab)
 */
export type OrdersListScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<OrdersStackParamList, 'OrdersList'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Orders'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

type OrderDetailsFromOrdersStackNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<OrdersStackParamList, 'OrderDetails'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Orders'>,
    NativeStackNavigationProp<MainStackParamList>
  >
>;

type CheckoutScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Checkout'>;

/**
 * Navigation Props for Tab Screens
 * Composite navigation prop for accessing parent navigators
 */

/**
 * Generic Tab Navigation Prop
 * Used for components that need to navigate between tabs (e.g., LocationHeader)
 */
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;

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
 * Route Props for Screens with Parameters
 */
export type ResetPasswordRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;
export type VerifyEmailRouteProp = RouteProp<AuthStackParamList, 'VerifyEmail'>;
export type VerifyPhoneRouteProp = RouteProp<AuthStackParamList, 'VerifyPhone'>;
export type MFAVerificationRouteProp = RouteProp<AuthStackParamList, 'MFAVerification'>;
type OfferDetailsRouteProp = RouteProp<MainStackParamList, 'OfferDetails'>;
type OrderDetailsRouteProp = RouteProp<OrdersStackParamList, 'OrderDetails'>;
type CheckoutRouteProp = RouteProp<MainStackParamList, 'Checkout'>;
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
  navigation: OrderDetailsFromOrdersStackNavigationProp;
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
