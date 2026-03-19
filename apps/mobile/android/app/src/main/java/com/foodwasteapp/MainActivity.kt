package com.foodwasteapp

import android.os.Bundle
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "FoodWasteApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Configure react-native-gesture-handler
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    // Edge-to-edge: app draws behind status bar and navigation bar.
    // react-native-safe-area-context then reports correct insets so the
    // NativeStack header sits below the status bar.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    // Use dark icons on both bars (app has light backgrounds throughout).
    // Without this Android adds a white scrim at the top of the nav bar,
    // which appears as a 3-4px white line above the system buttons.
    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightStatusBars = true
      isAppearanceLightNavigationBars = true
    }
    super.onCreate(null)
  }
}
