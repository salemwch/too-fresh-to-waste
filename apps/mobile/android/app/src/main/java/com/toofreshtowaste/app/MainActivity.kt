package com.toofreshtowaste.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "FoodWasteApp"

  // The (activity, name, fabricEnabled) constructor is deprecated in RN 0.87 and
  // ignores the flag - the New Architecture is always on since 0.82.
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName)

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Cache the intent so Linking.getInitialURL() can retrieve it later.
    // In RN 0.81 Bridgeless mode, onNewIntent may fire before the React
    // context is ready — the URL event is dropped. setIntent() preserves
    // the deep link data so the JS-side recovery mechanism can pick it up.
    setIntent(intent)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // RN already draws edge-to-edge: `edgeToEdgeEnabled=true` (gradle.properties)
    // makes loadReactNative() set its feature flag in MainApplication, and
    // ReactActivityDelegate then runs RN's WindowUtil.enableEdgeToEdge() inside
    // super.onCreate. Play Console cannot see that, and reports "Edge-to-edge
    // may not display for all users" until androidx's enableEdgeToEdge() - the
    // backward-compatible call it names - is present in the app.
    //
    // Called before super.onCreate so RN stays the last writer for bar colours,
    // navigation-bar icons and cutout mode; both apply the same transparent
    // bars. The flag is not affected: it is set from BuildConfig, not here.
    //
    // RN never sets the status-bar icon colour, so this call decides it until
    // ThemedStatusBar mounts. The launch window is light (@color/app_background)
    // and production is light-only, so pin dark icons; SystemBarStyle.auto would
    // follow the system theme and put white icons on the light background.
    //
    // Play will still list Window.setStatusBarColor / setNavigationBarColor and
    // LAYOUT_IN_DISPLAY_CUTOUT_MODE_* as deprecated: they live in this call, in
    // RN's WindowUtil and in Material's BottomSheetDialog, as the API 24-34 path
    // of every backward-compatible edge-to-edge implementation (androidx's own
    // WindowCompat.enableEdgeToEdge included). At targetSdk 35+ on Android 15+
    // they have no effect. Not removable from app code; do not "fix" by
    // stripping them, that gives opaque bars on Android 14 and below.
    enableEdgeToEdge(
        statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
    )
    super.onCreate(null)
    createNotificationChannel()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "tftw_default",
        "Too Fresh To Waste",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Order updates and offers"
        enableVibration(true)
        enableLights(true)
      }
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(channel)
    }
  }
}
