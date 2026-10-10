param(
  [string]$Identifier = "0912312312",
  [string]$Password = "123123123"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

Write-Output "=== Login via app flow ==="
$email = (RpcAnon "resolve_login_email" (@{ p_identifier = $Identifier } | ConvertTo-Json -Compress)) | ConvertFrom-Json
Write-Output "  resolved email: $email"

$body = @{ email = $email; password = $Password } | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$resp = Invoke-WebRequest -Uri "$script:SbUrl/auth/v1/token?grant_type=password" -Method POST -Headers @{
  "apikey" = $script:SbKey; "Content-Type" = "application/json; charset=utf-8"
} -Body $bytes -TimeoutSec 180 -UseBasicParsing
$token = ($resp.Content | ConvertFrom-Json).access_token
Write-Output "  LOGIN: OK"

$profile = RestGet "profiles?select=full_name_ar,phone,username,is_active,role:roles(name_ar,permissions)&id=eq.$((($resp.Content | ConvertFrom-Json).user.id))" $token
$p = $profile[0]
Write-Output ("  name=[{0}] phone=[{1}] active={2}" -f $p.full_name_ar, $p.phone, $p.is_active)
Write-Output ("  role=[{0}] perms={1}" -f $p.role.name_ar, $p.role.permissions.Count)
Write-Output ("  permissions: {0}" -f ($p.role.permissions -join ", "))

Write-Output ""
Write-Output "=== Data check (what the UI shows) ==="
$cats = RestGet "resource_categories?select=name_ar&is_active=eq.true&order=sort_order" $token
Write-Output ("  categories ({0}):" -f $cats.Count)
foreach ($c in $cats) { Write-Output ("    [{0}]" -f $c.name_ar) }

$res = RestGet "resources?select=name_ar,category_id&is_active=eq.true" $token
Write-Output ("  active resources: {0}" -f $res.Count)

$fields = RestGet "resource_custom_fields?select=field_name_ar,field_name" $token
Write-Output ("  custom fields ({0}):" -f $fields.Count)
foreach ($f in $fields) { Write-Output ("    [{0}] ({1})" -f $f.field_name_ar, $f.field_name) }

$units = RestGet "units_of_measure?select=name_ar" $token
Write-Output ("  units ({0}):" -f $units.Count)

$branches = RestGet "branches?select=name_ar,location" $token
foreach ($b in $branches) { Write-Output ("  branch: [{0}] loc=[{1}]" -f $b.name_ar, $b.location) }

$depts = RestGet "departments?select=name_ar" $token
Write-Output ("  departments ({0}):" -f $depts.Count)

$assets = RestGet "individual_assets?select=asset_number,status" $token
Write-Output ("  assets: {0}" -f $assets.Count)

$moves = RestGet "stock_movements?select=movement_number,movement_type,quantity,status" $token
Write-Output ("  movements: {0}" -f $moves.Count)

Write-Output ""
Write-Output "=== Bad-login guard ==="
try {
  $badBody = @{ email = $email; password = "wrong-password" } | ConvertTo-Json -Compress
  Invoke-WebRequest -Uri "$script:SbUrl/auth/v1/token?grant_type=password" -Method POST -Headers @{
    "apikey" = $script:SbKey; "Content-Type" = "application/json; charset=utf-8"
  } -Body ([System.Text.Encoding]::UTF8.GetBytes($badBody)) -TimeoutSec 120 -UseBasicParsing | Out-Null
  Write-Output "  wrong password ACCEPTED (security issue!)"
} catch {
  Write-Output ("  wrong password rejected: HTTP {0}" -f [int]$_.Exception.Response.StatusCode)
}

Write-Output "DONE"
