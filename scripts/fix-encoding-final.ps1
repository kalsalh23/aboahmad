# fix-encoding-final.ps1
# Fixes double-encoded (mojibake) Arabic text in the database.
# Uses \u escapes (ASCII-safe) so no Arabic literals are needed in this script.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

$ArabicPattern = '[\u0600-\u06FF]'
$latin1 = [System.Text.Encoding]::GetEncoding(28591)

function RepairText([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $s }
  return [System.Text.Encoding]::UTF8.GetString($latin1.GetBytes($s))
}

function CountArabic([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return 0 }
  return [regex]::Matches($s, $ArabicPattern).Count
}

Write-Output "=== Test repair logic ==="
$test = [char]0xD8 + [char]0xA7 + [char]0xD9 + [char]0x84 + [char]0xD9 + [char]0x85
$repaired = RepairText $test
$a = CountArabic $repaired
Write-Output ("  test arabic_chars={0}" -f $a)
if ($a -eq 0) { throw "repair logic failed" }

Write-Output ""
Write-Output "=== Repairing database rows ==="

$tables = @(
  @{ Table = 'public.roles'; Col = 'name_ar' },
  @{ Table = 'public.resource_categories'; Col = 'name_ar' },
  @{ Table = 'public.resources'; Col = 'name_ar' },
  @{ Table = 'public.units_of_measure'; Col = 'name_ar' },
  @{ Table = 'public.resource_custom_fields'; Col = 'field_name_ar' },
  @{ Table = 'public.branches'; Col = 'name_ar' },
  @{ Table = 'public.departments'; Col = 'name_ar' },
  @{ Table = 'public.profiles'; Col = 'full_name_ar' }
)

foreach ($t in $tables) {
  $rows = DbRows "select id, $($t.Col) as val from $($t.Table) where $($t.Col) is not null"
  $fixed = 0
  foreach ($row in $rows) {
    $original = $row.val
    if ([string]::IsNullOrEmpty($original)) { continue }
    $clean = RepairText $original
    if ((CountArabic $clean) -gt 0) {
      $esc = $clean.Replace("'", "''")
      DbQuery "update $($t.Table) set $($t.Col) = '$esc' where id = '$($row.id)'" | Out-Null
      $fixed++
    }
  }
  Write-Output ("  {0}: repaired {1} of {2}" -f $t.Table, $fixed, $rows.Count)
}

Write-Output ""
Write-Output "=== Verify ==="
foreach ($t in $tables) {
  $rows = DbRows "select $($t.Col) as val from $($t.Table) where $($t.Col) is not null limit 2"
  foreach ($row in $rows) {
    Write-Output ("  {0}: arabic_chars={1}" -f $t.Table, (CountArabic $row.val))
  }
}

Write-Output ""
Write-Output "=== Set single manager account (phone 0912312312) ==="
$adminSql = @'
update public.roles
set permissions = array['receipt.create','receipt.view','delivery.create','delivery.view','stock.view','resources.manage','categories.manage','users.manage','reports.view','audit.view','movement.cancel','settings.manage','*']
where name_ar like '%' || chr(1605) || chr(1583) || chr(1610) || chr(1585) || '%' or name_en = 'admin';

update public.profiles
set role_id = (select id from public.roles where name_en = 'admin' limit 1),
    is_active = true
where phone = '0912312312' or username = '0912312312';

update public.profiles set is_active = false
where (phone <> '0912312312' or phone is null) and (username <> '0912312312' or username is null);
'@
DbQuery $adminSql | Out-Null
Write-Output "  manager role and single-account lock applied"

$admin = DbRows "select p.full_name_ar, p.phone, p.is_active, r.name_ar as role from public.profiles p left join public.roles r on r.id = p.role_id"
foreach ($p in $admin) {
  Write-Output ("  name=[{0}] phone=[{1}] active={2} role=[{3}] arabic={4}" -f $p.full_name_ar, $p.phone, $p.is_active, $p.role, (CountArabic $p.full_name_ar))
}

$cats = DbRows "select name_ar from public.resource_categories order by sort_order limit 4"
foreach ($c in $cats) {
  Write-Output ("  CAT arabic={0} len={1}" -f (CountArabic $c.name_ar), $c.name_ar.Length)
}

Write-Output "DONE"
