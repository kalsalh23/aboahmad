$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
$res = RestGet "resources?select=id`&is_active=eq.true`&is_asset=eq.false`&limit=1" $token
$id = $res[0].id

function Rpc([string]$fn, $payloadObj) {
  $json = $payloadObj | ConvertTo-Json -Compress -Depth 5
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  for ($i = 1; $i -le 3; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/rpc/$fn" -Method POST -Headers @{
        "apikey" = $script:SbKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8"
      } -Body $bytes -TimeoutSec 180 -UseBasicParsing
      return ($resp.Content | ConvertFrom-Json)
    } catch {
      $code = 0
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      Write-Output ("  attempt {0} failed HTTP {1}" -f $i, $code)
      Start-Sleep -Seconds 3
    }
  }
  throw "RPC failed after retries"
}

$RECIP = -join @([char]0x0645,[char]0x0633,[char]0x062A,[char]0x0644,[char]0x0645,[char]0x0020,[char]0x0627,[char]0x062D,[char]0x062A,[char]0x0628,[char]0x0627,[char]0x0631)

$d2 = Rpc "create_delivery_movement" @{
  p_resource_id = $id
  p_quantity = 1
  p_recipient_name = $RECIP
  p_idempotency_key = "fallback-test-$(Get-Date -Format yyyyMMddHHmmssfff)"
}
Write-Output ("delivery: {0}" -f $d2.movement_number)

$m3 = RestGet "stock_movements?select=performed_by_name`&movement_number=eq.$($d2.movement_number)" $token
$fb = [string]$m3[0].performed_by_name
Write-Output ("  omitted name -> fallback: [{0}]" -f $fb)
$c = [regex]::Matches($fb, '[\u0600-\u06FF]').Count
Write-Output ("  fallback arabic chars: {0}" -f $c)
if ($c -gt 0) { Write-Output "  FALLBACK: OK (defaults to logged-in user's name)" } else { Write-Output "  FALLBACK: PROBLEM" }

$b = [double]((RestGet "stock_balances?select=quantity`&resource_id=eq.$id" $token)[0].quantity)
Write-Output ("  balance now: {0} (expected 2)" -f $b)
Write-Output "DONE"
