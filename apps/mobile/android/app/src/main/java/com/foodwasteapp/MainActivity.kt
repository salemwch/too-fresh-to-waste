package com.foodwasteapp

import android.os.Bundle
import android.util.Log
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
    super.onCreate(null)

    // TODO: TEMPORARY - Get SMS Retriever hash for production
    // Remove this code after obtaining the hash and updating backend
    if (BuildConfig.DEBUG) {
      try {
        val appSignatures = AppSignatureHelper.getAppSignatures(this)
        Log.d("SMS_HASH", "==============================================")
        Log.d("SMS_HASH", "Your App Hash for SMS Retriever API:")
        appSignatures?.forEach { signature ->
          Log.d("SMS_HASH", signature)
          Log.d("SMS_HASH", "Add this to backend .env: SMS_RETRIEVER_HASH=$signature")
        }
        Log.d("SMS_HASH", "==============================================")
      } catch (e: Exception) {
        Log.e("SMS_HASH", "Failed to get app hash: ${e.message}")
      }
    }
  }
}
