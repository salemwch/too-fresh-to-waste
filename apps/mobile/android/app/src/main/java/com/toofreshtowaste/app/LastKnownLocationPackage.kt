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
class LastKnownLocationPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == LastKnownLocationModule.NAME) LastKnownLocationModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            LastKnownLocationModule.NAME to ReactModuleInfo(
                name = LastKnownLocationModule.NAME,
                className = LastKnownLocationModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ),
        )
    }
}
