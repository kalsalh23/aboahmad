-- ============================================================
-- 003_functions.sql
-- دوال قاعدة البيانات الذرية:
--  - استلام مورد وزيادة الرصيد
--  - تسليم مورد وخصم الرصيد مع منع السالب
--  - إلغاء/تصحيح حركة موثّق
--  - إنشاء وتسليم الأصول الفردية
--  - توثيق سجل التدقيق تلقائياً
-- ============================================================

-- ---------- دوال مساعدة ----------
create or replace function public.ensure_balance(p_resource_id uuid)
returns public.stock_balances
language plpgsql
as $$
declare bal public.stock_balances;
begin
  insert into public.stock_balances (resource_id, quantity, min_quantity)
  values (p_resource_id, 0, 0)
  on conflict (resource_id) do nothing;

  select * into bal from public.stock_balances where resource_id = p_resource_id;
  return bal;
end $$;

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_values jsonb default null,
  p_new_values jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values);
end $$;

-- ---------- استلام مورد ----------
create or replace function public.create_receipt_movement(
  p_resource_id uuid,
  p_quantity numeric,
  p_document_number text default null,
  p_supplier_name text default null,
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
  v_balance numeric;
  v_movement_id uuid;
  v_number text;
  v_existing record;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('receipt.create') then
    raise exception 'FORBIDDEN: لا تملك صلاحية استلام الموارد' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY: الكمية يجب أن تكون أكبر من صفر' using errcode = '22023';
  end if;

  -- منع التكرار عند الضغط المتعدد على الحفظ
  if p_idempotency_key is not null then
    select * into v_existing
    from public.stock_movements
    where stock_movements.idempotency_key = p_idempotency_key;

    if found then
      select coalesce(sum(case when movement_type = 'receipt' then quantity
                              when movement_type = 'delivery' then -quantity
                              else 0 end), 0)
        into v_balance
        from public.stock_movements
       where resource_id = p_resource_id and status = 'completed';

      movement_id := v_existing.id;
      movement_number := v_existing.movement_number;
      new_balance := v_balance;
      return next;
      return;
    end if;
  end if;

  select * into v_resource from public.resources where id = p_resource_id;
  if not found then
    raise exception 'RESOURCE_NOT_FOUND: المورد غير موجود' using errcode = 'P0002';
  end if;

  if v_resource.is_active = false then
    raise exception 'RESOURCE_INACTIVE: هذا المورد موقوف عن الاستخدام' using errcode = 'P0001';
  end if;

  perform public.ensure_balance(p_resource_id);

  v_number := public.next_movement_number('receipt');

  insert into public.stock_movements (
    movement_number, movement_type, resource_id, quantity, unit_id,
    supplier_name, document_number, reason, notes, performed_by,
    status, movement_date, idempotency_key
  ) values (
    v_number, 'receipt', p_resource_id, p_quantity, v_resource.unit_id,
    coalesce(p_supplier_name, null), p_document_number, p_reason, p_notes, v_user,
    'completed', now(), p_idempotency_key
  ) returning id into v_movement_id;

  update public.stock_balances
     set quantity = quantity + p_quantity
   where resource_id = p_resource_id;

  insert into public.resource_custom_field_values (movement_id, field_id, field_value)
  select v_movement_id, f.id, coalesce(p_custom_fields ->> f.field_name, null)
  from public.resource_custom_fields f
  where (f.resource_id = p_resource_id or f.category_id = v_resource.category_id)
    and p_custom_fields ? f.field_name;

  perform public.log_audit('receive', 'stock_movement', v_movement_id, null,
    jsonb_build_object('resource_id', p_resource_id, 'quantity', p_quantity, 'document_number', p_document_number));

  select quantity into v_balance from public.stock_balances where resource_id = p_resource_id;

  movement_id := v_movement_id;
  movement_number := v_number;
  new_balance := v_balance;
  return next;
end $$;

-- ---------- تسليم مورد ----------
create or replace function public.create_delivery_movement(
  p_resource_id uuid,
  p_quantity numeric,
  p_recipient_name text default null,
  p_recipient_person_id uuid default null,
  p_branch_id uuid default null,
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
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('delivery.create') then
    raise exception 'FORBIDDEN: لا تملك صلاحية تسليم الموارد' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY: الكمية يجب أن تكون أكبر من صفر' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from public.stock_movements
    where stock_movements.idempotency_key = p_idempotency_key;

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
    raise exception 'RESOURCE_NOT_FOUND: المورد غير موجود' using errcode = 'P0002';
  end if;

  if v_resource.is_asset then
    raise exception 'ASSET_MUST_TRACK_INDIVIDUALLY: هذا المورد أصل فردي يجب تسجيله كأصل مستقل برقم تسلسلي' using errcode = 'P0001';
  end if;

  perform public.ensure_balance(p_resource_id);

  -- قفل الصف لمنع الصرف المتزامن الزائد
  select * into v_balance_record
    from public.stock_balances
   where resource_id = p_resource_id
   for update;

  if (v_balance_record.quantity - v_balance_record.reserved_quantity) < p_quantity then
    raise exception 'INSUFFICIENT_STOCK: الرصيد المتاح (%) غير كافٍ للصرف (%)',
      (v_balance_record.quantity - v_balance_record.reserved_quantity), p_quantity
      using errcode = '23514';
  end if;

  v_number := public.next_movement_number('delivery');

  insert into public.stock_movements (
    movement_number, movement_type, resource_id, quantity, unit_id,
    recipient_person_id, recipient_name, recipient_department_id, recipient_branch_id,
    to_branch_id, document_number, reason, notes, performed_by,
    status, movement_date, idempotency_key
  ) values (
    v_number, 'delivery', p_resource_id, p_quantity, v_resource.unit_id,
    p_recipient_person_id, p_recipient_name, p_department_id, coalesce(p_branch_id, p_branch_id),
    p_branch_id, p_document_number, p_reason, p_notes, v_user,
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
    jsonb_build_object('resource_id', p_resource_id, 'quantity', p_quantity, 'recipient', p_recipient_name, 'document_number', p_document_number));

  select quantity into new_balance from public.stock_balances where resource_id = p_resource_id;

  movement_id := v_movement_id;
  movement_number := v_number;
  return next;
end $$;

-- ---------- إلغاء / تصحيح حركة ----------
create or replace function public.cancel_movement(
  p_movement_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_movement public.stock_movements;
  v_reversal_id uuid;
  v_number text;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('movement.cancel') then
    raise exception 'FORBIDDEN: لا تملك صلاحية إلغاء أو تصحيح الحركات' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED: يجب إدخال سبب الإلغاء' using errcode = 'P0001';
  end if;

  select * into v_movement from public.stock_movements where id = p_movement_id for update;
  if not found then
    raise exception 'MOVEMENT_NOT_FOUND: الحركة غير موجودة' using errcode = 'P0002';
  end if;

  if v_movement.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED: تم إلغاء هذه الحركة مسبقاً' using errcode = 'P0001';
  end if;

  -- عكس الأثر على الرصيد
  if v_movement.movement_type = 'receipt' then
    update public.stock_balances
       set quantity = greatest(quantity - v_movement.quantity, 0)
     where resource_id = v_movement.resource_id;
  elsif v_movement.movement_type = 'delivery' then
    update public.stock_balances
       set quantity = quantity + v_movement.quantity
     where resource_id = v_movement.resource_id;
  end if;

  update public.stock_movements
     set status = 'cancelled',
         cancel_reason = p_reason,
         cancelled_by = v_user,
         cancelled_at = now()
   where id = p_movement_id;

  -- تسجيل حركة تصحيح مرتبطة بالأصل (لا نحذف السجل الأصلي)
  v_number := public.next_movement_number('correction');
  insert into public.stock_movements (
    movement_number, movement_type, resource_id, quantity,
    reason, notes, performed_by, status, movement_date, corrected_from
  ) values (
    v_number, 'correction', v_movement.resource_id, v_movement.quantity,
    p_reason, 'تصحيح/إلغاء للحركة رقم ' || v_movement.movement_number, v_user,
    'completed', now(), p_movement_id
  ) returning id into v_reversal_id;

  -- إعادة الأصول المرتبطة إلى المستودع إن كانت مرتبطة بهذه الحركة
  update public.individual_assets
     set status = 'in_warehouse',
         current_person_id = null,
         current_delivery_id = null,
         condition_notes = coalesce(condition_notes, '') || ' [أُعيدت بسبب إلغاء حركة ' || v_movement.movement_number || ']'
   where current_delivery_id = p_movement_id;

  perform public.log_audit('cancel', 'stock_movement', p_movement_id,
    jsonb_build_object('status', 'completed'),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason, 'reversal_id', v_reversal_id));
end $$;

-- ---------- إنشاء أصل فردي عند الاستلام ----------
create or replace function public.create_asset_from_receipt(
  p_resource_id uuid,
  p_custom_fields jsonb default '{}'::jsonb,
  p_document_number text default null,
  p_supplier_name text default null
)
returns table (asset_id uuid, asset_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_resource public.resources;
  v_asset_id uuid;
  v_number text;
  v_movement_id uuid;
  v_movement_number text;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('receipt.create') then
    raise exception 'FORBIDDEN: لا تملك صلاحية استلام الموارد' using errcode = '42501';
  end if;

  select * into v_resource from public.resources where id = p_resource_id;
  if not found then
    raise exception 'RESOURCE_NOT_FOUND: المورد غير موجود' using errcode = 'P0002';
  end if;

  if v_resource.is_active = false then
    raise exception 'RESOURCE_INACTIVE: هذا المورد موقوف عن الاستخدام' using errcode = 'P0001';
  end if;

  v_number := public.next_asset_number();

  insert into public.individual_assets (
    asset_number, resource_id, serial_number, model, manufacturer, plate_number,
    chassis_number, status, acquisition_date, acquisition_document
  ) values (
    v_number,
    p_resource_id,
    nullif(p_custom_fields ->> 'serial_number', ''),
    nullif(p_custom_fields ->> 'model', ''),
    nullif(p_custom_fields ->> 'manufacturer', ''),
    nullif(p_custom_fields ->> 'plate_number', ''),
    nullif(p_custom_fields ->> 'chassis_number', ''),
    'in_warehouse',
    current_date,
    p_document_number
  ) returning id into v_asset_id;

  -- حركة استلام توثيقية للأصل
  v_movement_number := public.next_movement_number('receipt');
  insert into public.stock_movements (
    movement_number, movement_type, resource_id, quantity, unit_id,
    supplier_name, document_number, performed_by, status, movement_date, notes
  ) values (
    v_movement_number, 'receipt', p_resource_id, 1, v_resource.unit_id,
    p_supplier_name, p_document_number, v_user, 'completed', now(),
    'استلام أصل فردي رقم ' || v_number
  ) returning id into v_movement_id;

  update public.individual_assets set current_location = v_movement_number where id = v_asset_id;

  insert into public.resource_custom_field_values (asset_id, field_id, field_value)
  select v_asset_id, f.id, coalesce(p_custom_fields ->> f.field_name, null)
  from public.resource_custom_fields f
  where (f.resource_id = p_resource_id or f.category_id = v_resource.category_id)
    and p_custom_fields ? f.field_name;

  perform public.log_audit('create', 'individual_asset', v_asset_id, null,
    jsonb_build_object('asset_number', v_number, 'resource_id', p_resource_id));

  asset_id := v_asset_id;
  asset_number := v_number;
  return next;
end $$;

-- ---------- تسليم أصل فردي ----------
create or replace function public.deliver_asset(
  p_asset_id uuid,
  p_recipient_name text,
  p_branch_id uuid default null,
  p_document_number text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.individual_assets;
  v_movement_id uuid;
  v_movement_number text;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('delivery.create') then
    raise exception 'FORBIDDEN: لا تملك صلاحية تسليم الموارد' using errcode = '42501';
  end if;

  if p_recipient_name is null or btrim(p_recipient_name) = '' then
    raise exception 'RECIPIENT_REQUIRED: اسم المستلم مطلوب' using errcode = 'P0001';
  end if;

  select * into v_asset from public.individual_assets where id = p_asset_id for update;
  if not found then
    raise exception 'ASSET_NOT_FOUND: الأصل غير موجود' using errcode = 'P0002';
  end if;

  if v_asset.status <> 'in_warehouse' then
    raise exception 'ASSET_NOT_IN_WAREHOUSE: هذا الأصل غير متاح في المستودع (الحالة: %)', v_asset.status using errcode = 'P0001';
  end if;

  v_movement_number := public.next_movement_number('delivery');
  insert into public.stock_movements (
    movement_number, movement_type, resource_id, quantity,
    recipient_name, to_branch_id, document_number, notes, performed_by, status, movement_date
  ) values (
    v_movement_number, 'delivery', v_asset.resource_id, 1,
    p_recipient_name, p_branch_id, p_document_number, p_notes, v_user, 'completed', now()
  ) returning id into v_movement_id;

  update public.individual_assets
     set status = 'in_use',
         current_branch_id = coalesce(p_branch_id, current_branch_id),
         current_person_id = null,
         current_delivery_id = v_movement_id,
         condition_notes = coalesce(condition_notes, '') || ' [سُلّم برقم حركة ' || v_movement_number || ']'
   where id = p_asset_id;

  perform public.log_audit('deliver', 'individual_asset', p_asset_id, null,
    jsonb_build_object('recipient', p_recipient_name, 'movement', v_movement_number, 'document', p_document_number));

  return v_movement_id;
end $$;

-- ---------- إنشاء مستخدم (للإداري) ----------
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name_ar text,
  p_role_id uuid,
  p_username text default null,
  p_phone text default null,
  p_branch_id uuid default null,
  p_department_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_admin uuid := auth.uid();
begin
  if v_admin is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_permission('users.manage') then
    raise exception 'FORBIDDEN: لا تملك صلاحية إدارة المستخدمين' using errcode = '42501';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'WEAK_PASSWORD: كلمة المرور يجب أن تكون 8 أحرف على الأقل' using errcode = 'P0001';
  end if;

  select id into v_user_id from auth.users where email = p_email;
  if not found then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name_ar', p_full_name_ar, 'phone', p_phone),
      false, false
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.profiles (id, email, phone, username, full_name_ar, role_id, branch_id, department_id, is_active)
  values (v_user_id, p_email, p_phone, p_username, p_full_name_ar, p_role_id, p_branch_id, p_department_id, true)
  on conflict (id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    username = coalesce(excluded.username, public.profiles.username),
    full_name_ar = excluded.full_name_ar,
    role_id = excluded.role_id,
    branch_id = excluded.branch_id,
    department_id = excluded.department_id,
    is_active = true,
    updated_at = now();

  perform public.log_audit('permission_change', 'profile', v_user_id, null,
    jsonb_build_object('role_id', p_role_id, 'email', p_email));

  return v_user_id;
end $$;
