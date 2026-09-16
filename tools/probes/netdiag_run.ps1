# A network test run: two (or more) windows of the exported build side by side, the first hosting a lobby and the
# rest joining it, each playing itself (--netdiag). Nothing here touches the mouse: the windows drive their own menus.
# The lobby id comes out of the host's session log, which is where the game writes it.
param(
    [string]$Root = "",              # default: <repo>/release/netdiag, as netdiag_layout.ps1 laid it out
    [string]$Logs = "",              # default: the game's user:// netdiag folder, one directory per window
    [string]$Out = "",               # default: <repo>/test-results/probes/netdiag
    [string]$Mode = "duel",          # duel / battle / war
    [int]$Windows = 2,
    [int]$Bots = 0,                  # seats the host fills so Battle and War can run with two windows
    [int]$W = 960, [int]$H = 540,
    [int]$MatchSeconds = 70,
    [int]$KillHostAfter = 0,         # seconds into the match to close the creator's window (0 = never)
    [int]$HostWaitSeconds = 30
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ($Root -eq "") { $Root = Join-Path $repo "release\netdiag" }
if ($Logs -eq "") { $Logs = Join-Path $env:APPDATA "Godot\app_userdata\OneShot\netdiag" }
if ($Out -eq "") { $Out = Join-Path $repo "test-results\probes\netdiag" }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Shot32 {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT pt);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[Shot32]::SetProcessDPIAware() | Out-Null
New-Item -ItemType Directory -Force -Path $Out | Out-Null

function Start-Window([int]$index, [string[]]$extra) {
    $exe = Join-Path $Root ("p{0}\0N35H07.exe" -f ($index + 1))
    $x = ($index % 2) * ($W + 20)
    $y = [math]::Floor($index / 2) * ($H + 60)
    $a = @("--netdiag", "--netdiag-size", "$($W)x$($H)", "--netdiag-at", "$x,$y") + $extra
    return Start-Process -FilePath $exe -ArgumentList $a -PassThru
}

# Put the window exactly where the tile is, at exactly the asked-for client size: what the game makes of
# the asked-for size depends on the display scale, and a window wider than its tile would capture its neighbours.
function Set-Tile($process, [int]$index) {
    $hwnd = $process.MainWindowHandle
    if ($hwnd -eq [IntPtr]::Zero) { return }
    $x = ($index % 2) * ($W + 20)
    $y = [math]::Floor($index / 2) * ($H + 60)
    [Shot32]::MoveWindow($hwnd, $x, $y, $W, $H, $true) | Out-Null
    Start-Sleep -Milliseconds 200
    $rect = New-Object Shot32+RECT
    [Shot32]::GetClientRect($hwnd, [ref]$rect) | Out-Null          # the frame is not part of the client area
    $dw = $W - ($rect.Right - $rect.Left)
    $dh = $H - ($rect.Bottom - $rect.Top)
    if ($dw -ne 0 -or $dh -ne 0) { [Shot32]::MoveWindow($hwnd, $x, $y, $W + $dw, $H + $dh, $true) | Out-Null }
}

function Wait-Window($process) {
    for ($i = 0; $i -lt 80; $i++) {
        Start-Sleep -Milliseconds 250
        $process.Refresh()
        if ($process.MainWindowHandle -ne [IntPtr]::Zero) { return }
    }
    throw ("window {0} never opened" -f $process.Id)
}

function Get-Log([int]$pid_) {
    $dir = Join-Path $Logs $pid_
    if (-not (Test-Path $dir)) { return $null }
    return Get-ChildItem $dir -Filter *.log | Sort-Object LastWriteTime | Select-Object -Last 1
}

function Wait-Lobby([int]$pid_, [int]$seconds) {
    for ($i = 0; $i -lt $seconds * 4; $i++) {
        Start-Sleep -Milliseconds 250
        $log = Get-Log $pid_
        if ($log -ne $null) {
            $line = Select-String -Path $log.FullName -Pattern "lobby_created ok=true lobby=(\d+)" | Select-Object -First 1
            if ($line -ne $null) { return $line.Matches[0].Groups[1].Value }
        }
    }
    throw "the host never created a lobby"
}

# Ask the window to draw ITSELF into the bitmap (PW_RENDERFULLCONTENT), never copy the screen: the test runs on a
# desktop somebody else is using, and a screen copy would take whatever happens to be on top of the game.
function Save-Shot($process, [string]$path) {
    $hwnd = $process.MainWindowHandle
    if ($hwnd -eq [IntPtr]::Zero) { return }
    $rect = New-Object Shot32+RECT
    [Shot32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null    # PrintWindow draws the whole window, frame included
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top
    if ($w -le 0 -or $h -le 0) { return }
    $bitmap = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $hdc = $g.GetHdc()
    $drawn = [Shot32]::PrintWindow($hwnd, $hdc, 2)
    $g.ReleaseHdc($hdc)
    if ($drawn) { $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) }
    $g.Dispose(); $bitmap.Dispose()
}

$started = @()
$host_ = Start-Window 0 @("--netdiag-mode", $Mode, "--netdiag-bots", "$Bots", "--netdiag-seats", "$($Windows + $Bots)")
Wait-Window $host_
Set-Tile $host_ 0
$started += $host_
$lobby = Wait-Lobby $host_.Id $HostWaitSeconds
Write-Output ("host pid {0} lobby {1}" -f $host_.Id, $lobby)

for ($i = 1; $i -lt $Windows; $i++) {
    $guest = Start-Window $i @("+connect_lobby", $lobby)
    Wait-Window $guest
    Set-Tile $guest $i
    $started += $guest
    Write-Output ("guest pid {0} joined {1}" -f $guest.Id, $lobby)
}

$stamp = Get-Date -Format "HHmmss"
for ($second = 0; $second -lt $MatchSeconds; $second += 10) {
    Start-Sleep -Seconds 10
    for ($i = 0; $i -lt $started.Count; $i++) {
        if ($started[$i].HasExited) { continue }
        Save-Shot $started[$i] (Join-Path $Out ("{0}-p{1}-{2}s.png" -f $stamp, ($i + 1), ($second + 10)))
    }
    # The creator leaving mid-match: the rest must inherit the phase authority and play on (or end the duel cleanly).
    if ($KillHostAfter -gt 0 -and ($second + 10) -ge $KillHostAfter -and -not $host_.HasExited) {
        $log = Get-Log $host_.Id
        if ($log -ne $null) { Copy-Item $log.FullName (Join-Path $Out ("{0}-p1-{1}.log" -f $stamp, $host_.Id)) }
        Stop-Process -Id $host_.Id -Force
        Write-Output ("creator pid {0} left at {1}s" -f $host_.Id, ($second + 10))
    }
}
foreach ($p in $started) {
    if (-not $p.HasExited) {
        Save-Shot $p (Join-Path $Out ("{0}-p{1}-final.png" -f $stamp, ($started.IndexOf($p) + 1)))
    }
    $log = Get-Log $p.Id
    if ($log -ne $null) { Copy-Item $log.FullName (Join-Path $Out ("{0}-p{1}-{2}.log" -f $stamp, ($started.IndexOf($p) + 1), $p.Id)) }
    if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
}
Write-Output ("run {0}: {1} windows, mode {2}, logs and frames in {3}" -f $stamp, $started.Count, $Mode, $Out)
