-- ============================================================
-- 002_rls_policies.sql
-- سياسات Row Level Security — تُطبَّق الصلاحيات على قاعدة البيانات
-- وليس بإخفاء الأزرار في الواجهة فقط.
-- ============================================================

create or replace function public.current_profile_id()
returns uuid
language sql stable
set search_path = public
as $$
  select auth.uid()
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(
    (
      select r.permissions @> array['*'] or r.permissions @> array[perm]
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid() and p.is_active = true
    ),
    false
  )
$$;

create or replace function public.has_any_permission(perms text[])
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(
    (
      select (
        r.permissions @> array['*'] or r.permissions && perms
      )
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid() and p.is_active = true
    ),
    false
  )
$$;

-- تفعيل RLS على كل الجداول
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.resource_categories enable row level security;
alter table public.resources enable row level security;
alter table public.units_of_measure enable row level security;
alter table public.resource_custom_fields enable row level security;
alter table public.resource_custom_field_values enable row level security;
alter table public.branches enable row level security;
alter table public.departments enable row level security;
alter table public.suppliers enable row level security;
alter table public.people enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.individual_assets enable row level security;
alter table public.audit_logs enable row level security;

-- -------------------- profiles --------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- -------------------- roles --------------------
drop policy if exists roles_read_all on public.roles;
create policy roles_read_all on public.roles
  for select using (true);

drop policy if exists roles_admin_all on public.roles;
create policy roles_admin_all on public.roles
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- -------------------- بيانات عامة للقراءة --------------------
drop policy if exists categories_read on public.resource_categories;
create policy categories_read on public.resource_categories
  for select using (true);

drop policy if exists resources_read on public.resources;
create policy resources_read on public.resources
  for select using (true);

drop policy if exists units_read on public.units_of_measure;
create policy units_read on public.units_of_measure
  for select using (true);

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches
  for select using (true);

drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments
  for select using (true);

drop policy if exists people_read on public.people;
create policy people_read on public.people
  for select using (true);

drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers
  for select using (true);

drop policy if exists balances_read on public.stock_balances;
create policy balances_read on public.stock_balances
  for select using (true);

drop policy if exists movements_read on public.stock_movements;
create policy movements_read on public.stock_movements
  for select using (true);

drop policy if exists assets_read on public.individual_assets;
create policy assets_read on public.individual_assets
  for select using (true);

drop policy if exists fields_read on public.resource_custom_fields;
create policy fields_read on public.resource_custom_fields
  for select using (true);

drop policy if exists field_values_read on public.resource_custom_field_values;
create policy field_values_read on public.resource_custom_field_values
  for select using (true);

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
  for select using (true);

-- -------------------- إدارة التصنيفات --------------------
drop policy if exists categories_manage on public.resource_categories;
create policy categories_manage on public.resource_categories
  for all using (
    public.has_any_permission(array['resources.manage','categories.manage','*'])
  ) with check (
    public.has_any_permission(array['resources.manage','categories.manage','*'])
  );

-- -------------------- إدارة الموارد --------------------
drop policy if exists resources_manage on public.resources;
create policy resources_manage on public.resources
  for all using (
    public.has_any_permission(array['resources.manage','*'])
  ) with check (
    public.has_any_permission(array['resources.manage','*'])
  );

-- -------------------- إدارة الوحدات والجهات والأشخاص --------------------
drop policy if exists units_manage on public.units_of_measure;
create policy units_manage on public.units_of_measure
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists branches_manage on public.branches;
create policy branches_manage on public.branches
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists departments_manage on public.departments;
create policy departments_manage on public.departments
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists people_manage on public.people;
create policy people_manage on public.people
  for all using (
    public.has_any_permission(array['settings.manage','delivery.create','resources.manage'])
  ) with check (
    public.has_any_permission(array['settings.manage','delivery.create','resources.manage'])
  );

drop policy if exists suppliers_manage on public.suppliers;
create policy suppliers_manage on public.suppliers
  for all using (
    public.has_any_permission(array['settings.manage','receipt.create','resources.manage'])
  ) with check (
    public.has_any_permission(array['settings.manage','receipt.create','resources.manage'])
  );

-- -------------------- الحقول المخصصة --------------------
drop policy if exists fields_manage on public.resource_custom_fields;
create policy fields_manage on public.resource_custom_fields
  for all using (
    public.has_any_permission(array['resources.manage','*'])
  ) with check (
    public.has_any_permission(array['resources.manage','*'])
  );

drop policy if exists field_values_manage on public.resource_custom_field_values;
create policy field_values_manage on public.resource_custom_field_values
  for all using (
    public.has_any_permission(array['receipt.create','delivery.create','resources.manage','*'])
  ) with check (
    public.has_any_permission(array['receipt.create','delivery.create','resources.manage','*'])
  );

-- -------------------- الأرصدة: قراءة للجميع، كتابة فقط عبر الدوال المحمية --------------------
drop policy if exists balances_admin_write on public.stock_balances;
create policy balances_admin_write on public.stock_balances
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- -------------------- الحركات --------------------
-- الإدراج المباشر للحركات ممنوع؛ يتم عبر الدوال create_receipt_movement / create_delivery_movement
-- والتي تتحقق من الصلاحيات وتنفّذ العملية ذرياً.
drop policy if exists movements_approver_cancel on public.stock_movements;
create policy movements_approver_cancel on public.stock_movements
  for update using (
    public.has_any_permission(array['movement.cancel','*'])
  ) with check (
    public.has_any_permission(array['movement.cancel','*'])
  );

-- -------------------- الأصول --------------------
drop policy if exists assets_manage on public.individual_assets;
create policy assets_manage on public.individual_assets
  for all using (
    public.has_any_permission(array['resources.manage','receipt.create','delivery.create','*'])
  ) with check (
    public.has_any_permission(array['resources.manage','receipt.create','delivery.create','*'])
  );

-- -------------------- سجل التدقيق: كتابة للجميع، قراءة للأدوار المصرّح لها --------------------
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs
  for insert with check (true);
