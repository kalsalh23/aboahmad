# test-encoding.ps1
# Byte-level test to find a reliable way to write/read Arabic in the database.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$utf8 = [System.Text.Encoding]::UTF8

function RawDb([string]$sql) {
  $body = @{ query = $sql } | ConvertTo-Json -Compress
  $bytes = $utf8.GetBytes($body)
  $resp = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/mlqhupcwhveqddyagvuz/database/query" -Method POST -Headers @{
    "Authorization" = "Bearer $script:SbMgmt"; "Content-Type" = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 300 -UseBasicParsing
  return [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
}

function RawRest([string]$path, [string]$token = "") {
  $h = @{ "apikey" = $script:SbKey }
  if ($token) { $h["Authorization"] = "Bearer $token" }
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/$path" -Headers $h -TimeoutSec 180 -UseBasicParsing
  return [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
}

# Arabic test string built from hex bytes to be encoding-safe: "ابو احمد"
$arabicBytes = [byte[]]@(0xD8,0xA7,0xD8,0xA8,0xD9,0x88,0x20,0xD8,0xA7,0xD8,0xAD,0xD9,0x85,0xD8,0xAF)
$arabic = $utf8.GetString($arabicBytes)
Write-Output ("test string arabic_chars={0}" -f ([regex]::Matches($arabic, '[\u0600-\u06FF]').Count))

# WRITE via management API (Arabic escaped as \u sequences inside SQL to avoid any transport issue)
$sqlEscaped = "N'\u0627\u0628\u0648 \u0627\u062D\u0645\u062F'"
$w1 = RawDb "update public.branches set name_ar = $sqlEscaped where id = (select id from public.branches limit 1)"

# READ raw and check bytes for D8 A7 (first letter of Arabic)
$r1 = RawRest "branches?select=name_ar"
$b1 = $utf8.GetBytes($r1)
$hasD8A7 = $false
for ($i = 0; $i -lt ($b1.Length - 1); $i++) { if ($b1[$i] -eq 0xD8 -and $b1[$i+1] -eq 0xA7) { $hasD8A7 = $true; break } }
Write-Output ("WRITE/READ via \u escapes: contains D8 A7 (valid Arabic) = {0}" -f $hasD8A7)

# Alternative: write via REST PATCH with explicit UTF-8 bytes
$token = AdminLogin
$patchBody = '{"name_ar":"\u0627\u0628\u0648 \u0627\u062D\u0645\u062F"}'
$patchBytes = $utf8.GetBytes($patchBody)
$resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/branches?id=eq.$((RawRest 'branches?select=id&limit=1' | ConvertFrom-Json)[0].id)" -Method PATCH -Headers @{
  "apikey" = $script:SbKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8"; "Prefer" = "return=representation"
} -Body $patchBytes -TimeoutSec 180 -UseBasicParsing
$r2 = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
$b2 = $utf8.GetBytes($r2)
$hasD8A7b = $false
for ($i = 0; $i -lt ($b2.Length - 1); $i++) { if ($b2[$i] -eq 0xD8 -and $b2[$i+1] -eq 0xA7) { $hasD8A7b = $true; break } }
Write-Output ("WRITE/READ via REST PATCH: contains D8 A7 (valid Arabic) = {0}" -f $hasD8A7b)

Write-Output "DONE"
