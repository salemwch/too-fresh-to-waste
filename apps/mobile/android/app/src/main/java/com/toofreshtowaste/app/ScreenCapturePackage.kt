package com.toofreshtowaste.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// BaseReactPackage, as React Native 0.87 directs (ReactPackage.createNativeModules
// is deprecated). The module is created lazily on first use rather than eagerly
// when the package is registered. It is a classic @ReactMethod module reached
// through NativeModules, hence isTurboModule = false.
class ScreenCapturePackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == ScreenCaptureModule.NAME) ScreenCaptureModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            ScreenCaptureModule.NAME to ReactModuleInfo(
                name = ScreenCaptureModule.NAME,
                className = ScreenCaptureModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ),
        )
    }
}
