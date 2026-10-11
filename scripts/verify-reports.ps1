$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
Write-Output "login: OK"

# Categories must be valid Arabic
$catResp = RestGetRaw "resource_categories?select=id,name_ar&is_active=eq.true&order=sort_order" $token
$catBytes = [System.Text.Encoding]::UTF8.GetString($catResp)
$arabic = [regex]::Matches($catBytes, '[\u0600-\u06FF]').Count
Write-Output "categories arabic chars: $arabic"

$cats = $catBytes | ConvertFrom-Json
foreach ($c in $cats) { Write-Output ("  cat: {0}" -f $c.name_ar) }

# Movements query must work with the new column selected
$movResp = RestGetRaw "stock_movements?select=movement_number,movement_type,quantity,recipient_name,to_branch_name,to_branch:branches(name_ar)&limit=3" $token
$movBytes = [System.Text.Encoding]::UTF8.GetString($movResp)
if ($movBytes -match 'to_branch_name') { Write-Output "movements query with to_branch_name: OK" } else { Write-Output "movements query issue: $movBytes" }

# RPC signature must accept p_branch_name
$hasParam = $false
try {
  $r = Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/rpc/create_delivery_movement" -Method POST -Headers @{
    "apikey" = $script:SbKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8"
  } -Body ([System.Text.Encoding]::UTF8.GetBytes('{"p_resource_id":"00000000-0000-0000-0000-000000000000","p_quantity":1,"p_branch_name":"test"}')) -TimeoutSec 120 -UseBasicParsing
  $hasParam = $true
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $bodyTxt = $sr.ReadToEnd()
    if ($bodyTxt -match 'PGRST202|could not find|schema cache') { Write-Output "RPC param check: PARAM NOT FOUND -> $bodyTxt" }
    else { Write-Output "RPC param accepted (validation error expected): OK" }
  } else { Write-Output "RPC error: $($_.Exception.Message)" }
}
if ($hasParam) { Write-Output "RPC param accepted: OK" }

Write-Output "DONE"
