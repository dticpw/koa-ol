# Run after fully closing the Codex/ChatGPT desktop app.
# Backs up config, installs the model catalog, and saves only this user's key env var.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$configPath = Join-Path $codexDir 'config.toml'
$catalogPath = Join-Path $codexDir 'koa-models.json'
$sourceCatalog = Join-Path $PSScriptRoot 'models.json'
if (!(Test-Path $sourceCatalog)) { throw 'models.json must be beside this script.' }
$null = Get-Content -Raw $sourceCatalog | ConvertFrom-Json
$text = if (Test-Path $configPath) { [IO.File]::ReadAllText($configPath) } else { '' }
if ($text -match '(?m)^\s*\[model_providers\.koa_proxy(?:\]|\.)') {
    throw 'koa_proxy is already configured; review the existing config instead of overwriting it.'
}
# Edit root scalars only; preserve every existing provider, MCP server and project table.
$firstTable = [regex]::Match($text, '(?m)^\s*\[')
$rootText = if ($firstTable.Success) { $text.Substring(0, $firstTable.Index) } else { $text }
$tableText = if ($firstTable.Success) { $text.Substring($firstTable.Index) } else { '' }
$rootText = [regex]::Replace($rootText, '(?m)^\s*(model_provider|model|model_reasoning_effort|model_catalog_json|service_tier)\s*=.*(?:\r?\n|$)', '')
$portableCatalog = $catalogPath.Replace('\', '/')
if ($portableCatalog.Contains('"')) { throw 'The catalog path cannot contain quotation marks.' }
$rootSettings = @"
model_provider = "koa_proxy"
model = "gpt-6-astra"
model_reasoning_effort = "medium"
model_catalog_json = "$portableCatalog"

"@
$provider = @'

[model_providers.koa_proxy]
name = "Koa multi-model proxy"
base_url = "https://koa-ol.com/ai/v1"
env_key = "KOA_CODEX_API_KEY"
wire_api = "responses"
supports_websockets = false
'@
$secureKey = Read-Host 'Paste the NEW Koa client API key (input hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $clientKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if (!$clientKey.StartsWith('koa_') -or $clientKey.Length -lt 40) { throw 'Unexpected Koa key format.' }
    # Validate before changing local settings; never display the key.
    $models = Invoke-RestMethod -Uri 'https://koa-ol.com/ai/v1/models' -Headers @{Authorization="Bearer $clientKey"} -TimeoutSec 30
    $expected = @('gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5')
    foreach ($id in $expected) { if ($models.data.id -notcontains $id) { throw "Key does not grant $id" } }
    $null = New-Item -ItemType Directory -Path $codexDir -Force
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    if (Test-Path $configPath) { Copy-Item $configPath "$configPath.before-koa-$stamp.bak" }
    if (Test-Path $catalogPath) { Copy-Item $catalogPath "$catalogPath.before-koa-$stamp.bak" }
    Copy-Item $sourceCatalog $catalogPath
    $updated = ($rootSettings + "`n" + $rootText + "`n" + $tableText + "`n" + $provider + "`n").Replace("`r`n", "`n")
    [IO.File]::WriteAllText($configPath, $updated, (New-Object Text.UTF8Encoding($false)))
    [Environment]::SetEnvironmentVariable('KOA_CODEX_API_KEY', $clientKey, 'User')
    $env:KOA_CODEX_API_KEY = $clientKey
    Write-Host "Configured $configPath; key validated without displaying it."
    Write-Host 'Sign out/in to Windows, then reopen the app and create a NEW conversation.'
    Write-Host 'The Windows App model menu and actual tool execution still require verification.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Variable clientKey -ErrorAction SilentlyContinue
}
