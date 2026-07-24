# Fetches a pinned yt-dlp release into addon/yt-dlp and packs VideoPicker.fda
# Author: Sofiqul Islam — https://sofiqul.dev
param(
    [string]$YtDlpVersion = "2026.07.04",
    [switch]$SkipFetch
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Addon = Join-Path $Root "addon"
$Dist = Join-Path $Root "dist"
$YtDir = Join-Path $Addon "yt-dlp"

New-Item -ItemType Directory -Path $Dist -Force | Out-Null

if (-not $SkipFetch) {
    $zipUrl = "https://github.com/yt-dlp/yt-dlp/archive/refs/tags/$YtDlpVersion.zip"
    $tmpZip = Join-Path $env:TEMP "yt-dlp-$YtDlpVersion.zip"
    $tmpExtract = Join-Path $env:TEMP "yt-dlp-extract-$YtDlpVersion"

    Write-Host "Downloading yt-dlp $YtDlpVersion ..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing

    if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
    Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

    $src = Get-ChildItem $tmpExtract -Directory | Select-Object -First 1
    if (-not $src) { throw "yt-dlp archive layout unexpected" }

    if (Test-Path $YtDir) { Remove-Item $YtDir -Recurse -Force }
    New-Item -ItemType Directory -Path $YtDir -Force | Out-Null

    # Keep only the Python package tree needed at runtime
    $pkg = Join-Path $src.FullName "yt_dlp"
    if (-not (Test-Path $pkg)) { throw "yt_dlp package not found in archive" }
    Copy-Item -Path $pkg -Destination (Join-Path $YtDir "yt_dlp") -Recurse -Force

    # Marker for version
    Set-Content -Path (Join-Path $YtDir "VERSION.txt") -Value $YtDlpVersion
    Write-Host "yt-dlp placed at $YtDir"
}

if (-not (Test-Path (Join-Path $YtDir "yt_dlp\__main__.py"))) {
    throw "addon/yt-dlp missing. Re-run without -SkipFetch."
}

$Fda = Join-Path $Dist "VideoPicker.fda"
if (Test-Path $Fda) { Remove-Item $Fda -Force }

$staging = Join-Path $env:TEMP "videopicker-fda-staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item -Path (Join-Path $Addon "*") -Destination $staging -Recurse -Force

# Prefer Compress-Archive then rename; .fda is a zip
$zipPath = Join-Path $Dist "VideoPicker.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Compress-Archive cannot easily exclude; use .NET ZipFile for control
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $staging,
    $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)
Move-Item -Path $zipPath -Destination $Fda -Force
Remove-Item $staging -Recurse -Force

Write-Host "Built $Fda"
Write-Host "Video Picker add-on ready. Install in FDM: Menu → Add-ons → Install add-on from file → VideoPicker.fda"
