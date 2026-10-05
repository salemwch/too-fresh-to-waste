package com.toofreshtowaste.baselineprofile

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Generates the Baseline Profile (AOT-compiled at install) and the Startup
 * Profile (drives R8's DEX layout, so startup classes land in the primary DEX).
 *
 * Two journeys on purpose: only cold start goes into the Startup Profile. Putting
 * scroll and swipe code there would dilute the primary DEX with classes that are
 * not needed to show the first frame. Both journeys feed the Baseline Profile.
 *
 * Run through the plugin task, not directly - see baselineprofile/build.gradle.
 */
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {

    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun startup() = rule.collect(
        packageName = targetAppId,
        includeInStartupProfile = true,
    ) {
        startAndWaitForFirstContent()
    }

    @Test
    fun firstScreenInteraction() = rule.collect(
        packageName = targetAppId,
        includeInStartupProfile = false,
    ) {
        startAndWaitForFirstContent()
        exerciseFirstScreen()
    }
}
