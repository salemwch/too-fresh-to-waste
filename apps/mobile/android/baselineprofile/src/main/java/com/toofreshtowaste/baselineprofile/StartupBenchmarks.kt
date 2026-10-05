package com.toofreshtowaste.baselineprofile

import androidx.benchmark.macro.BaselineProfileMode
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Cold-start A/B: the same build with no AOT compilation vs. with the Baseline
 * Profile applied. If `withBaselineProfile` is not faster, the profile is not
 * earning its place and the generator journeys need revisiting.
 *
 * `BaselineProfileMode.Require` fails the run if the APK carries no profile, so
 * a missing profile cannot pass as "no improvement".
 *
 * timeToInitialDisplayMs is the first Activity frame. The JS-rendered screen
 * comes later; startAndWaitForFirstContent waits for it so each iteration
 * measures a launch that actually finished.
 */
@RunWith(AndroidJUnit4::class)
class StartupBenchmarks {

    @get:Rule
    val rule = MacrobenchmarkRule()

    @Test
    fun startupWithoutCompilation() = benchmark(CompilationMode.None())

    @Test
    fun startupWithBaselineProfile() =
        benchmark(CompilationMode.Partial(BaselineProfileMode.Require))

    private fun benchmark(compilationMode: CompilationMode) = rule.measureRepeated(
        packageName = targetAppId,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = compilationMode,
        startupMode = StartupMode.COLD,
        iterations = 10,
    ) {
        startAndWaitForFirstContent()
    }
}
