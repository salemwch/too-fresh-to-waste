/**
 * ManualLocationModal Types
 */

import type { ViewStyle } from 'react-native';

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface ManualLocationResult {
  coordinates: LocationCoordinates;
  name: string;
}

export interface ManualLocationModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Called when user selects a location */
  onLocationSelect: (location: ManualLocationResult) => void;
  /** Initial search query */
  initialQuery?: string;
  /** Container style override */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}
