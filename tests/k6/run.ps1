# k6 Test Runner for Too Fresh To Waste
# Usage:
#   .\tests\k6\run.ps1 smoke                           # smoke test against localhost
#   .\tests\k6\run.ps1 load -Env staging               # load test against staging
#   .\tests\k6\run.ps1 stress -Env staging              # stress test
#   .\tests\k6\run.ps1 spike -Env staging               # spike test
#   .\tests\k6\run.ps1 module auth                      # single module test
#   .\tests\k6\run.ps1 module offers -Env local         # single module against local

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('smoke', 'load', 'stress', 'spike', 'module')]
    [string]$Type,

    [Parameter(Position = 1)]
    [string]$Module,

    [string]$Env = 'local',

    [string]$ConsumerEmail,
    [string]$ConsumerPassword,
    [string]$MerchantEmail,
    [string]$MerchantPassword,
    [string]$AdminEmail,
    [string]$AdminPassword
)

$k6Root = "$PSScriptRoot"
$envArgs = @("--env", "ENV=$Env")

if ($ConsumerEmail)    { $envArgs += @("--env", "CONSUMER_EMAIL=$ConsumerEmail") }
if ($ConsumerPassword) { $envArgs += @("--env", "CONSUMER_PASSWORD=$ConsumerPassword") }
if ($MerchantEmail)    { $envArgs += @("--env", "MERCHANT_EMAIL=$MerchantEmail") }
if ($MerchantPassword) { $envArgs += @("--env", "MERCHANT_PASSWORD=$MerchantPassword") }
if ($AdminEmail)       { $envArgs += @("--env", "ADMIN_EMAIL=$AdminEmail") }
if ($AdminPassword)    { $envArgs += @("--env", "ADMIN_PASSWORD=$AdminPassword") }

if ($Type -eq 'module') {
    if (-not $Module) {
        Write-Error "Module name required. Available: health, auth, offers, orders, establishments, favorites, reviews, notifications, user"
        exit 1
    }
    $testFile = "$k6Root/tests/$Module.test.js"
    if (-not (Test-Path $testFile)) {
        Write-Error "Test file not found: $testFile"
        exit 1
    }
    Write-Host "Running $Module tests against $Env..." -ForegroundColor Cyan
    & k6 run @envArgs $testFile
} else {
    $scenarioFile = "$k6Root/scenarios/$Type.test.js"
    Write-Host "Running $Type scenario against $Env..." -ForegroundColor Cyan
    & k6 run @envArgs $scenarioFile
}
