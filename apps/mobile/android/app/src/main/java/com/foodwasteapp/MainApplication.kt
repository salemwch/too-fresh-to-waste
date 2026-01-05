package com.foodwasteapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
          // Packages that are autolinked via the Gradle plugin
          val packages = PackageList(this).packages.toMutableList()
          // Packages that cannot be autolinked can be added manually here
          return packages
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override fun onCreate() {
    super.onCreate()
    // CRITICAL FIX for React Native 0.81.0 merged libraries
    // Use OpenSourceMergedSoMapping to handle libraries merged into libreactnative.so
    // This fixes: "library libreact_featureflagsjni.so not found" crash
    SoLoader.init(this, OpenSourceMergedSoMapping)

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }

    // Initialize development tools (debug builds only)
    // This enables Metro bundler connection, Chrome DevTools, and React DevTools
    if (BuildConfig.DEBUG) {
      ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
    }
  }
}