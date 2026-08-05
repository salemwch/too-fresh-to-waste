<#
.SYNOPSIS
    Verify the app survives a genuine first run.

.DESCRIPTION
    First-run state is a distinct test surface, and nothing else exercises it.
    A device that has already run the app has persisted Redux state in MMKV, a
    populated query cache, tokens in the Keychain, and granted permissions —
    none of which a new user has. Emulators make this worse: BlueStacks
    pre-grants runtime permissions, so permission-dependent paths are
    unreachable there by construction.

    Three production bugs came from that blind spot, all invisible in
    development and all fixed only after a Play Store install reproduced them:

      699633aa  empty <Stack.Navigator> because flowState was still
                INITIALIZING — crashed the app on every fresh install
      235663e4  a timeout timer left armed past an early return, reported to
                Sentry as a failure for two months of successful lookups
      c2b2deb1  the one Android 13+ notification prompt spent at cold start,
                before sign-in

    This script reconstructs first-run state on a connected device and reports
    whether launch is clean. It is a release gate, not a unit test: run it
    against a release build before shipping.

.PARAMETER Package
    Application id to test. Defaults to the production id; append .dev or
    .staging for those flavours.

.PARAMETER SettleSeconds
    How long to watch after launch. The navigator crash surfaced ~2s in; the
    geocoding timer needed 15s. The default clears both.

.EXAMPLE
    pnpm --filter @foodwaste/mobile check:fresh-install

.EXAMPLE
    ./scripts/fresh-install-check.ps1 -Package com.toofreshtowaste.app.staging
#>

[CmdletBinding()]
param(
    [string]$Package = 'com.toofreshtowaste.app',
    [int]$SettleSeconds = 20
)

$ErrorActionPreference = 'Stop'

# Runtime permissions from AndroidManifest. Revoked so the run starts where a
# new user does — this is the step emulator images quietly undo.
$RuntimePermissions = @(
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.POST_NOTIFICATIONS'
)

<#
    Signatures that mean the launch failed.

    Deliberately broader than the three bugs above: a gate that only recognises
    faults already fixed reports success for every new one. Anything fatal,
    unhandled, or React-Native-error-shaped counts.
#>
$FailureSignatures = @(
    "Couldn't find any screens for the navigator",
    'FATAL EXCEPTION',
    'AndroidRuntime.*FATAL',
    'ReactNativeJS.*Error:',
    'unhandledRejection',
    'Possible Unhandled Promise Rejection',
    'MaxListenersExceededWarning'
)

function Write-Step { param([string]$Message) Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "    OK  $Message" -ForegroundColor Green }
function Write-Bad  { param([string]$Message) Write-Host "    ERR $Message" -ForegroundColor Red }

# ── Preconditions ───────────────────────────────────────────────────────────
Write-Step 'Checking adb and device'

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Bad 'adb not on PATH. Add platform-tools, or open a shell where it is.'
    exit 1
}

$devices = (adb devices) | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' }
if (-not $devices) {
    Write-Bad 'No device or emulator attached (adb devices is empty).'
    exit 1
}
if ($devices.Count -gt 1) {
    # ANDROID_SERIAL would disambiguate, but silently testing the wrong device
    # is worse than stopping.
    Write-Bad "More than one device attached; disconnect all but one:`n$($devices -join "`n")"
    exit 1
}
Write-Ok "device: $(($devices[0] -split '\s+')[0])"

$installed = adb shell pm list packages $Package
if (-not $installed) {
    Write-Bad "$Package is not installed. Install the build you intend to ship first."
    exit 1
}
Write-Ok "package: $Package"

# ── Reconstruct first-run state ─────────────────────────────────────────────
Write-Step 'Resetting to first-run state'

adb shell am force-stop $Package | Out-Null

# pm clear wipes MMKV, AsyncStorage and the Keychain entry together, which is
# what makes flowState start at INITIALIZING again rather than rehydrating.
adb shell pm clear $Package | Out-Null
Write-Ok 'app data cleared (MMKV, AsyncStorage, Keychain)'

foreach ($permission in $RuntimePermissions) {
    # Not every permission is held on every API level; a revoke that fails
    # because it was not granted is not an error.
    adb shell pm revoke $Package $permission 2>$null | Out-Null
}
Write-Ok "permissions revoked: $($RuntimePermissions.Count)"

adb logcat -c
Write-Ok 'logcat cleared'

# ── Launch and watch ────────────────────────────────────────────────────────
Write-Step "Launching and watching for $SettleSeconds seconds"

# monkey with the LAUNCHER category avoids hardcoding the activity name, which
# changes with flavour suffixes.
adb shell monkey -p $Package -c android.intent.category.LAUNCHER 1 | Out-Null

Start-Sleep -Seconds $SettleSeconds

$log = adb logcat -d
$logText = $log -join "`n"

# ── Verdict ─────────────────────────────────────────────────────────────────
Write-Step 'Result'

$failures = @()
foreach ($signature in $FailureSignatures) {
    $hits = $log | Where-Object { $_ -match $signature }
    if ($hits) {
        $failures += [PSCustomObject]@{ Signature = $signature; Sample = ($hits | Select-Object -First 3) }
    }
}

# A process that died and respawned looks calm in a snapshot; catch it directly.
if ($logText -match 'Process .*' + [regex]::Escape($Package) + '.* has died') {
    $failures += [PSCustomObject]@{ Signature = 'process died'; Sample = @('app process terminated during launch') }
}

if ($failures.Count -eq 0) {
    Write-Ok 'clean first run — no fatal, unhandled or React Native errors'
    Write-Host ''
    Write-Host 'Note: this proves the app launched cleanly, not that the first-run' -ForegroundColor DarkGray
    Write-Host 'UI is correct. Confirm by hand that the location chooser appears and' -ForegroundColor DarkGray
    Write-Host 'that no permission dialog is shown before sign-in.' -ForegroundColor DarkGray
    exit 0
}

foreach ($failure in $failures) {
    Write-Bad $failure.Signature
    foreach ($line in $failure.Sample) {
        Write-Host "        $line" -ForegroundColor DarkYellow
    }
}

Write-Host ''
Write-Bad "first run FAILED — $($failures.Count) signature(s) matched"
Write-Host 'Full log: adb logcat -d > fresh-install.log' -ForegroundColor DarkGray
exit 1
