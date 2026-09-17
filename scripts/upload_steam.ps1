# Upload the exported depot to SteamPipe through steamcmd — port of the web build's scripts/upload-steam.mjs. The same build
# can go to the main app and to the Playtest app.
#
#   ./scripts/export_windows.ps1                                        # produce release/windows first
#   ./scripts/upload_steam.ps1 -App 4881310 -User <steamLogin> [-Branch default]
#   ./scripts/upload_steam.ps1 -App 4888710 -User <steamLogin>          # Playtest app
#   ./scripts/upload_steam.ps1 -App 4881310 -User <steamLogin> -DryRun  # write the VDFs, print the command, upload nothing
#
# -App      (required) Steam AppID to publish under.
# -Depot    depot id (default: App + 1 — the usual first-depot convention; confirm in Steamworks).
# -Branch   set the build live on this branch (default: none → upload only, set it live in the portal).
# -User     Steam build-account login (or env STEAM_USER). The first run prompts for the password and Steam Guard.
# -Content  depot content folder (default: release/windows).
# -Desc     build description (default: "local YYYY-MM-DD").
# -SteamCmd steamcmd executable (default: env STEAMCMD or "steamcmd").
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^\d+$')][string]$App,
    [string]$Depot = '',
    [string]$Branch = '',
    [string]$User = $env:STEAM_USER,
    [string]$Content = '',
    [string]$Desc = "local $(Get-Date -Format 'yyyy-MM-dd')",
    [string]$SteamCmd = $(if ($env:STEAMCMD) { $env:STEAMCMD } else { 'steamcmd' }),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
if (-not $Depot) { $Depot = [string]([long]$App + 1) }
if (-not $User) { throw '-User <steamLogin> (or env STEAM_USER) is required' }
if (-not $Content) { $Content = Join-Path $root 'release/windows' }
$Content = (Resolve-Path -LiteralPath $Content -ErrorAction SilentlyContinue).Path
if (-not $Content -or -not (Get-ChildItem -LiteralPath $Content -Force | Select-Object -First 1)) {
    throw 'The content folder is empty or missing. Run ./scripts/export_windows.ps1 first.'
}

# The SteamPipe VDFs go to a temp folder, out of the content root, so they are never packed into the depot.
$work = Join-Path ([System.IO.Path]::GetTempPath()) "oneshot-steam-$App-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$buildOutput = Join-Path $work 'output'
New-Item -ItemType Directory -Force -Path $buildOutput | Out-Null
$forward = { param([string]$path) $path -replace '\\', '/' }

$depotVdf = Join-Path $work "depot_build_$Depot.vdf"
Set-Content -LiteralPath $depotVdf -Encoding ascii -Value @"
"DepotBuildConfig"
{
  "DepotID" "$Depot"
  "FileMapping" { "LocalPath" "*" "DepotPath" "." "recursive" "1" }
  "FileExclusion" "*.pdb"
  "FileExclusion" "steam_appid.txt"
}
"@

$appVdf = Join-Path $work "app_build_$App.vdf"
Set-Content -LiteralPath $appVdf -Encoding ascii -Value @"
"appbuild"
{
  "appid" "$App"
  "desc" "$Desc"
  "buildoutput" "$(& $forward $buildOutput)"
  "contentroot" "$(& $forward $Content)"
  "setlive" "$Branch"
  "depots" { "$Depot" "depot_build_$Depot.vdf" }
}
"@

$branchText = if ($Branch) { $Branch } else { '(none - set live in the portal)' }
Write-Host "Uploading $Content"
Write-Host "   app $App, depot $Depot, branch $branchText, desc `"$Desc`""
Write-Host "   VDFs: $work"
$arguments = @('+login', $User, '+run_app_build', $appVdf, '+quit')
if ($DryRun) {
    Write-Host "   dry run: $SteamCmd $($arguments -join ' ')"
    exit 0
}
Write-Host "   steamcmd: $SteamCmd  (the first run prompts for the password and Steam Guard)"
& $SteamCmd @arguments
if ($LASTEXITCODE -ne 0) {
    Write-Error ("steamcmd failed. Common causes: a stale Steam Guard (log in again: $SteamCmd +login $User), " +
        "a wrong depot id (Steamworks > app $App > Depots), or no setlive permission for the branch.")
    exit 1
}
Write-Host 'Upload finished. Without -Branch, set the build live in Steamworks > SteamPipe > Builds.'
