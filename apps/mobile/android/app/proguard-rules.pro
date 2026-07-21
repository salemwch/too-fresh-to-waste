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
# REACT NATIVE CORE — keep all framework classes
# ============================================================================
# react-android's consumer rules only cover bridge.**, turbomodule.**, and
# jni.**. They miss devsupport.** (loaded via JNI from libreact_devsupportjni),
# soloader mappings, and other classes referenced by native code at runtime.
# hermes-android ships NO consumer rules at all.
# Keeping com.facebook.** is required — R8 still optimizes third-party libs.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }

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
