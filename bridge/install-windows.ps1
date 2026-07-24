# Installs the Video Picker for FDM native messaging host (Chrome, Edge, Brave, Firefox).
# Uses PowerShell host.ps1 — no Python required for the bridge.
#
# Easiest: double-click install.cmd
#
#   .\bridge\install-windows.ps1
#   .\bridge\install-windows.ps1 -ExtensionId YOUR_CHROME_EXTENSION_ID

param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BridgeDir = Join-Path $Root "bridge"
$HostPs1 = Join-Path $BridgeDir "host.ps1"
$IdFile = Join-Path $Root ".extension-id.txt"
$BundledIdFile = Join-Path $BridgeDir "EXTENSION_ID.txt"

function Test-ExtensionId([string]$id) {
    return ($id -match '^[a-p]{32}$')
}

if (-not (Test-Path -LiteralPath $HostPs1)) {
    throw "host.ps1 not found at $HostPs1"
}

if (-not $ExtensionId -and (Test-Path -LiteralPath $BundledIdFile)) {
    $ExtensionId = (Get-Content -LiteralPath $BundledIdFile -Raw).Trim()
    Write-Host "Using bundled extension ID: $ExtensionId"
}

if (-not $ExtensionId -and (Test-Path -LiteralPath $IdFile)) {
    $ExtensionId = (Get-Content -LiteralPath $IdFile -Raw).Trim()
}

# Prefer bundled stable ID from extension "key" (manifest) when present
if ((Test-Path -LiteralPath $BundledIdFile)) {
    $bundled = (Get-Content -LiteralPath $BundledIdFile -Raw).Trim()
    if (Test-ExtensionId $bundled) {
        if (-not (Test-ExtensionId $ExtensionId) -or $ExtensionId -ne $bundled) {
            if ($ExtensionId -and $ExtensionId -ne $bundled) {
                Write-Host "Replacing saved ID '$ExtensionId' with bundled ID '$bundled'"
            }
            $ExtensionId = $bundled
        }
    }
}

if ($ExtensionId -and -not (Test-ExtensionId $ExtensionId)) {
    Write-Host "Ignoring invalid extension ID '$ExtensionId' (must be 32 letters a-p)."
    $ExtensionId = ""
    if (Test-Path -LiteralPath $BundledIdFile) {
        $ExtensionId = (Get-Content -LiteralPath $BundledIdFile -Raw).Trim()
    }
}

if (-not (Test-ExtensionId $ExtensionId)) {
    Write-Host ""
    Write-Host "Could not determine a valid Chrome/Edge extension ID."
    Write-Host "1. Reload the unpacked extension (extension folder)"
    Write-Host "2. Copy the ID from the extensions page (32 letters, only a-p)"
    Write-Host "3. Run: .\bridge\install-windows.ps1 -ExtensionId YOUR_ID"
    Write-Host ""
    Write-Host "Firefox host will still be registered."
    Write-Host ""
}

# Launcher .bat - browsers require a native host executable path
$HostBat = Join-Path $BridgeDir "host-launcher.bat"
$psExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$batLines = @(
    "@echo off",
    "rem Video Picker native messaging host launcher",
    "`"$psExe`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$HostPs1`""
)
Set-Content -LiteralPath $HostBat -Value ($batLines -join "`r`n") -Encoding ASCII

function Write-NativeManifest {
    param(
        [string]$TargetDir,
        [string[]]$AllowedOrigins,
        [string[]]$AllowedExtensions
    )
    if (-not (Test-Path -LiteralPath $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    $manifest = [ordered]@{
        name        = "org.fdm.videopicker"
        description = "Video Picker for FDM - sends video URLs to Free Download Manager"
        path        = $HostBat
        type        = "stdio"
    }
    if ($AllowedOrigins -and $AllowedOrigins.Count -gt 0) {
        $manifest["allowed_origins"] = @($AllowedOrigins)
    }
    if ($AllowedExtensions -and $AllowedExtensions.Count -gt 0) {
        $manifest["allowed_extensions"] = @($AllowedExtensions)
    }

    $out = Join-Path $TargetDir "org.fdm.videopicker.json"
    $json = $manifest | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($out, $json)
    Write-Host "Wrote $out"
}

$origins = @()
if (Test-ExtensionId $ExtensionId) {
    $origins += "chrome-extension://$ExtensionId/"
    Set-Content -LiteralPath $IdFile -Value $ExtensionId -Encoding ASCII
}

$ffExt = @("videopicker@fdm.local")

$chromiumDirs = @(
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\NativeMessagingHosts"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data\NativeMessagingHosts"),
    (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts")
)

foreach ($dir in $chromiumDirs) {
    if ($origins.Count -gt 0) {
        Write-NativeManifest -TargetDir $dir -AllowedOrigins $origins -AllowedExtensions @()
    }
}

$ffDir = Join-Path $env:APPDATA "Mozilla\NativeMessagingHosts"
Write-NativeManifest -TargetDir $ffDir -AllowedOrigins @() -AllowedExtensions $ffExt

if (Test-ExtensionId $ExtensionId) {
    $regPaths = @(
        "HKCU:\Software\Google\Chrome\NativeMessagingHosts\org.fdm.videopicker",
        "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\org.fdm.videopicker",
        "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\org.fdm.videopicker"
    )
    $manifestPath = Join-Path $chromiumDirs[0] "org.fdm.videopicker.json"
    foreach ($d in $chromiumDirs) {
        $candidate = Join-Path $d "org.fdm.videopicker.json"
        if (Test-Path -LiteralPath $candidate) {
            $manifestPath = $candidate
            break
        }
    }
    foreach ($rp in $regPaths) {
        New-Item -Path $rp -Force | Out-Null
        Set-ItemProperty -Path $rp -Name "(default)" -Value $manifestPath
        Write-Host "Registered $rp"
    }
}

Write-Host "Native host installed for Video Picker for FDM."
Write-Host "Launcher: $HostBat"
if (Test-ExtensionId $ExtensionId) {
    Write-Host "Extension ID: $ExtensionId"
    Write-Host "allowed_origins: chrome-extension://$ExtensionId/"
}
Write-Host "Next: reload the extension, fully quit the browser, then reopen and try Download."
