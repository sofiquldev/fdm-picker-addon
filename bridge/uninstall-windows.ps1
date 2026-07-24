# Uninstall Video Picker native messaging host (Windows)
# Author: Sofiqul Islam — https://sofiqul.dev

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot

$dirs = @(
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\NativeMessagingHosts"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data\NativeMessagingHosts"),
    (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts"),
    (Join-Path $env:APPDATA "Mozilla\NativeMessagingHosts")
)

foreach ($dir in $dirs) {
    $f = Join-Path $dir "org.fdm.videopicker.json"
    if (Test-Path $f) {
        Remove-Item $f -Force
        Write-Host "Removed $f"
    }
}

$regPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\org.fdm.videopicker",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\org.fdm.videopicker",
    "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\org.fdm.videopicker"
)
foreach ($rp in $regPaths) {
    if (Test-Path $rp) {
        Remove-Item $rp -Recurse -Force
        Write-Host "Removed $rp"
    }
}

Write-Host "Done. Restart browsers."
