/**
 * Shared Icon Types
 * Common types for all icon-related components (Icon, Input, Button, etc.)
 */

import type React from 'react';

/**
 * All supported icon families from @react-native-vector-icons/* scoped packages
 * Complete list of available icon libraries
 */
export type IconFamily =
  | 'AntDesign'
  | 'Entypo'
  | 'EvilIcons'
  | 'Feather'
  | 'FontAwesome'
  | 'FontAwesome5'
  | 'FontAwesome6'
  | 'Fontisto'
  | 'Foundation'
  | 'Ionicons'
  | 'MaterialCommunityIcons'
  | 'MaterialIcons'
  | 'Octicons'
  | 'SimpleLineIcons'
  | 'Zocial';

/**
 * Common props interface that all icon components accept
 * Used for type-safe icon rendering across different families
 * Extended to match react-native-vector-icons actual props
 */
export interface IconComponentProps {
  readonly name: string;
  readonly size?: number;
  readonly color?: string;
  readonly style?: any;
  readonly suppressHighlighting?: boolean;
}

/**
 * Type alias for icon components from @react-native-vector-icons/* packages
 * Represents any icon component that accepts standard icon props
 */
export type IconComponent = React.ComponentType<IconComponentProps>;
