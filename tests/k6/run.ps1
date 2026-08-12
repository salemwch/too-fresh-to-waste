# k6 runner for Too Fresh To Waste
#
#   .\tests\k6\run.ps1 gate                     # CI regression gate (docker)
#   .\tests\k6\run.ps1 capacity -Env staging    # breakpoint
#   .\tests\k6\run.ps1 soak -Env staging        # 2h steady
#   .\tests\k6\run.ps1 spike -Env staging
#   .\tests\k6\run.ps1 concurrency              # correctness; run the verifier after
#   .\tests\k6\run.ps1 rate-limit               # asserts the limiter still fires
#   .\tests\k6\run.ps1 smoke                    # functional post-deploy check
#
# Every suite except smoke and rate-limit needs seeded fixtures:
#   pnpm --filter @foodwaste/backend seed:loadtest

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('gate', 'capacity', 'soak', 'spike', 'concurrency', 'rate-limit', 'smoke')]
    [string]$Suite,

    [ValidateSet('local', 'docker', 'staging')]
    [string]$Env = 'local',

    [string]$SeedPassword
)

$root = $PSScriptRoot
$file = if ($Suite -eq 'smoke') { "$root/smoke/all-modules.js" } else { "$root/suites/$Suite.js" }

if (-not (Test-Path $file)) {
    Write-Error "Suite not found: $file"
    exit 1
}

$k6Args = @('run', $file, '--env', "ENV=$Env")
if ($SeedPassword) { $k6Args += @('--env', "SEED_PASSWORD=$SeedPassword") }

New-Item -ItemType Directory -Force -Path "$root/../../results" | Out-Null

Write-Host "Running $Suite against $Env..." -ForegroundColor Cyan
& k6 @k6Args
$exit = $LASTEXITCODE

if ($Suite -eq 'concurrency' -and $exit -eq 0) {
    Write-Host "`nHTTP invariants held. Checking database invariants..." -ForegroundColor Cyan
    # k6 only sees responses; double-crediting returns 200 like everything else.
    pnpm --filter '@foodwaste/backend' verify:loadtest-invariants
    $exit = $LASTEXITCODE
}

exit $exit
