# Windows build (native runner, like godot.ps1). Writes the untracked export_presets.cfg from tools/export/windows_preset.cfg
# and exports the Steam depot layout into release/windows: 0N35H07.exe, 0N35H07.pck, the GDExtension DLLs, steam_api64.dll.
# The export templates for this Godot version must be installed (%APPDATA%\Godot\export_templates\<version>).
# Example: ./scripts/export_windows.ps1            (release)   ./scripts/export_windows.ps1 -Mode debug
param(
    [ValidateSet('release', 'debug')]
    [string]$Mode = 'release'
)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$presetName = 'Windows Desktop'
$releaseDir = Join-Path $root 'release'
$outputDir = Join-Path $releaseDir 'windows'
$executable = Join-Path $outputDir '0N35H07.exe'

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType File -Force -Path (Join-Path $releaseDir '.gdignore') | Out-Null   # Godot never imports the build
Copy-Item -LiteralPath (Join-Path $root 'tools/export/windows_preset.cfg') -Destination (Join-Path $root 'export_presets.cfg') -Force

& (Join-Path $PSScriptRoot 'godot.ps1') --headless --path $root "--export-$Mode" $presetName $executable
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Export failed (exit code $LASTEXITCODE)."
}
Get-ChildItem -LiteralPath $outputDir | Format-Table Name, Length -AutoSize | Out-Host
