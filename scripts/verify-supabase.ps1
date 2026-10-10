param(
  [string]$Email = "admin@govwh.local",
  [string]$Password = "TempPass123",
  [string]$Url = "https://mlqhupcwhveqddyagvuz.supabase.co",
  [string]$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scWh1cGN3aHZlcWRkeWFndnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NTcwMTcsImV4cCI6MjEwNzIzMzAxN30.7fmkhTmrFGuaEMrNkvkCVGzp-G7y_cZ0qyU2htZ5xCw"
)

$ErrorActionPreference = "Stop"
$results = @()

function Step($name, $ok, $detail) {
  $script:results += [pscustomobject]@{ Test = $name; Result = $(if ($ok) { "PASS" } else { "FAIL" }); Detail = $detail }
}

# ---------- 1. SIGN IN ----------
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
try {
  $login = Invoke-RestMethod -Uri "$Url/auth/v1/token?grant_type=password" -Method Post -Headers @{
    "apikey" = $AnonKey; "Content-Type" = "application/json"
  } -Body $loginBody -TimeoutSec 120
  $token = $login.access_token
  Step "Login (Supabase Auth)" $true ("user=$($login.user.id) expires_in=$($login.expires_in)")
} catch {
  Step "Login (Supabase Auth)" $false $_.Exception.Message
  $results | Format-Table -AutoSize
  exit 1
}

$headers = @{ "apikey" = $AnonKey; "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

# ---------- 2. PROFILE + PERMISSIONS ----------
try {
  $profile = Invoke-RestMethod -Uri "$Url/rest/v1/profiles?select=id,full_name_ar,is_active,role:roles(name_ar,permissions)&id=eq.$($login.user.id)" -Headers $headers -TimeoutSec 120
  $perms = $profile.role.permissions
  Step "Profile loaded" $true ("role=$($profile.role.name_ar) perms=$($perms.Count)")
} catch {
  Step "Profile loaded" $false $_.Exception.Message
  $results | Format-Table -AutoSize
  exit 1
}

function Rpc($name, $payload) {
  $body = $payload | ConvertTo-Json -Compress
  try {
    return Invoke-RestMethod -Uri "$Url/rest/v1/rpc/$name" -Method Post -Headers $headers -Body $body -TimeoutSec 180
  } catch {
    $detail = "RPC $name failed"
    try {
      if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $detail = $detail + " :: " + $sr.ReadToEnd()
      }
    } catch {}
    throw $detail
  }
}

function GetBalance($resourceId) {
  return Invoke-RestMethod -Uri "$Url/rest/v1/stock_balances?select=quantity&resource_id=eq.$resourceId" -Headers $headers -TimeoutSec 120
}

# ---------- 3. RECEIPT: balance increases ----------
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$res = Invoke-RestMethod -Uri "$Url/rest/v1/resources?select=id,name_ar,category_id,is_asset,is_consumable&limit=1" -Headers $headers -TimeoutSec 120
$resourceId = $res[0].id
$resourceName = $res[0].name_ar
$before = (GetBalance $resourceId).quantity
if (-not $before) { $before = 0 }

$receipt = Rpc "create_receipt_movement" @{ p_resource_id = $resourceId; p_quantity = 7; p_document_number = "VERIFY-$stamp"; p_supplier_name = "E2E verification"; p_notes = "automated read-only-free check"; p_idempotency_key = "verify-$stamp" }
$afterReceipt = (GetBalance $resourceId).quantity
Step "Receipt increases balance (+7)" ([double]$afterReceipt -eq ([double]$before + 7)) "number=$($receipt.movement_number) balance $before -> $afterReceipt"

# ---------- 4. DUPLICATE SUBMIT BLOCKED (idempotency) ----------
$dup = Rpc "create_receipt_movement" @{ p_resource_id = $resourceId; p_quantity = 7; p_document_number = "VERIFY-$stamp"; p_idempotency_key = "verify-$stamp" }
Step "Duplicate submit blocked" ($dup.movement_id -eq $receipt.movement_id) "same movement_id returned; balance still $((GetBalance $resourceId).quantity)"

# ---------- 5. DELIVERY: balance decreases ----------
$delivery = Rpc "create_delivery_movement" @{ p_resource_id = $resourceId; p_quantity = 3; p_recipient_name = "E2E Recipient"; p_document_number = "VERIFY-D-$stamp"; p_idempotency_key = "verify-d-$stamp" }
$afterDelivery = (GetBalance $resourceId).quantity
Step "Delivery decreases balance (-3)" ([double]$afterDelivery -eq ([double]$afterReceipt - 3)) "number=$($delivery.movement_number) balance $afterReceipt -> $afterDelivery"

# ---------- 6. OVER-DELIVERY REJECTED ----------
$available = [double]((GetBalance $resourceId).quantity)
$rejected = $false
try {
  Rpc "create_delivery_movement" @{ p_resource_id = $resourceId; p_quantity = ($available + 5000); p_recipient_name = "Should Fail" } | Out-Null
} catch {
  $rejected = $true
}
$still = (GetBalance $resourceId).quantity
Step "Over-delivery rejected" (($rejected) -and ([double]$still -eq $available)) "attempted $($available + 5000), balance unchanged at $still"

# ---------- 7. AUDIT LOG WRITTEN ----------
Start-Sleep -Seconds 1
$audit = Invoke-RestMethod -Uri "$Url/rest/v1/audit_logs?select=action,entity_type,created_at&order=created_at.desc&limit=5" -Headers $headers -TimeoutSec 120
$hasReceive = $audit | Where-Object { $_.action -eq "receive" }
Step "Audit log recorded" ($null -ne $hasReceive) ("actions=" + (($audit | ForEach-Object { $_.action }) -join ","))

# ---------- 8. REPORT DATA MATCHES MOVEMENTS ----------
$balances = Invoke-RestMethod -Uri "$Url/rest/v1/stock_balances?select=resource_id,quantity" -Headers $headers -TimeoutSec 120
$movements = Invoke-RestMethod -Uri "$Url/rest/v1/stock_movements?select=resource_id,quantity,movement_type,status" -Headers $headers -TimeoutSec 120
$bad = 0
foreach ($b in $balances) {
  $calc = 0.0
  foreach ($m in ($movements | Where-Object { $_.resource_id -eq $b.resource_id -and $_.status -eq "completed" })) {
    if ($m.movement_type -eq "receipt") { $calc += [double]$m.quantity }
    if ($m.movement_type -eq "delivery") { $calc -= [double]$m.quantity }
  }
  if ([math]::Abs($calc - [double]$b.quantity) -gt 0.001) { $bad++ }
}
Step "Reports match movements" ($bad -eq 0) ("checked $($balances.Count) balances, mismatches=$bad")

# ---------- 9. CANCEL MOVEMENT (correction authority) ----------
$cancelled = $false
try { Rpc "cancel_movement" @{ p_movement_id = $delivery.movement_id; p_reason = "E2E verification cancel" } | Out-Null; $cancelled = $true } catch {}
$finalBalance = (GetBalance $resourceId).quantity
Step "Cancel restores balance (+3)" (($cancelled) -and ([double]$finalBalance -eq ([double]$afterDelivery + 3))) "balance $afterDelivery -> $finalBalance"

# ---------- 10. UNAUTHORIZED WRITE BLOCKED WITHOUT SERVICE ROLE ----------
# (verifies only anon/auth caller gets no RLS write on stock_movements direct insert)
$directBlocked = $false
try {
  Invoke-RestMethod -Uri "$Url/rest/v1/stock_movements" -Method Post -Headers $headers -Body (@{
    movement_number = "HACK-$stamp"; movement_type = "receipt"; resource_id = $resourceId; quantity = 999; performed_by = $login.user.id
  } | ConvertTo-Json -Compress) -TimeoutSec 120 | Out-Null
} catch {
  $directBlocked = $true
}
Step "Direct table write blocked by RLS" $directBlocked "insert into stock_movements as authenticated user refused"

# ---------- 11. READ-ONLY TABLE RULES: categories visible ----------
$cats = Invoke-RestMethod -Uri "$Url/rest/v1/resource_categories?select=id,name_ar" -Headers $headers -TimeoutSec 120
Step "Reference data readable" ($cats.Count -gt 0) "categories=$($cats.Count)"

$results | Format-Table -AutoSize
$failCount = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Output ""
Write-Output "SUMMARY: $($results.Count - $failCount) passed, $failCount failed"
if ($failCount -gt 0) { exit 1 }
