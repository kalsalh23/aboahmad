$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$token = AdminLogin
$res = RestGet "resources?select=id`&is_active=eq.true`&is_asset=eq.false`&limit=1" $token
$id = $res[0].id
$b = [double]((RestGet "stock_balances?select=quantity`&resource_id=eq.$id" $token)[0].quantity)
Write-Output ("balance now: {0}   (expected 2 after +5 -2 -1)" -f $b)

$m = RestGet "stock_movements?select=movement_number,performed_by_name,recipient_name,movement_type`&order=created_at.desc`&limit=4" $token
foreach ($x in $m) {
  Write-Output ("  {0} [{1}] performer=[{2}] recipient=[{3}]" -f $x.movement_number, $x.movement_type, $x.performed_by_name, $x.recipient_name)
}
Write-Output "DONE"
