/**
 * Type declarations for @lottiefiles/dotlottie-react-native
 *
 * This package has TypeScript types but they're not being resolved correctly
 * with the current moduleResolution setting. This declaration file provides
 * the necessary types.
 */

declare module '@lottiefiles/dotlottie-react-native' {
  import type { ViewStyle } from 'react-native';
  import type React from 'react';

  export interface DotLottieAnimationProps {
    source: string | { uri: string } | number;
    autoplay?: boolean;
    loop?: boolean;
    speed?: number;
    style?: ViewStyle;
    resizeMode?: 'cover' | 'contain' | 'center';
    onAnimationFinish?: () => void;
    onAnimationLoop?: () => void;
    testID?: string;
  }

  export const DotLottieAnimation: React.FC<DotLottieAnimationProps>;

  export default DotLottieAnimation;
}
