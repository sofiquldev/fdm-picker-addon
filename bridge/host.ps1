# Video Picker for FDM - native messaging host (Windows)
# Author: Sofiqul Islam (https://github.com/sofiquldev)
#
# Chrome/Firefox send a 4-byte length (little-endian) then UTF-8 JSON.
# We open Free Download Manager with the video URL.

$ErrorActionPreference = "Stop"
$hostName = "org.fdm.videopicker"

function Read-Message {
    $stdin = [Console]::OpenStandardInput()
    $lenBytes = New-Object byte[] 4
    $read = $stdin.Read($lenBytes, 0, 4)
    if ($read -lt 4) { return $null }
    $len = [BitConverter]::ToUInt32($lenBytes, 0)
    if ($len -eq 0 -or $len -gt 10MB) { return $null }
    $buf = New-Object byte[] $len
    $offset = 0
    while ($offset -lt $len) {
        $n = $stdin.Read($buf, $offset, $len - $offset)
        if ($n -le 0) { return $null }
        $offset += $n
    }
    return [System.Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json
}

function Send-Message($obj) {
    $json = ($obj | ConvertTo-Json -Compress -Depth 8)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $lenBytes = [BitConverter]::GetBytes([uint32]$bytes.Length)
    $stdout = [Console]::OpenStandardOutput()
    $stdout.Write($lenBytes, 0, 4)
    $stdout.Write($bytes, 0, $bytes.Length)
    $stdout.Flush()
}

function Find-FdmExe {
    if ($env:FDM_PATH -and (Test-Path -LiteralPath $env:FDM_PATH)) {
        return $env:FDM_PATH
    }

    $candidates = @(
        (Join-Path ${env:ProgramFiles} "Softdeluxe\Free Download Manager\fdm.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Softdeluxe\Free Download Manager\fdm.exe"),
        (Join-Path $env:LOCALAPPDATA "Softdeluxe\Free Download Manager\fdm.exe"),
        "C:\Program Files\FreeDownloadManager.ORG\Free Download Manager\fdm.exe",
        "C:\Program Files (x86)\FreeDownloadManager.ORG\Free Download Manager\fdm.exe"
    )

    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }

    $keyPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Free Download Manager_is1",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Free Download Manager_is1",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Free Download Manager_is1",
        "HKLM:\SOFTWARE\Softdeluxe\Free Download Manager",
        "HKCU:\SOFTWARE\Softdeluxe\Free Download Manager"
    )

    foreach ($kp in $keyPaths) {
        if (-not (Test-Path $kp)) { continue }
        foreach ($vn in @("InstallLocation", "Inno Setup: App Path", "Path", "DisplayIcon")) {
            try {
                $val = (Get-ItemProperty -Path $kp -ErrorAction Stop).$vn
                if (-not $val) { continue }
                $p = $val -replace ',.*$', ''
                if ($p -like "*.exe") {
                    if (Test-Path -LiteralPath $p) { return $p }
                } else {
                    $exe = Join-Path $p "fdm.exe"
                    if (Test-Path -LiteralPath $exe) { return $exe }
                }
            } catch {}
        }
    }

    return $null
}

function Add-Download([string]$url, [bool]$silent) {
    $fdm = Find-FdmExe
    if (-not $fdm) {
        return @{
            ok    = $false
            error = "Free Download Manager not found. Install FDM 6 or set FDM_PATH."
        }
    }

    $argList = @()
    if ($silent) { $argList += "-fs" }
    $argList += $url

    try {
        $dir = Split-Path -Parent $fdm
        Start-Process -FilePath $fdm -ArgumentList $argList -WorkingDirectory $dir -WindowStyle Hidden | Out-Null
        return @{ ok = $true; fdm = $fdm; url = $url }
    } catch {
        return @{ ok = $false; error = $_.Exception.Message }
    }
}

try {
    $msg = Read-Message
    if ($null -eq $msg) { exit 0 }

    $action = $msg.action
    if (-not $action) { $action = "download" }

    if ($action -eq "ping") {
        Send-Message @{ ok = $true; host = $hostName; fdm = (Find-FdmExe) }
        exit 0
    }

    if ($action -eq "download" -or $action -eq "add") {
        $url = $msg.url
        if (-not $url) { $url = $msg.href }
        if (-not $url) {
            Send-Message @{ ok = $false; error = "Missing url" }
            exit 0
        }
        $silent = $false
        if ($msg.silent) { $silent = [bool]$msg.silent }
        Send-Message (Add-Download -url $url -silent $silent)
        exit 0
    }

    Send-Message @{ ok = $false; error = "Unknown action: $action" }
} catch {
    try {
        Send-Message @{ ok = $false; error = $_.Exception.Message }
    } catch {}
    exit 1
}
