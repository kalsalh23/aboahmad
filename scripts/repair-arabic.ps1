param(
  [switch]$DryRun,
  [switch]$Full
)

# Repairs Windows-1252 double-encoded Arabic stored in the database.
# Transport is 100% ASCII (all Arabic sent as \uXXXX JSON escapes), verified safe.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$win1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8 = [System.Text.Encoding]::UTF8
$Arabic = '[\u0600-\u06FF]'

function IsArabic($s) { return ($s -and ([regex]::Matches($s, $Arabic)).Count -gt 0) }

function FixText([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $s }
  if (IsArabic $s) { return $s }
  try {
    return $utf8.GetString($win1252.GetBytes($s))
  } catch {
    return $s
  }
}

function JsonEscape([string]$s) {
  if ($null -eq $s) { return "" }
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $code = [int][char]$ch
    if ($code -lt 128) { [void]$sb.Append($ch) }
    else { [void]$sb.Append('\u'); [void]$sb.Append($code.ToString('x4')) }
  }
  return $sb.ToString()
}

Write-Output "=== login as admin ==="
$token = AdminLogin
Write-Output "  OK"

$targets = @(
  @{ Table = 'resource_categories'; Col = 'name_ar' },
  @{ Table = 'resource_categories'; Col = 'name_en' },
  @{ Table = 'resource_categories'; Col = 'description' },
  @{ Table = 'resources'; Col = 'name_ar' },
  @{ Table = 'resources'; Col = 'name_en' },
  @{ Table = 'units_of_measure'; Col = 'name_ar' },
  @{ Table = 'units_of_measure'; Col = 'name_en' },
  @{ Table = 'resource_custom_fields'; Col = 'field_name_ar' },
  @{ Table = 'resource_custom_fields'; Col = 'field_name' },
  @{ Table = 'roles'; Col = 'name_ar' },
  @{ Table = 'roles'; Col = 'name_en' },
  @{ Table = 'roles'; Col = 'description' },
  @{ Table = 'branches'; Col = 'name_ar' },
  @{ Table = 'branches'; Col = 'location' },
  @{ Table = 'departments'; Col = 'name_ar' },
  @{ Table = 'profiles'; Col = 'full_name_ar' }
)

$totalFixed = 0

foreach ($t in $targets) {
  $path = "$($t.Table)?select=id,$($t.Col)&limit=1000"
  $rows = RestGet $path $token
  if (-not $rows) { continue }

  $pending = @()
  foreach ($r in $rows) {
    $val = $r.$($t.Col)
    if ([string]::IsNullOrEmpty($val)) { continue }
    if (IsArabic $val) { continue }
    $fixed = FixText $val
    if (IsArabic $fixed) {
      $pending += [pscustomobject]@{ id = $r.id; new = $fixed }
    }
  }

  if ($pending.Count -eq 0) { continue }

  Write-Output ("  {0}.{1}: {2} rows to fix" -f $t.Table, $t.Col, $pending.Count)

  if ($DryRun) { continue }

  foreach ($p in $pending) {
    $body = '{"' + $t.Col + '":"' + (JsonEscape $p.new) + '"}'
    $bytes = $utf8.GetBytes($body)
    Invoke-WebRequest -Uri "$script:SbUrl/rest/v1/$($t.Table)?id=eq.$($p.id)" -Method PATCH -Headers @{
      "apikey" = $script:SbKey
      "Authorization" = "Bearer $token"
      "Content-Type" = "application/json; charset=utf-8"
      "Prefer" = "return=minimal"
    } -Body $bytes -TimeoutSec 120 -UseBasicParsing | Out-Null
    $totalFixed++
  }
  Write-Output ("    -> patched {0}" -f $pending.Count)
}

Write-Output ("TOTAL FIXED: {0}" -f $totalFixed)

Write-Output ""
Write-Output "=== Verify (byte level) ==="
$cats = RestGet "resource_categories?select=name_ar&order=sort_order" $token
$raw = ($cats | ConvertTo-Json -Compress -Depth 3)
$bytes = $utf8.GetBytes($raw)
$has = $false
for ($i = 0; $i -lt ($bytes.Length - 1); $i++) { if ($bytes[$i] -eq 0xD8 -and $bytes[$i+1] -eq 0xA7) { $has = $true; break } }
Write-Output ("categories JSON contains Arabic bytes (D8 A7): {0}" -f $has)

$units = RestGet "units_of_measure?select=name_ar&limit=3" $token
foreach ($u in $units) {
  $n = ([regex]::Matches($u.name_ar, $Arabic)).Count
  Write-Output ("  unit arabic_chars={0}" -f $n)
}

$roles = RestGet "roles?select=name_ar&order=created_at" $token
foreach ($r in $roles) {
  $n = ([regex]::Matches($r.name_ar, $Arabic)).Count
  Write-Output ("  role arabic_chars={0}" -f $n)
}

Write-Output "DONE"
