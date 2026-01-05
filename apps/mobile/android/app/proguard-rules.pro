# ProGuard Rules for Food Waste Mobile App
# React Native 0.81.0 + Firebase + Navigation + Native Modules
# Source: https://developer.android.com/studio/build/shrink-code
# Date: October 17, 2025

# ============================================================================
# REACT NATIVE CORE
# ============================================================================
# Source: https://reactnative.dev/docs/signed-apk-android

# Keep React Native core classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep interface com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# Keep React Native ViewManager classes
-keep public class * extends com.facebook.react.uimanager.ViewManager {
    <init>(...);
}

# Keep React Native Module classes
-keep public class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    <init>(...);
}

# Keep React Native Package classes
-keep public class * extends com.facebook.react.ReactPackage {
    <init>(...);
}

# ============================================================================
# HERMES JAVASCRIPT ENGINE
# ============================================================================
# Source: https://reactnative.dev/docs/hermes

# Keep Hermes classes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep interface com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

# Hermes JNI
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.jni.HybridData { *; }

# ============================================================================
# FIREBASE SDK
# ============================================================================
# Source: https://firebase.google.com/docs/android/setup
# Source: https://github.com/firebase/firebase-android-sdk

# Firebase Core
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firebase Messaging
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }

# Firebase Analytics
-keep class com.google.firebase.analytics.** { *; }

# Firebase Crashlytics
-keep class com.google.firebase.crashlytics.** { *; }
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*

# Firebase Installation
-keep class com.google.firebase.installations.** { *; }

# ============================================================================
# REACT NATIVE FIREBASE
# ============================================================================
# Source: https://rnfirebase.io/

-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**

# Firebase App
-keep class io.invertase.firebase.app.** { *; }

# Firebase Messaging
-keep class io.invertase.firebase.messaging.** { *; }

# Firebase Analytics
-keep class io.invertase.firebase.analytics.** { *; }

# Firebase Crashlytics
-keep class io.invertase.firebase.crashlytics.** { *; }

# ============================================================================
# REACT NAVIGATION
# ============================================================================
# Source: https://reactnavigation.org/

# React Navigation Core
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# Safe Area Context
-keep class com.th3rdwave.safeareacontext.SafeAreaProvider { *; }
-keep class com.th3rdwave.safeareacontext.SafeAreaView { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.Screen { *; }
-keep class com.swmansion.rnscreens.ScreenContainer { *; }
-keep class com.swmansion.rnscreens.ScreenStackHeaderConfig { *; }

# ============================================================================
# REACT NATIVE REANIMATED
# ============================================================================
# Source: https://docs.swmansion.com/react-native-reanimated/

-keep class com.swmansion.reanimated.** { *; }
-keep interface com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# Keep Reanimated worklets
-keep class com.swmansion.reanimated.layoutReanimation.** { *; }
-keep class com.swmansion.reanimated.nativeProxy.** { *; }

# ============================================================================
# REACT NATIVE GESTURE HANDLER
# ============================================================================
# Source: https://docs.swmansion.com/react-native-gesture-handler/

-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# ============================================================================
# ASYNC STORAGE
# ============================================================================
# Source: https://react-native-async-storage.github.io/async-storage/

-keep class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

# ============================================================================
# NETINFO
# ============================================================================
# Source: https://github.com/react-native-netinfo/react-native-netinfo

-keep class com.reactnativecommunity.netinfo.** { *; }
-dontwarn com.reactnativecommunity.netinfo.**

# ============================================================================
# REACT NATIVE DEVICE INFO
# ============================================================================
# Source: https://github.com/react-native-device-info/react-native-device-info

-keep class com.learnium.RNDeviceInfo.** { *; }
-dontwarn com.learnium.RNDeviceInfo.**

# ============================================================================
# REACT NATIVE VECTOR ICONS
# ============================================================================
# Source: https://github.com/oblador/react-native-vector-icons

-keep class com.oblador.vectoricons.** { *; }
-dontwarn com.oblador.vectoricons.**

# ============================================================================
# REACT NATIVE IMAGE PICKER
# ============================================================================
# Source: https://github.com/react-native-image-picker/react-native-image-picker

-keep class com.imagepicker.** { *; }
-dontwarn com.imagepicker.**

# ============================================================================
# REACT NATIVE KEYCHAIN
# ============================================================================
# Source: https://github.com/oblador/react-native-keychain

-keep class com.oblador.keychain.** { *; }
-dontwarn com.oblador.keychain.**

# ============================================================================
# REACT NATIVE PERMISSIONS
# ============================================================================
# Source: https://github.com/zoontek/react-native-permissions

-keep class com.zoontek.rnpermissions.** { *; }
-dontwarn com.zoontek.rnpermissions.**

# ============================================================================
# REACT NATIVE MAPS
# ============================================================================
# Source: https://github.com/react-native-maps/react-native-maps

-keep class com.airbnb.android.react.maps.** { *; }
-dontwarn com.airbnb.android.react.maps.**

# Google Maps
-keep class com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.maps.**

# ============================================================================
# REACT NATIVE SVG
# ============================================================================
# Source: https://github.com/software-mansion/react-native-svg

-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# ============================================================================
# REACT NATIVE CONFIG
# ============================================================================
# Source: https://github.com/luggit/react-native-config

-keep class com.lugg.ReactNativeConfig.** { *; }
-dontwarn com.lugg.ReactNativeConfig.**

# ============================================================================
# REACT NATIVE GEOLOCATION
# ============================================================================
# Source: https://github.com/Agontuk/react-native-geolocation-service

-keep class com.agontuk.RNFusedLocation.** { *; }
-dontwarn com.agontuk.RNFusedLocation.**

# ============================================================================
# REACT NATIVE SHARE
# ============================================================================
# Source: https://github.com/react-native-share/react-native-share

-keep class cl.json.** { *; }
-dontwarn cl.json.**

# ============================================================================
# REACT NATIVE QR CODE SCANNER
# ============================================================================
# Source: https://github.com/moaazsidat/react-native-qrcode-scanner

-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# ============================================================================
# JAIL MONKEY (Root/Jailbreak Detection)
# ============================================================================
# Source: https://github.com/GantMan/jail-monkey

-keep class com.gantix.JailMonkey.** { *; }
-dontwarn com.gantix.JailMonkey.**

# ============================================================================
# NOTIFEE (Notifications)
# ============================================================================
# Source: https://notifee.app/

-keep class app.notifee.** { *; }
-dontwarn app.notifee.**

# ============================================================================
# REDUX / REDUX TOOLKIT
# ============================================================================
# Redux doesn't require ProGuard rules (JavaScript only)

# ============================================================================
# OKHTTP (Used by React Native)
# ============================================================================
# Source: https://github.com/square/okhttp

-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ============================================================================
# FRESCO (Image Loading - Used by React Native)
# ============================================================================
# Source: https://frescolib.org/

-keep class com.facebook.imagepipeline.** { *; }
-keep interface com.facebook.imagepipeline.** { *; }
-dontwarn com.facebook.imagepipeline.**

-keep class com.facebook.drawee.** { *; }
-keep interface com.facebook.drawee.** { *; }

# ============================================================================
# FLIPPER (Debug Only - Should Not Affect Release)
# ============================================================================
# Flipper is debugImplementation only, but adding rules for safety

-dontwarn com.facebook.flipper.**
-dontwarn com.facebook.fbjni.**

# ============================================================================
# GENERAL ANDROID RULES
# ============================================================================

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ============================================================================
# KOTLIN
# ============================================================================

-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# ============================================================================
# DEBUGGING ATTRIBUTES
# ============================================================================
# Keep line numbers and source file names for crash reports

-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ============================================================================
# WARNINGS TO SUPPRESS
# ============================================================================

-dontwarn com.google.common.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ============================================================================
# END OF PROGUARD RULES
# ============================================================================
