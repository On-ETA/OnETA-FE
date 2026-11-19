# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Expo SDK 54 Record conversion reads @Field.key through Kotlin reflection.
# Preserve the annotation and marker interface when R8 optimizes release builds.
# https://github.com/expo/expo/blob/main/packages/expo-modules-core/android/proguard-rules.pro
-keep interface expo.modules.kotlin.records.Record
-keep @interface expo.modules.kotlin.records.Field { *; }
