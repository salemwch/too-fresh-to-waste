/**
 * TypeScript declarations for SVG imports via react-native-svg-transformer
 * @see https://github.com/kristerkari/react-native-svg-transformer#using-typescript
 */

declare module '*.svg' {
  import type { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
