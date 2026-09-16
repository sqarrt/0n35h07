# Lay out N copies of the exported build for the network test: each gets steam_appid.txt and, once the emulator is in
# place, its own steam_settings so the copies look like different players to it.
param(
    [string]$Source = "",            # default: <repo>/release/windows
    [string]$Root = "",              # default: <repo>/release/netdiag (outside the Godot project, never in a build)
    [int]$Count = 3,
    [string]$AppId = "4881310",
    [string]$Emulator = ""   # folder holding Goldberg's steam_api64.dll; empty = leave the real one in place
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ($Source -eq "") { $Source = Join-Path $repo "release\windows" }
if ($Root -eq "") { $Root = Join-Path $repo "release\netdiag" }
$names = @("ALPHA", "BRAVO", "CHARLIE", "DELTA")
$baseId = 76561190000000001
New-Item -ItemType Directory -Force -Path $Root | Out-Null
for ($i = 0; $i -lt $Count; $i++) {
    $dir = Join-Path $Root ("p{0}" -f ($i + 1))
    if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
    Copy-Item -Recurse -Force $Source $dir
    Set-Content -Path (Join-Path $dir "steam_appid.txt") -Value $AppId -NoNewline -Encoding ascii
    $settings = Join-Path $dir "steam_settings"
    New-Item -ItemType Directory -Force -Path $settings | Out-Null
    # gbe_fork's own format: one ini per window, so the emulator hands each copy a different player.
    $user = @(
        "[user::general]",
        ("account_name={0}" -f $names[$i]),
        ("account_steamid={0}" -f ($baseId + $i)),
        "language=english",
        "ip_country=US",
        "[user::saves]",
        ("saves_folder_name=netdiag_{0}" -f $names[$i])
    )
    Set-Content -Path (Join-Path $settings "configs.user.ini") -Value $user -Encoding ascii
    if ($Emulator -ne "") {
        $original = Join-Path $dir "steam_api64.dll"
        if (Test-Path $original) { Move-Item -Force $original (Join-Path $dir "steam_api64_o.dll") }
        Copy-Item -Force (Join-Path $Emulator "steam_api64.dll") $original
    }
    Write-Output ("prepared {0} as {1} ({2})" -f $dir, $names[$i], ($baseId + $i))
}
