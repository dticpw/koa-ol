# Resolve the desktop app's bundled Node runtime; never write startup text to stdout.
$ErrorActionPreference = 'Stop'
$codexDir = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $codexDir 'config.toml'
$nodePath = $null
if (Test-Path $configPath) {
    $configText = [IO.File]::ReadAllText($configPath)
    if ($configText -match '(?m)^\s*NODE_REPL_NODE_PATH\s*=\s*''([^'']+)''') {
        if (Test-Path -LiteralPath $Matches[1]) { $nodePath = $Matches[1] }
    }
}
if (!$nodePath) {
    $runtimeRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\runtimes\cua_node'
    $bundled = Get-ChildItem -Path "$runtimeRoot\*\bin\node.exe" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($bundled) { $nodePath = $bundled.FullName }
}
if (!$nodePath) {
    $installed = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($installed) { $nodePath = $installed.Source }
}
if (!$nodePath) { throw 'Cannot find Node.js. Open/update the Codex desktop app to install its runtime, or install Node.js 22 LTS.' }
& $nodePath (Join-Path $PSScriptRoot 'server.mjs')
exit $LASTEXITCODE
