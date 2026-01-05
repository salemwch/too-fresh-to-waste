/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';

// IMPORTANT: This name must match MainActivity.kt getMainComponentName()
// MainActivity.kt:15 returns "FoodWasteApp"
// Using package.json "name" field (@foodwaste/mobile) causes:
// "Invariant Violation: 'FoodWasteApp' has not been registered"
const appName = 'FoodWasteApp';

AppRegistry.registerComponent(appName, () => App);
