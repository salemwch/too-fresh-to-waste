package com.toofreshtowaste.baselineprofile

import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.Until

/** The tested app's applicationId, which differs per flavor. Set by build.gradle. */
internal val targetAppId: String
    get() = InstrumentationRegistry.getArguments().getString("targetAppId")
        ?: error("targetAppId was not passed as an instrumentation runner argument")

private const val FIRST_CONTENT_TIMEOUT_MS = 30_000L

/**
 * Cold start up to the first JS-rendered screen.
 *
 * `startActivityAndWait()` returns at the Activity's first frame, which in a
 * React Native app is drawn before the JS bundle has rendered anything. Waiting
 * for a TextView in the app's window is the locale-independent signal that the
 * bridge, Hermes and the first React tree are up - which is the code a startup
 * profile exists to cover. ReactTextView is a TextView subclass, so it matches.
 */
internal fun MacrobenchmarkScope.startAndWaitForFirstContent() {
    pressHome()
    startActivityAndWait()
    val rendered = device.wait(
        Until.hasObject(By.pkg(packageName).clazz("android.widget.TextView")),
        FIRST_CONTENT_TIMEOUT_MS,
    )
    check(rendered) { "No React Native text rendered within ${FIRST_CONTENT_TIMEOUT_MS}ms of launch" }
    device.waitForIdle()
}

/**
 * Generic interaction after first render: vertical scroll and horizontal swipe on
 * whatever scrollable the first screen shows. A fresh install lands on the
 * signed-out flow, so this exercises RN's scroll, gesture and pager paths
 * without needing an account. Does nothing if the screen has no scrollable.
 */
internal fun MacrobenchmarkScope.exerciseFirstScreen() {
    device.findObject(By.pkg(packageName).scrollable(true))?.let { scrollable ->
        scrollable.setGestureMargin(device.displayWidth / 10)
        scrollable.fling(Direction.DOWN)
        device.waitForIdle()
        scrollable.fling(Direction.UP)
        device.waitForIdle()
    }

    val y = device.displayHeight / 2
    repeat(2) {
        device.swipe(device.displayWidth * 4 / 5, y, device.displayWidth / 5, y, 20)
        device.waitForIdle()
    }
}
