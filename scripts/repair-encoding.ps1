param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

# The stored text is mojibake: each stored character is a raw byte value (0x80-0xFF)
# that should be re-interpreted as UTF-8.
# Repair entirely inside PostgreSQL so no transport encoding can corrupt it:
#   convert_to(col,'LATIN1')  -> bytes (one per stored char)
#   convert_from(...,'UTF8')  -> proper UTF-8 text

Write-Output "=== BEFORE: raw byte check ==="
$before = DbRows @'
select
  (select count(*) from public.resource_categories where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_categories,
  (select count(*) from public.resources where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_resources,
  (select count(*) from public.units_of_measure where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_units,
  (select count(*) from public.resource_custom_fields where field_name_ar ~ '[\xC0-\xFF]' and field_name_ar !~ '[\u0600-\u06FF]') as bad_fields,
  (select count(*) from public.roles where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_roles,
  (select count(*) from public.branches where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_branches,
  (select count(*) from public.departments where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_departments,
  (select count(*) from public.profiles where full_name_ar ~ '[\xC0-\xFF]' and full_name_ar !~ '[\u0600-\u06FF]') as bad_profiles
'@
$b = $before[0]
Write-Output ("  categories={0} resources={1} units={2} fields={3} roles={4} branches={5} depts={6} profiles={7}" -f `
  $b.bad_categories, $b.bad_resources, $b.bad_units, $b.bad_fields, $b.bad_roles, $b.bad_branches, $b.bad_departments, $b.bad_profiles)

if ($DryRun) {
  Write-Output "DRY RUN - no changes made"
  return
}

Write-Output ""
Write-Output "=== Repairing inside PostgreSQL ==="

$repair = @'
-- categories
update public.resource_categories
set name_ar = convert_from(convert_to(name_ar, 'LATIN1'), 'UTF8'),
    name_en = case when name_en ~ '[\xC0-\xFF]' and name_en !~ '[\u0600-\u06FF]'
                   then convert_from(convert_to(name_en, 'LATIN1'), 'UTF8') else name_en end,
    description = case when description is not null and description ~ '[\xC0-\xFF]' and description !~ '[\u0600-\u06FF]'
                       then convert_from(convert_to(description, 'LATIN1'), 'UTF8') else description end
where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]';

-- resources
update public.resources
set name_ar = convert_from(convert_to(name_ar, 'LATIN1'), 'UTF8'),
    name_en = case when name_en ~ '[\xC0-\xFF]' and name_en !~ '[\u0600-\u06FF]'
                   then convert_from(convert_to(name_en, 'LATIN1'), 'UTF8') else name_en end
where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]';

-- units
update public.units_of_measure
set name_ar = convert_from(convert_to(name_ar, 'LATIN1'), 'UTF8'),
    name_en = case when name_en ~ '[\xC0-\xFF]' and name_en !~ '[\u0600-\u06FF]'
                   then convert_from(convert_to(name_en, 'LATIN1'), 'UTF8') else name_en end
where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]';

-- custom fields
update public.resource_custom_fields
set field_name_ar = convert_from(convert_to(field_name_ar, 'LATIN1'), 'UTF8'),
    field_name = case when field_name ~ '[\xC0-\xFF]' and field_name !~ '[\u0600-\u06FF]'
                      then convert_from(convert_to(field_name, 'LATIN1'), 'UTF8') else field_name end
where field_name_ar ~ '[\xC0-\xFF]' and field_name_ar !~ '[\u0600-\u06FF]';

-- roles
update public.roles
set name_ar = convert_from(convert_to(name_ar, 'LATIN1'), 'UTF8'),
    name_en = case when name_en ~ '[\xC0-\xFF]' and name_en !~ '[\u0600-\u06FF]'
                   then convert_from(convert_to(name_en, 'LATIN1'), 'UTF8') else name_en end,
    description = case when description is not null and description ~ '[\xC0-\xFF]' and description !~ '[\u0600-\u06FF]'
                       then convert_from(convert_to(description, 'LATIN1'), 'UTF8') else description end
where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]';

-- branches
update public.branches
set name_ar = convert_from(convert_to(name_ar, 'LATIN1'), 'UTF8'),
    location = case when location is not null and location ~ '[\xC0-\xFF]' and location !~ '[\u0600-\u06FF]'
                    then convert_from(convert_to(location, 'LATIN1'), 'UTF8') else location end
where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]';

-- departments
update public.departments
set name_ar = convert_from(convert_to(name_ar, 'LATIN1'), 'UTF8')
where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]';

-- profiles
update public.profiles
set full_name_ar = convert_from(convert_to(full_name_ar, 'LATIN1'), 'UTF8')
where full_name_ar is not null and full_name_ar ~ '[\xC0-\xFF]' and full_name_ar !~ '[\u0600-\u06FF]';
'@

DbQuery $repair | Out-Null
Write-Output "  repair executed"

Write-Output ""
Write-Output "=== AFTER: verify from raw bytes ==="
$after = DbRows @'
select
  (select count(*) from public.resource_categories where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_categories,
  (select count(*) from public.resources where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_resources,
  (select count(*) from public.units_of_measure where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_units,
  (select count(*) from public.resource_custom_fields where field_name_ar ~ '[\xC0-\xFF]' and field_name_ar !~ '[\u0600-\u06FF]') as bad_fields,
  (select count(*) from public.roles where name_ar ~ '[\xC0-\xFF]' and name_ar !~ '[\u0600-\u06FF]') as bad_roles,
  (select count(*) from public.profiles where full_name_ar ~ '[\xC0-\xFF]' and full_name_ar !~ '[\u0600-\u06FF]') as bad_profiles,
  (select count(*) from public.resource_categories where name_ar ~ '[\u0600-\u06FF]') as good_categories,
  (select count(*) from public.resources where name_ar ~ '[\u0600-\u06FF]') as good_resources,
  (select count(*) from public.roles where name_ar ~ '[\u0600-\u06FF]') as good_roles
'@
$a = $after[0]
Write-Output ("  remaining bad: categories={0} resources={1} units={2} fields={3} roles={4} profiles={5}" -f `
  $a.bad_categories, $a.bad_resources, $a.bad_units, $a.bad_fields, $a.bad_roles, $a.bad_profiles)
Write-Output ("  now valid arabic: categories={0} resources={1} roles={2}" -f $a.good_categories, $a.good_resources, $a.good_roles)

Write-Output ""
Write-Output "=== Sample values (as byte sequences) ==="
$samples = DbRows "select name_ar from public.resource_categories order by sort_order limit 3"
foreach ($s in $samples) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($s.name_ar)
  $hex = ($bytes[0..5] | ForEach-Object { $_.ToString('X2') }) -join ' '
  Write-Output ("  first bytes: {0}" -f $hex)
}

Write-Output "DONE"
