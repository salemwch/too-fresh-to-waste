package com.foodwasteapp

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native module that controls FLAG_SECURE on a per-screen basis.
 *
 * When FLAG_SECURE is set, Android blocks:
 *   - Screenshots (power + volume-down)
 *   - Screen recordings
 *   - The recent-apps thumbnail
 *
 * Usage in JS: call enableSecureScreen() on mount, disableSecureScreen() on unmount.
 * The JS side uses the `useSecureScreen` hook which handles the cleanup automatically.
 */
class ScreenCaptureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun enableSecureScreen() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    @ReactMethod
    fun disableSecureScreen() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    companion object {
        const val NAME = "ScreenCaptureModule"
    }
}
