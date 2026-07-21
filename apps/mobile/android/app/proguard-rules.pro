# ProGuard/R8 Rules for Too Fresh To Waste
# React Native 0.81.0 | AGP 8.13.2 | R8 Full Mode
#
# PHILOSOPHY: Modern Android libraries ship their own consumer ProGuard rules
# via consumerProguardFiles in their AARs. DO NOT duplicate them here — blanket
# `-keep class X.** { *; }` rules block R8 from obfuscating and shrinking code,
# tanking Google Play optimization scores.
#
# Only add rules here for:
#   1. App-specific reflection/JNI targets
#   2. Libraries confirmed NOT to ship their own consumer rules
#   3. R8 optimization directives

# ============================================================================
# R8 OPTIMIZATION DIRECTIVES
# ============================================================================
-optimizationpasses 5
-repackageclasses ''
-allowaccessmodification

# Strip debug/verbose/info logs from release builds
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}

# ============================================================================
# REACT NATIVE — targeted keeps only
# ============================================================================
# The react-android, hermes-android, soloader, and fresco AARs ship their own
# consumer ProGuard rules for core/JNI/bridge/image classes. Do NOT add blanket
# keeps for com.facebook.react.**, com.facebook.hermes.**, com.facebook.jni.**,
# com.facebook.soloader.**, com.facebook.imagepipeline.**, com.facebook.drawee.**

# ViewManagers — loaded by class name from JS bridge
-keep public class * extends com.facebook.react.uimanager.ViewManager { <init>(...); }

# ReactPackage — loaded by autolinking's PackageList
-keep public class * extends com.facebook.react.ReactPackage { <init>(...); }

# TurboReactPackage — New Architecture module providers
-keep public class * extends com.facebook.react.TurboReactPackage { <init>(...); }

# NativeModule subclasses — getName() must survive for JS bridge lookup
-keep public class * extends com.facebook.react.bridge.NativeModule {
    <init>(...);
    public java.lang.String getName();
}

# JavaScript interface methods (WebView bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Native JNI methods across all classes
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# ============================================================================
# APP-SPECIFIC
# ============================================================================
# react-native-config reads BuildConfig fields via reflection at runtime
-keep class com.toofreshtowaste.app.BuildConfig { *; }

# ============================================================================
# LIBRARIES WITHOUT BUNDLED CONSUMER RULES
# ============================================================================
# These libraries do not ship consumerProguardFiles in their AARs.
# Every other library (Firebase, GMS, OkHttp, Reanimated, Gesture Handler,
# RN Screens, Safe Area Context, Keychain, Async Storage, NetInfo, Permissions,
# Image Picker, Vector Icons, Maps, etc.) ships its own rules — do NOT add
# redundant keeps for them.

# Nitro Modules — reflection-based native init; no consumer rules
-keep class com.margelo.nitro.** { *; }

# react-native-config — native BuildConfig bridge; no consumer rules
-keep class com.lugg.RNCConfig.** { *; }

# react-native-geolocation-service — older library; no consumer rules
-keepnames class com.agontuk.RNFusedLocation.** { *; }

# react-native-touch-id — older library; no consumer rules
-keepnames class com.rnfingerprint.** { *; }

# ============================================================================
# GENERAL ANDROID
# ============================================================================

# Enum values() / valueOf() — used in switch tables
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Parcelable CREATOR fields — required by Android framework
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ============================================================================
# CRASH REPORTING ATTRIBUTES
# ============================================================================
# SourceFile + LineNumberTable: Sentry needs these for readable stack traces.
# *Annotation*: required by frameworks for annotation-based keep/inject.
# Signature: keeps generic type info for reflection-based APIs.
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature

# ============================================================================
# SUPPRESS WARNINGS (safe — these don't affect optimization)
# ============================================================================
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.jni.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn okhttp3.**
-dontwarn okio.**

# react-native-sms-retriever references GMS Credentials API not in our deps
-dontwarn com.google.android.gms.auth.api.credentials.**
