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
# NOTE: -optimizationpasses is a ProGuard flag. R8 parses and ignores it; it
# runs a fixed optimization pipeline. Removed rather than left as a false
# reassurance that passes are being tuned.
-repackageclasses ''
-allowaccessmodification

# Collapse every class's SourceFile attribute to the literal "SourceFile".
# LineNumberTable is what Sentry actually needs to resolve a frame via
# mapping.txt; the original .java/.kt filename adds nothing at runtime, leaks
# the source layout, and leaves an unobfuscated string per class in the DEX.
# This is the pairing Google's own proguard-android-optimize.txt uses.
-renamesourcefileattribute SourceFile

# Strip debug/verbose/info logs from release builds
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}

# ============================================================================
# REACT NATIVE CORE — JNI SURFACE ONLY
# ============================================================================
# This section used to be three blanket keeps:
#   -keep class com.facebook.react.** { *; }
#   -keep class com.facebook.jni.**   { *; }
#   -keep class com.facebook.hermes.** { *; }
#
# `com.facebook.react.**` alone pinned ~1,700 classes / ~31,000 members, which
# is most of the app's unobfuscated surface. React Native does not ask for that:
# it marks its own JNI-reachable members with @DoNotStrip, and react-android's
# consumer rules (ReactAndroid/proguard-rules.pro, shipped inside the AAR)
# already keep those plus bridge.**, turbomodule.core.** and
# internal.turbomodule.core.**. Measured against RN 0.81.0 sources, only 4 of
# 146 files in uimanager and 0 of 24 in animated carry @DoNotStrip — everything
# else was being retained purely by the blanket rule.
#
# `com.facebook.jni.**` is a verbatim duplicate of a rule already in
# react-android's consumer file. Dropped.
#
# What genuinely cannot be inferred by R8 is fbjni's string-descriptor lookups
# from C++ (`javaClassStatic()` / `findClassStatic()`), because the class name
# only exists as a string literal in native code. That set is enumerable:
#
#   grep -rhoE '"L(com|java)/facebook/[A-Za-z0-9_/$]+;"' \
#     node_modules/react-native --include=*.h --include=*.cpp \
#     | tr -d '";' | sed 's|^L||; s|/|.|g' | sort -u
#
# On RN 0.81.0 that yields 92 classes. The keeps below cover all of them.
# RE-RUN THAT COMMAND AFTER EVERY REACT NATIVE UPGRADE — a new JNI entry point
# that is not kept here fails as a NoClassDefFoundError at runtime, in release
# only, which no type-check or unit test can catch.

# Bridgeless runtime + Fabric renderer: kept wholesale rather than per-class.
# Both are in constant traffic with C++ and are small (~110 classes combined);
# the margin is deliberate insurance on the two subsystems where a missed
# lookup is least recoverable.
-keep,includedescriptorclasses class com.facebook.react.runtime.** { *; }
-keep,includedescriptorclasses class com.facebook.react.fabric.** { *; }

# Individually referenced from native code.
-keep,includedescriptorclasses class com.facebook.react.interfaces.** { *; }
-keep,includedescriptorclasses class com.facebook.react.common.mapbuffer.** { *; }
-keep,includedescriptorclasses class com.facebook.react.internal.featureflags.** { *; }
-keep,includedescriptorclasses class com.facebook.react.defaults.** { *; }
-keep,includedescriptorclasses class com.facebook.react.reactperflogger.** { *; }
-keep,includedescriptorclasses class com.facebook.react.modules.blob.BlobCollector { *; }
-keep,includedescriptorclasses class com.facebook.react.modules.core.JavaTimerManager { *; }
-keep,includedescriptorclasses class com.facebook.react.uimanager.ComponentNameResolverBinding { *; }
-keep,includedescriptorclasses class com.facebook.react.uimanager.UIConstantsProviderBinding { *; }
-keep,includedescriptorclasses class com.facebook.react.uimanager.UIConstantsProviderBinding$* { *; }
-keep,includedescriptorclasses class com.facebook.react.views.modal.ReactModalHostView { *; }
-keep,includedescriptorclasses class com.facebook.react.views.text.PreparedLayout { *; }

# Chrome DevTools / inspector bridge. Reached from libreact_devsupportjni even
# in release builds (the inspector target is constructed regardless of whether
# a dev menu is reachable), so these six survive while the other ~98 classes in
# devsupport.** are now free to be shrunk.
-keep,includedescriptorclasses class com.facebook.react.devsupport.CxxInspectorPackagerConnection { *; }
-keep,includedescriptorclasses class com.facebook.react.devsupport.CxxInspectorPackagerConnection$* { *; }
-keep,includedescriptorclasses class com.facebook.react.devsupport.InspectorFlags { *; }
-keep,includedescriptorclasses class com.facebook.react.devsupport.inspector.InspectorNetworkRequestListener { *; }

# Hermes. Kept blanket on purpose: the lookups live in libhermes.so's own C++
# (PlatformIntlAndroid resolves com.facebook.hermes.intl.* by string), which is
# a prebuilt binary in the hermes-android AAR — not greppable from node_modules
# the way ReactAndroid's sources are. hermes-android ships no consumer rules.
# ~2,400 members; not worth trading for an unverifiable narrowing.
-keep class com.facebook.hermes.** { *; }

# Native JNI methods across all classes.
# -keepclasseswithmembernames (not -keepclassmembers, which is what RN's
# consumer rule uses) additionally pins the *class* name. Required for
# statically-linked JNI, where the symbol is Java_<pkg>_<Class>_<method> and a
# renamed class silently fails to bind at call time.
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

# Nitro Modules — reflection-based native init; no consumer rules.
# Covers react-native-nitro-modules and react-native-mmkv (~37 classes).
-keep class com.margelo.nitro.** { *; }

# react-native-config — native BuildConfig bridge; no consumer rules
-keep class com.lugg.RNCConfig.** { *; }

# REMOVED: keeps for com.agontuk.RNFusedLocation (react-native-geolocation-service)
# and com.rnfingerprint (react-native-touch-id). Neither package is installed —
# absent from apps/mobile/package.json, node_modules and settings.gradle. The app
# uses @react-native-community/geolocation and react-native-keychain instead.

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
# SourceFile is rewritten to a constant by -renamesourcefileattribute above;
# deobfuscation works off LineNumberTable + mapping.txt, so nothing is lost.
# *Annotation*: required by frameworks for annotation-based keep/inject —
# notably RN's own @DoNotStrip and @ReactProp consumer rules.
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
