# apply-migrations.ps1
# Apply Supabase migrations via the Management API.
# Usage: ./apply-migrations.ps1 -Token "sbp_..." -Ref "project-ref"

param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Ref
)

$ErrorActionPreference = "Stop"

$files = @(
  "supabase\migrations\001_init_schema.sql",
  "supabase\migrations\002_rls_policies.sql",
  "supabase\migrations\003_functions.sql",
  "supabase\migrations\004_seed_data.sql"
)

$uri = "https://api.supabase.com/v1/projects/$Ref/database/query"

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    Write-Output "SKIP (not found): $file"
    continue
  }

  $full = (Resolve-Path $file).Path
  $sql = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  $body = @{ query = $sql } | ConvertTo-Json -Compress

  $ok = $false
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $r = Invoke-WebRequest -Uri $uri -Method POST -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type"  = "application/json"
      } -Body $body -TimeoutSec 600 -UseBasicParsing
      Write-Output "OK ($($r.StatusCode)): $file"
      $ok = $true
      break
    } catch {
      $msg = $_.Exception.Message
      try {
        if ($_.Exception.Response) {
          $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
          $msg = $sr.ReadToEnd()
        }
      } catch {}
      Write-Output "FAIL attempt $attempt : $file : $msg"
      Start-Sleep -Seconds 5
    }
  }

  if (-not $ok) {
    Write-Output "STOPPED due to failure: $file"
    exit 1
  }
}

Write-Output "ALL MIGRATIONS APPLIED."
