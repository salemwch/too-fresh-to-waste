/**
 * TypeScript declarations for image imports in React Native
 * @see https://reactnative.dev/docs/images
 */

declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

declare module '*.jpeg' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

declare module '*.gif' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

declare module '*.webp' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}
