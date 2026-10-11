# supabase-tool.ps1
# UTF-8-safe helpers for Supabase (Avoids Windows PowerShell ANSI corruption of Arabic text)
# Usage:
#   . .\scripts\supabase-tool.ps1
#   DbQuery "select 1"                       # run SQL via Management API
#   DbRows "select name_ar from public.roles"  # rows as objects
#   RestGet "roles?select=name_ar"           # anonymous REST read
#   AdminLogin                               # returns token for 0912312312

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
$script:SbUrl  = "https://mlqhupcwhveqddyagvuz.supabase.co"
$script:SbMgmt = "sbp_v0_e25e006df4afeba3b7c95557fb7f2ff3e715439d"

$keyLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' } | Select-Object -First 1
if (-not $keyLine) { throw "anon key not found in $envFile" }
$script:SbKey = ($keyLine -replace '^VITE_SUPABASE_ANON_KEY=', '').Trim()
if (-not $script:SbKey) { throw "anon key is empty in $envFile" }

function DbQuery {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $body = @{ query = $Sql } | ConvertTo-Json -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $resp = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/mlqhupcwhveqddyagvuz/database/query" -Method POST -Headers @{
    "Authorization" = "Bearer $script:SbMgmt"
    "Content-Type"  = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 600 -UseBasicParsing
  return $resp.Content
}

function DbRows {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $json = DbQuery $Sql
  if (-not $json) { return @() }
  return $json | ConvertFrom-Json
}

function RestGet {
  param([Parameter(Mandatory = $true)][string]$Path, [string]$Token = "")
  $h = @{ "apikey" = $script:SbKey }
  if ($Token) { $h["Authorization"] = "Bearer $Token" }
  return Invoke-RestMethod -Uri "$script:SbUrl/rest/v1/$Path" -Headers $h -TimeoutSec 180
}

function RestGetRaw {
  param([Parameter(Mandatory = $true)][string]$Path, [string]$Token = "")
  $h = @{ "apikey" = $script:SbKey }
  if ($Token) { $h["Authorization"] = "Bearer $Token" }
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/$Path" -Headers $h -TimeoutSec 180 -UseBasicParsing
  return $resp.RawContentStream.ToArray()
}

function RestPost {
  param([Parameter(Mandatory = $true)][string]$Path, [string]$Body, [string]$Token = "")
  $h = @{ "apikey" = $script:SbKey; "Content-Type" = "application/json; charset=utf-8" }
  if ($Token) { $h["Authorization"] = "Bearer $Token" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/$Path" -Method POST -Headers $h -Body $bytes -TimeoutSec 180 -UseBasicParsing
  return $resp.Content
}

function RpcAnon {
  param([Parameter(Mandatory = $true)][string]$Fn, [string]$Body)
  return RestPost "rpc/$Fn" $Body
}

function AdminLogin {
  $email = (RpcAnon "resolve_login_email" (@{ p_identifier = "0912312312" } | ConvertTo-Json -Compress)) | ConvertFrom-Json
  $body = @{ email = $email; password = "123123123" } | ConvertTo-Json -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/auth/v1/token?grant_type=password" -Method POST -Headers @{
    "apikey" = $script:SbKey; "Content-Type" = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 180 -UseBasicParsing
  return ($resp.Content | ConvertFrom-Json).access_token
}

function ShowArabic {
  param([Parameter(Mandatory = $true)][string]$Text)
  if (-not $Text) { return "" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
