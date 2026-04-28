package com.toofreshtowaste.app

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.margelo.nitro.NitroModulesPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.toMutableList().apply {
              add(NitroModulesPackage())
              add(ScreenCapturePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    initializeMmkvNative()
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }

  private fun initializeMmkvNative() {
    try {
      val clazz = Class.forName("com.margelo.nitro.mmkv.NitroMmkvOnLoad")
      val companionField = clazz.getDeclaredField("Companion")
      companionField.isAccessible = true
      val companion = companionField.get(null)
      val initMethod = companion.javaClass.getDeclaredMethod("initializeNative")
      initMethod.isAccessible = true
      initMethod.invoke(companion)
      Log.i("MainApplication", "MMKV native library initialized successfully")
    } catch (e: Exception) {
      Log.e("MainApplication", "Failed to initialize MMKV native library", e)
    }
  }
}
