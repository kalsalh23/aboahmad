$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
$res = RestGet "resources?select=id`&is_active=eq.true`&is_asset=eq.false`&limit=1" $token
$id = $res[0].id

$RECIP = -join @([char]0x0645,[char]0x0633,[char]0x062A,[char]0x0644,[char]0x0645,[char]0x0020,[char]0x0627,[char]0x062D,[char]0x062A,[char]0x0628,[char]0x0627,[char]0x0631)

$json = @{
  p_resource_id = $id
  p_quantity = 1
  p_recipient_name = $RECIP
  p_idempotency_key = "fallback-test-$(Get-Date -Format yyyyMMddHHmmssfff)"
} | ConvertTo-Json -Compress -Depth 5

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
Write-Output ("payload: {0}" -f $json)

try {
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/rpc/create_delivery_movement" -Method POST -Headers @{
    "apikey" = $script:SbKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 180 -UseBasicParsing
  Write-Output ("SUCCESS: {0}" -f $resp.Content)
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    Write-Output ("HTTP {0}: {1}" -f [int]$resp.StatusCode, $sr.ReadToEnd())
  } else {
    Write-Output ("ERR: {0}" -f $_.Exception.Message)
  }
}
Write-Output "DONE"
