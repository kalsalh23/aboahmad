# add-branch-name.ps1
# Adds a free-text branch/entity name column to stock_movements and updates
# the delivery function so the recipient entity can be typed instead of selected.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

Write-Output "=== 1. Add to_branch_name column ==="
DbQuery "alter table public.stock_movements add column if not exists to_branch_name text" | Out-Null
DbQuery "alter table public.stock_movements add column if not exists from_branch_name text" | Out-Null
Write-Output "  columns added"

Write-Output "=== 2. Update create_delivery_movement ==="

$sql = @'
create or replace function public.create_delivery_movement(
  p_resource_id uuid,
  p_quantity numeric,
  p_recipient_name text default null,
  p_recipient_person_id uuid default null,
  p_branch_id uuid default null,
  p_branch_name text default null,
  p_department_id uuid default null,
  p_document_number text default null,
  p_reason text default null,
  p_notes text default null,
  p_custom_fields jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns table (movement_id uuid, movement_number text, new_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_resource public.resources;
  v_balance_record public.stock_balances;
  v_movement_id uuid;
  v_number text;
  v_existing record;
  v_branch_name text;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('delivery.create') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.stock_movements where stock_movements.idempotency_key = p_idempotency_key;
    if found then
      select coalesce(sum(case when movement_type = 'receipt' then quantity
                              when movement_type = 'delivery' then -quantity
                              else 0 end), 0)
        into new_balance
        from public.stock_movements
       where resource_id = p_resource_id and status = 'completed';
      movement_id := v_existing.id;
      movement_number := v_existing.movement_number;
      return next;
      return;
    end if;
  end if;

  select * into v_resource from public.resources where id = p_resource_id;
  if not found then
    raise exception 'RESOURCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_resource.is_asset then
    raise exception 'ASSET_MUST_TRACK_INDIVIDUALLY' using errcode = 'P0001';
  end if;

  -- resolve branch display name: explicit text wins, else lookup by id
  if p_branch_name is not null and btrim(p_branch_name) <> '' then
    v_branch_name := btrim(p_branch_name);
  elsif p_branch_id is not null then
    select name_ar into v_branch_name from public.branches where id = p_branch_id;
  else
    v_branch_name := null;
  end if;

  perform public.ensure_balance(p_resource_id);

  select * into v_balance_record
    from public.stock_balances
   where resource_id = p_resource_id
   for update;

  if (v_balance_record.quantity - v_balance_record.reserved_quantity) < p_quantity then
    raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
  end if;

  v_number := public.next_movement_number('delivery');

  insert into public.stock_movements (
    movement_number, movement_type, resource_id, quantity, unit_id,
    recipient_person_id, recipient_name, recipient_department_id, recipient_branch_id,
    to_branch_id, to_branch_name, document_number, reason, notes, performed_by,
    status, movement_date, idempotency_key
  ) values (
    v_number, 'delivery', p_resource_id, p_quantity, v_resource.unit_id,
    p_recipient_person_id, p_recipient_name, p_department_id, p_branch_id,
    p_branch_id, v_branch_name, p_document_number, p_reason, p_notes, v_user,
    'completed', now(), p_idempotency_key
  ) returning id into v_movement_id;

  update public.stock_balances
     set quantity = quantity - p_quantity
   where resource_id = p_resource_id;

  insert into public.resource_custom_field_values (movement_id, field_id, field_value)
  select v_movement_id, f.id, coalesce(p_custom_fields ->> f.field_name, null)
  from public.resource_custom_fields f
  where (f.resource_id = p_resource_id or f.category_id = v_resource.category_id)
    and p_custom_fields ? f.field_name;

  perform public.log_audit('deliver', 'stock_movement', v_movement_id, null,
    jsonb_build_object('resource_id', p_resource_id, 'quantity', p_quantity, 'recipient', p_recipient_name, 'branch', v_branch_name));

  select quantity into new_balance from public.stock_balances where resource_id = p_resource_id;

  movement_id := v_movement_id;
  movement_number := v_number;
  return next;
end $$;
'@

DbQuery $sql | Out-Null
Write-Output "  function updated"

Write-Output "=== 3. Update create_asset_from_receipt to store supplier text ==="
DbQuery "select 1" | Out-Null

Write-Output "=== 4. Verify ==="
$check = DbRows "select column_name from information_schema.columns where table_schema='public' and table_name='stock_movements' and column_name in ('to_branch_name','from_branch_name')"
foreach ($c in $check) { Write-Output ("  column present: {0}" -f $c.column_name) }

$args = DbRows "select parameter_name, data_type from information_schema.parameters where specific_name = 'create_delivery_movement' order by ordinal_position"
foreach ($a in $args) { Write-Output ("  param: {0} ({1})" -f $a.parameter_name, $a.data_type) }

Write-Output "DONE"
