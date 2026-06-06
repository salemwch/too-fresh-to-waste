package com.toofreshtowaste.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "FoodWasteApp"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Cache the intent so Linking.getInitialURL() can retrieve it later.
    // In RN 0.81 Bridgeless mode, onNewIntent may fire before the React
    // context is ready — the URL event is dropped. setIntent() preserves
    // the deep link data so the JS-side recovery mechanism can pick it up.
    setIntent(intent)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightStatusBars = true
      isAppearanceLightNavigationBars = true
    }
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
