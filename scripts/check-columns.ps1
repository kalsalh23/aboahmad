$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

Write-Output "=== stock_movements columns ==="
$cols = DbRows "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='stock_movements' order by ordinal_position"
foreach ($c in $cols) { Write-Output ("  {0} ({1})" -f $c.column_name, $c.data_type) }
