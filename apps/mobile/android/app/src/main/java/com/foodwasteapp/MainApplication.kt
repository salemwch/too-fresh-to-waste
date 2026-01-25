package com.foodwasteapp

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

/**
 * MainApplication for FoodWaste App
 *
 * Configuration for Nitro-based libraries (react-native-nitro-modules, react-native-mmkv):
 * - CMake/codegen autolinking is disabled in react-native.config.js
 * - Manual project includes are added in settings.gradle and build.gradle
 * - NitroModulesPackage is added manually here
 * - MMKV native library is initialized via reflection (NitroMmkvOnLoad is internal)
 *
 * Source: https://nitro.margelo.com/docs/entry-point
 */
class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.toMutableList().apply {
              // Nitro Modules Package - required for react-native-mmkv v4+
              // Manually added because CMake autolinking is disabled
              add(NitroModulesPackage())
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

    // Initialize MMKV native library using reflection
    // NitroMmkvOnLoad is marked as internal, so we use reflection to call initializeNative()
    // This loads the NitroMmkv C++ library which registers MMKVFactory in HybridObjectRegistry
    // Source: https://nitro.margelo.com/docs/entry-point
    initializeMmkvNative()

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }

  /**
   * Initialize MMKV native library using reflection.
   * The NitroMmkvOnLoad class is marked as internal in Kotlin,
   * so we need reflection to access it from outside the module.
   */
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
