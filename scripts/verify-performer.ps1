# ASCII-only script (no Arabic literals) so PowerShell 5.1 cannot mangle it.
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function A([int[]]$codes) { return -join ($codes | ForEach-Object { [char]$_ }) }

$PERF_R   = A 0x0627,0x062E,0x062A,0x0628,0x0627,0x0631,0x0020,0x0623,0x0645,0x064A,0x0646,0x0020,0x0627,0x0644,0x0645,0x0633,0x062A,0x0648,0x062F,0x0639
$PERF_D   = A 0x0645,0x0648,0x0638,0x0641,0x0020,0x0627,0x0644,0x062A,0x0633,0x0644,0x064A,0x0645,0x0020,0x0627,0x0644,0x0645,0x064A,0x062F,0x0627,0x0646,0x064A
$RECIP_D  = A 0x0645,0x0633,0x062A,0x0644,0x0645,0x0020,0x0627,0x0644,0x0627,0x062E,0x062A,0x0628,0x0627,0x0631
$BRANCH_D = A 0x0641,0x0631,0x0639,0x0020,0x0627,0x062E,0x062A,0x0628,0x0627,0x0631
$RECIP_2  = A 0x0645,0x0633,0x062A,0x0644,0x0645,0x0020,0x0628,0x062F,0x0648,0x0646,0x0020,0x0627,0x0633,0x0645,0x0020,0x0645,0x0646,0x0641,0x0630

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
Write-Output "login: OK"

$res = RestGet "resources?select=id,name_ar,is_asset,is_active`&is_active=eq.true`&is_asset=eq.false`&limit=1" $token
$resourceId = $res[0].id
Write-Output ("resource: {0}" -f $res[0].name_ar)

$balBefore = [double]((RestGet "stock_balances?select=quantity`&resource_id=eq.$resourceId" $token)[0].quantity)
Write-Output ("balance before: {0}" -f $balBefore)

function Rpc([string]$fn, $payloadObj) {
  $json = $payloadObj | ConvertTo-Json -Compress -Depth 5
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/rpc/$fn" -Method POST -Headers @{
    "apikey" = $script:SbKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 180 -UseBasicParsing
  return ($resp.Content | ConvertFrom-Json)
}

# 1. RECEIPT with performer name
$r = Rpc "create_receipt_movement" @{
  p_resource_id = $resourceId
  p_quantity = 5
  p_performed_by_name = $PERF_R
  p_document_number = "PERF-TEST-R"
  p_idempotency_key = "perf-test-r-$(Get-Date -Format yyyyMMddHHmmss)"
}
Write-Output ("receipt: {0}" -f $r.movement_number)

$m1 = RestGet "stock_movements?select=movement_number,performed_by_name`&movement_number=eq.$($r.movement_number)" $token
Write-Output ("  stored performed_by_name = [{0}]" -f $m1[0].performed_by_name)
Write-Output ("  exact arabic match: {0}" -f ($m1[0].performed_by_name -eq $PERF_R))

# 2. DELIVERY with performer name
$d = Rpc "create_delivery_movement" @{
  p_resource_id = $resourceId
  p_quantity = 2
  p_recipient_name = $RECIP_D
  p_branch_name = $BRANCH_D
  p_performed_by_name = $PERF_D
  p_document_number = "PERF-TEST-D"
  p_idempotency_key = "perf-test-d-$(Get-Date -Format yyyyMMddHHmmss)"
}
Write-Output ("delivery: {0}" -f $d.movement_number)

$m2 = RestGet "stock_movements?select=performed_by_name,recipient_name,to_branch_name`&movement_number=eq.$($d.movement_number)" $token
Write-Output ("  performed_by_name = [{0}]" -f $m2[0].performed_by_name)
Write-Output ("  recipient_name    = [{0}]" -f $m2[0].recipient_name)
Write-Output ("  to_branch_name    = [{0}]" -f $m2[0].to_branch_name)
Write-Output ("  performer exact match: {0}" -f ($m2[0].performed_by_name -eq $PERF_D))
Write-Output ("  fields are separate:   {0}" -f ($m2[0].performed_by_name -ne $m2[0].recipient_name))

# 3. Default fallback when omitted
$d2 = Rpc "create_delivery_movement" @{
  p_resource_id = $resourceId
  p_quantity = 1
  p_recipient_name = $RECIP_2
  p_idempotency_key = "perf-test-d2-$(Get-Date -Format yyyyMMddHHmmss)"
}
$m3 = RestGet "stock_movements?select=performed_by_name`&movement_number=eq.$($d2.movement_number)" $token
$fbName = [string]$m3[0].performed_by_name
Write-Output ("  omitted name -> fallback: [{0}]" -f $fbName)
Write-Output ("  fallback is arabic: {0}" -f (([regex]::Matches($fbName, '[\u0600-\u06FF]').Count -gt 0)))

# 4. Balance arithmetic
$balAfter = [double]((RestGet "stock_balances?select=quantity`&resource_id=eq.$resourceId" $token)[0].quantity)
$expected = $balBefore + 5 - 2 - 1
Write-Output ("balance: {0} -> {1} (expected {2}) arithmetic: {3}" -f $balBefore, $balAfter, $expected, $(if ([Math]::Abs($balAfter - $expected) -lt 0.001) { "OK" } else { "MISMATCH" }))

Write-Output "DONE"
