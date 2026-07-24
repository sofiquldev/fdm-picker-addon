# Packs the browser extension as a zip for distribution (load unpacked for development).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Ext = Join-Path $Root "extension"
$Dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Path $Dist -Force | Out-Null

$Out = Join-Path $Dist "videopicker-extension.zip"
if (Test-Path $Out) { Remove-Item $Out -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $Ext,
    $Out,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

Write-Host "Built $Out"
Write-Host "Video Picker extension packaged. Dev: chrome://extensions → Load unpacked → extension/"
