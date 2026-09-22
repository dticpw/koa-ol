# Incremental update: preserve chat settings, auth.json and the model catalog.
$ErrorActionPreference = 'Stop'
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$configPath = Join-Path $codexDir 'config.toml'
$sourceDir = Join-Path $PSScriptRoot 'koa-images'
$toolDir = Join-Path $codexDir 'koa-images'
foreach ($name in @('server.mjs', 'start.ps1')) {
    if (!(Test-Path -LiteralPath (Join-Path $sourceDir $name))) { throw 'Extract the full update package before installing.' }
}
if (!(Test-Path $configPath) -or !(Test-Path (Join-Path $codexDir 'auth.json'))) { throw 'Configure the existing Koa chat service and auth.json first.' }
$text = [IO.File]::ReadAllText($configPath)
if ($text -match '(?m)^\s*\[mcp_servers\.koa_images\]') {
    throw 'koa_images is already registered. Update only its tool files, or review the existing registration before reinstalling.'
}
if ($sourceDir -ieq $toolDir) { throw 'Run this installer from the extracted download folder, not inside .codex.' }
$launcher = (Join-Path $toolDir 'start.ps1').Replace('\', '/')
if ($launcher.Contains('"')) { throw 'Unsupported quotation mark in configuration path.' }
$block = @"

[mcp_servers.koa_images]
command = "powershell.exe"
args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$launcher"]
startup_timeout_sec = 30
tool_timeout_sec = 300
"@
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
Copy-Item -LiteralPath $configPath -Destination "$configPath.before-images-$stamp.bak"
if (Test-Path $toolDir) { Copy-Item -LiteralPath $toolDir -Destination "$toolDir.before-$stamp.bak" -Recurse }
$null = New-Item -ItemType Directory -Path $toolDir -Force
foreach ($name in @('server.mjs', 'start.ps1')) {
    Copy-Item -LiteralPath (Join-Path $sourceDir $name) -Destination (Join-Path $toolDir $name) -Force
}
[IO.File]::WriteAllText($configPath, ($text.TrimEnd() + "`n" + $block + "`n").Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
Write-Host 'Image tools installed. auth.json and your chat model catalog were not modified.'
Write-Host 'Fully quit and reopen the app, create a new conversation, then ask it to use koa_images to generate an image.'
Write-Host 'To undo: close the app and restore the config.toml.before-images backup.'
