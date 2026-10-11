$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
Write-Output "login: OK"

# 1. New column readable
$r = RestGetRaw "stock_movements?select=movement_number,to_branch_name&limit=2" $token
$txt = [System.Text.Encoding]::UTF8.GetString($r)
Write-Output "column select result: $txt"

# 2. Embedded relations still resolve
$r2 = RestGetRaw "stock_movements?select=movement_number,resource:resources(name_ar,category:resource_categories(name_ar))&limit=1" $token
Write-Output ("embedded select: {0}" -f ([System.Text.Encoding]::UTF8.GetString($r2)))

# 3. RPC accepts p_branch_name
$payload = '{"p_resource_id":"00000000-0000-0000-0000-000000000000","p_quantity":1,"p_branch_name":"test-branch"}'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
try {
  Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/rpc/create_delivery_movement" -Method POST -Headers @{
    "apikey" = $script:SbKey
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 120 -UseBasicParsing | Out-Null
  Write-Output "RPC accepted params (unexpected success)"
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $bodyTxt = $sr.ReadToEnd()
    Write-Output ("RPC response HTTP {0}: {1}" -f [int]$resp.StatusCode, $bodyTxt)
    if ($bodyTxt -match 'PGRST202') {
      Write-Output "RESULT: p_branch_name NOT RECOGNISED (schema cache stale)"
    } else {
      Write-Output "RESULT: p_branch_name recognised (function ran, expected resource error)"
    }
  } else {
    Write-Output "RPC error: $($_.Exception.Message)"
  }
}

Write-Output "DONE"
