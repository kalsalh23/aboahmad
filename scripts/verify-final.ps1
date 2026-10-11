$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function A([int[]]$codes) { return -join ($codes | ForEach-Object { [char]$_ }) }

$PERF_R  = A 0x0627,0x062E,0x062A,0x0628,0x0627,0x0631,0x0020,0x0623,0x0645,0x064A,0x0646,0x0020,0x0627,0x0644,0x0645,0x0633,0x062A,0x0648,0x062F,0x0639
$PERF_D  = A 0x0645,0x0648,0x0638,0x0641,0x0020,0x0627,0x0644,0x062A,0x0633,0x0644,0x064A,0x0645,0x0020,0x0627,0x0644,0x0645,0x064A,0x062F,0x0627,0x0646,0x064A
$RECIP   = A 0x0645,0x0633,0x062A,0x0644,0x0645,0x0020,0x0627,0x0644,0x0627,0x062E,0x062A,0x0628,0x0627,0x0631

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
$res = RestGet "resources?select=id`&is_active=eq.true`&is_asset=eq.false`&limit=1" $token
$id = $res[0].id
$balBefore = [double]((RestGet "stock_balances?select=quantity`&resource_id=eq.$id" $token)[0].quantity)
Write-Output ("resource: {0}, balance before: {1}" -f $res[0].name_ar, $balBefore)

function Rpc([string]$fn, $obj) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 5))
  $resp = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/rpc/$fn" -Method POST -Headers @{
    "apikey" = $script:SbKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8"
  } -Body $bytes -TimeoutSec 180 -UseBasicParsing
  return ($resp.Content | ConvertFrom-Json)
}

# A. receipt with performer, WITHOUT branch fields (tests unambiguous overload)
$a = Rpc "create_receipt_movement" @{
  p_resource_id = $id; p_quantity = 5
  p_performed_by_name = $PERF_R
  p_idempotency_key = "final-r-$(Get-Date -Format yyyyMMddHHmmssfff)"
}
$ma = RestGet "stock_movements?select=performed_by_name`&movement_number=eq.$($a.movement_number)" $token
Write-Output ("A. receipt  {0}  performer=[{1}]  exact={2}" -f $a.movement_number, $ma[0].performed_by_name, ($ma[0].performed_by_name -eq $PERF_R))

# B. delivery with performer, WITHOUT branch name (the case that used to break)
$b = Rpc "create_delivery_movement" @{
  p_resource_id = $id; p_quantity = 2
  p_recipient_name = $RECIP
  p_performed_by_name = $PERF_D
  p_idempotency_key = "final-d-$(Get-Date -Format yyyyMMddHHmmssfff)"
}
$mb = RestGet "stock_movements?select=performed_by_name,recipient_name,to_branch_name`&movement_number=eq.$($b.movement_number)" $token
Write-Output ("B. delivery {0}  performer=[{1}]  exact={2}" -f $b.movement_number, $mb[0].performed_by_name, ($mb[0].performed_by_name -eq $PERF_D))
Write-Output ("   recipient=[{0}]  branch=[{1}]  separate={2}" -f $mb[0].recipient_name, $mb[0].to_branch_name, ($mb[0].performed_by_name -ne $mb[0].recipient_name))

# C. receipt with NO performer name -> falls back to logged-in user
$c = Rpc "create_receipt_movement" @{
  p_resource_id = $id; p_quantity = 1
  p_idempotency_key = "final-r2-$(Get-Date -Format yyyyMMddHHmmssfff)"
}
$mc = RestGet "stock_movements?select=performed_by_name`&movement_number=eq.$($c.movement_number)" $token
$cAr = [regex]::Matches([string]$mc[0].performed_by_name, '[\u0600-\u06FF]').Count
Write-Output ("C. receipt  {0}  fallback=[{1}]  arabic={2}" -f $c.movement_number, $mc[0].performed_by_name, $cAr)

# D. report columns must resolve
$rep = RestGetRaw "stock_movements?select=movement_number,performed_by_name,recipient_name,to_branch_name,resource:resources(name_ar)`&order=created_at.desc`&limit=2" $token
$repTxt = [System.Text.Encoding]::UTF8.GetString($rep)
Write-Output ("D. report select OK: {0}" -f ($repTxt -match 'performed_by_name'))

$balAfter = [double]((RestGet "stock_balances?select=quantity`&resource_id=eq.$id" $token)[0].quantity)
$expected = $balBefore + 5 - 2 + 1
Write-Output ("balance: {0} -> {1} (expected {2})  {3}" -f $balBefore, $balAfter, $expected, $(if ([Math]::Abs($balAfter - $expected) -lt 0.001) { "OK" } else { "MISMATCH" }))

Write-Output "DONE"
