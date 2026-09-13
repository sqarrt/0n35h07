# Native Windows runner. Set GODOT_BIN to the Godot executable, or put Godot on PATH.
# Example: ./scripts/godot.ps1 --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit
$ErrorActionPreference = 'Stop'

$godotExecutable = $env:GODOT_BIN
if (-not $godotExecutable) {
    foreach ($commandName in @('godot', 'godot4')) {
        $godotCommand = Get-Command $commandName -CommandType Application -ErrorAction SilentlyContinue
        if ($godotCommand) {
            $godotExecutable = $godotCommand.Source
            break
        }
    }
}

if (-not $godotExecutable -or -not (Test-Path -LiteralPath $godotExecutable -PathType Leaf)) {
    throw 'Godot was not found. Set $env:GODOT_BIN to the Windows Godot .exe path.'
}

& $godotExecutable @args | Out-Host
exit $LASTEXITCODE
