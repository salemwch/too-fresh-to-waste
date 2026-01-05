package com.facebook.react.internal.featureflags

import com.facebook.soloader.SoLoader

/**
 * Patch for React Native 0.81.0 feature flags loading issue
 *
 * Problem: react_featureflagsjni is merged into libreactnative.so but the
 * original ReactNativeFeatureFlagsCxxInterop tries to load it separately.
 *
 * Solution: Pre-load libreactnative.so before ReactNativeFeatureFlagsCxxInterop
 * initializes, so the merged symbols are available.
 */
object ReactNativeFeatureFlagsPatch {
    init {
        // Load libreactnative.so which contains merged react_featureflagsjni symbols
        SoLoader.loadLibrary("reactnative")
    }
}
