$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

Write-Output "=== Before: list overloads ==="
$before = DbRows @'
select p.proname as name,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_delivery_movement','create_receipt_movement')
order by p.proname, args
'@
foreach ($f in $before) { Write-Output ("  {0}({1})" -f $f.name, $f.args) }

Write-Output ""
Write-Output "=== Dropping stale overloads ==="

# delivery: original signature (no branch_name, no performer_name)
DbQuery "drop function if exists public.create_delivery_movement(uuid, numeric, text, uuid, uuid, uuid, text, text, text, jsonb, text)" | Out-Null
Write-Output "  dropped delivery v1 (no branch_name)"

# delivery: with branch_name only (no performer_name)
DbQuery "drop function if exists public.create_delivery_movement(uuid, numeric, text, uuid, uuid, text, uuid, text, text, text, jsonb, text)" | Out-Null
Write-Output "  dropped delivery v2 (branch_name only)"

# receipt: original signature (no performer_name)
DbQuery "drop function if exists public.create_receipt_movement(uuid, numeric, text, text, text, text, jsonb, text)" | Out-Null
Write-Output "  dropped receipt v1 (no performer_name)"

Write-Output ""
Write-Output "=== After: only one version each ==="
$after = DbRows @'
select p.proname as name,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_delivery_movement','create_receipt_movement')
order by p.proname, args
'@
foreach ($f in $after) { Write-Output ("  {0}({1})" -f $f.name, $f.args) }
$n = ($after | Measure-Object).Count
Write-Output ("  total functions: {0} (expected 2)" -f $n)

Write-Output "DONE"
