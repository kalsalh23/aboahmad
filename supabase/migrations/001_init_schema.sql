-- ============================================================
-- 001_init_schema.sql
-- المخطط الأساسي لقاعدة بيانات نظام إدارة المستودع الحكومي
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------- جدول الأدوار والصلاحيات ----------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  description text,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- صلاحيات النظام المعروفة (تُستخدم في الواجهة وفي RLS)
do $$
declare role_admin uuid; role_keeper uuid; role_receiver uuid; role_deliverer uuid; role_approver uuid; role_viewer uuid;
begin
  insert into public.roles (name_ar, name_en, description, permissions)
  values (
    'مدير النظام',
    'admin',
    'تحكم كامل في النظام',
    array['receipt.create','receipt.view','delivery.create','delivery.view','stock.view','resources.manage','categories.manage','users.manage','reports.view','audit.view','movement.cancel','settings.manage','*']
  ) returning id into role_admin;

  insert into public.roles (name_ar, name_en, description, permissions)
  values (
    'أمين المستودع',
    'keeper',
    'إدارة الاستلام والتسليم والموارد والأرصدة',
    array['receipt.create','receipt.view','delivery.create','delivery.view','stock.view','resources.manage','categories.manage','reports.view','audit.view']
  ) returning id into role_keeper;

  insert into public.roles (name_ar, name_en, description, permissions)
  values (
    'موظف استلام',
    'receiver',
    'تسجيل عمليات استلام الموارد فقط',
    array['receipt.create','receipt.view','stock.view']
  ) returning id into role_receiver;

  insert into public.roles (name_ar, name_en, description, permissions)
  values (
    'موظف تسليم',
    'deliverer',
    'تسجيل عمليات تسليم الموارد فقط',
    array['delivery.create','delivery.view','stock.view']
  ) returning id into role_deliverer;

  insert into public.roles (name_ar, name_en, description, permissions)
  values (
    'معتمد العمليات',
    'approver',
    'اعتماد وتصحيح الحركات',
    array['receipt.view','delivery.view','stock.view','reports.view','movement.cancel','audit.view']
  ) returning id into role_approver;

  insert into public.roles (name_ar, name_en, description, permissions)
  values (
    'قراءة وتقارير فقط',
    'viewer',
    'عرض المخزون والتقارير فقط',
    array['stock.view','reports.view']
  ) returning id into role_viewer;
end $$;

-- ---------- الفروع والأقسام ----------
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  code text,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  branch_id uuid references public.branches(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists departments_branch_idx on public.departments(branch_id);

-- ---------- الملامح (profiles) المرتبطة بـ auth.users ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  username text unique,
  full_name_ar text,
  full_name_en text,
  role_id uuid references public.roles(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role_id);
create index if not exists profiles_branch_idx on public.profiles(branch_id);
create index if not exists profiles_department_idx on public.profiles(department_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- إنشاء ملف موظف تلقائياً عند تسجيل مستخدم جديد (صامت حتى يحدد المدير دوره)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name_ar, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', null),
    coalesce(new.raw_user_meta_data->>'full_name_ar', new.raw_user_meta_data->>'full_name', null),
    true
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- وحدات القياس ----------
create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  symbol_ar text,
  symbol_en text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.units_of_measure (name_ar, name_en, symbol_ar) values
  ('حبة', 'piece', 'حبة'),
  ('قطعة', 'item', null),
  ('فرد', 'single', null),
  ('طقم', 'set', null),
  ('لتر', 'liter', 'لتر'),
  ('جالون 20 لتر', 'gallon 20l', 'جل'),
  ('برميل 200 لتر', 'barrel 200l', 'برميل'),
  ('متر', 'meter', 'م'),
  ('متر مربع', 'square meter', 'م²'),
  ('متر مكعب', 'cubic meter', 'م³'),
  ('كيلوجرام', 'kilogram', 'كج'),
  ('طن', 'ton', 'طن'),
  ('كرتون', 'carton', null),
  ('صندوق', 'box', null),
  ('رول', 'roll', null)
on conflict do nothing;

-- ---------- التصنيفات ----------
create table if not exists public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists resource_categories_set_updated_at on public.resource_categories;
create trigger resource_categories_set_updated_at
  before update on public.resource_categories
  for each row execute function public.set_updated_at();

-- ---------- الموارد ----------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.resource_categories(id) on delete restrict,
  name_ar text not null,
  name_en text not null default '',
  code text,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  is_asset boolean not null default false,
  is_consumable boolean not null default true,
  is_active boolean not null default true,
  default_custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_kind_check check (is_asset is true or is_consumable is true)
);

create index if not exists resources_category_idx on public.resources(category_id);
create unique index if not exists resources_code_uidx on public.resources(code) where code is not null;

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- ---------- الحقول الذكية ----------
create table if not exists public.resource_custom_fields (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references public.resources(id) on delete cascade,
  category_id uuid references public.resource_categories(id) on delete cascade,
  field_name text not null,
  field_name_ar text not null,
  field_type text not null default 'text' check (field_type in ('text','number','date','select','textarea','checkbox')),
  is_required boolean not null default false,
  options text[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint custom_field_scope check (resource_id is not null or category_id is not null)
);

create index if not exists custom_fields_resource_idx on public.resource_custom_fields(resource_id);
create index if not exists custom_fields_category_idx on public.resource_custom_fields(category_id);

create table if not exists public.resource_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid,
  asset_id uuid,
  field_id uuid not null references public.resource_custom_fields(id) on delete cascade,
  field_value text,
  created_at timestamptz not null default now()
);

create index if not exists field_values_movement_idx on public.resource_custom_field_values(movement_id);
create index if not exists field_values_asset_idx on public.resource_custom_field_values(asset_id);

-- ---------- الجهات الموردة والأشخاص ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  national_id text,
  phone text,
  department_id uuid references public.departments(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists people_department_idx on public.people(department_id);
create index if not exists people_branch_idx on public.people(branch_id);

-- ---------- الأرصدة ----------
create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null unique references public.resources(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  quantity numeric(18,3) not null default 0 check (quantity >= 0),
  reserved_quantity numeric(18,3) not null default 0 check (reserved_quantity >= 0),
  min_quantity numeric(18,3) not null default 0 check (min_quantity >= 0),
  updated_at timestamptz not null default now(),
  constraint stock_balance_not_negative check (
    (quantity - reserved_quantity) >= 0
  )
);

create index if not exists stock_balances_resource_idx on public.stock_balances(resource_id);

drop trigger if exists stock_balances_set_updated_at on public.stock_balances;
create trigger stock_balances_set_updated_at
  before update on public.stock_balances
  for each row execute function public.set_updated_at();

-- ---------- الحركات المخزنية ----------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_number text not null unique,
  movement_type text not null check (movement_type in ('receipt','delivery','transfer','adjustment','correction')),
  resource_id uuid not null references public.resources(id) on delete restrict,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_id uuid references public.units_of_measure(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  from_branch_id uuid references public.branches(id) on delete set null,
  to_branch_id uuid references public.branches(id) on delete set null,
  recipient_person_id uuid references public.people(id) on delete set null,
  recipient_name text,
  recipient_department_id uuid references public.departments(id) on delete set null,
  recipient_branch_id uuid references public.branches(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  document_number text,
  document_type text,
  reason text,
  notes text,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  status text not null default 'completed' check (status in ('pending','approved','completed','cancelled')),
  movement_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text unique,
  corrected_from uuid references public.stock_movements(id) on delete set null,
  cancel_reason text,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz
);

create index if not exists movements_resource_idx on public.stock_movements(resource_id);
create index if not exists movements_type_idx on public.stock_movements(movement_type);
create index if not exists movements_performed_by_idx on public.stock_movements(performed_by);
create index if not exists movements_recipient_idx on public.stock_movements(recipient_person_id);
create index if not exists movements_date_idx on public.stock_movements(movement_date);
create index if not exists movements_corrected_from_idx on public.stock_movements(corrected_from);

drop trigger if exists stock_movements_set_updated_at on public.stock_movements;
create trigger stock_movements_set_updated_at
  before update on public.stock_movements
  for each row execute function public.set_updated_at();

-- ---------- الأصول الفردية ----------
create table if not exists public.individual_assets (
  id uuid primary key default gen_random_uuid(),
  asset_number text not null unique,
  resource_id uuid not null references public.resources(id) on delete restrict,
  serial_number text,
  model text,
  manufacturer text,
  plate_number text,
  chassis_number text,
  status text not null default 'in_warehouse' check (status in ('in_warehouse','in_use','under_maintenance','retired')),
  current_branch_id uuid references public.branches(id) on delete set null,
  current_person_id uuid references public.people(id) on delete set null,
  current_delivery_id uuid,
  current_location text,
  condition_notes text,
  acquisition_date date,
  acquisition_document text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_resource_idx on public.individual_assets(resource_id);
create index if not exists assets_status_idx on public.individual_assets(status);
create index if not exists assets_serial_idx on public.individual_assets(serial_number);

drop trigger if exists individual_assets_set_updated_at on public.individual_assets;
create trigger individual_assets_set_updated_at
  before update on public.individual_assets
  for each row execute function public.set_updated_at();

-- ربط قيم الحقول بالأصول
alter table public.resource_custom_field_values
  drop constraint if exists field_values_asset_fk;
alter table public.resource_custom_field_values
  add constraint field_values_asset_fk
  foreign key (asset_id) references public.individual_assets(id) on delete cascade;

-- ---------- سجل التدقيق ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_user_idx on public.audit_logs(user_id);
create index if not exists audit_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_action_idx on public.audit_logs(action);
create index if not exists audit_created_idx on public.audit_logs(created_at);

-- ---------- تسلسل أرقام المستندات ----------
create sequence if not exists public.movement_seq start 1;

create or replace function public.next_movement_number(p_type text)
returns text
language plpgsql
as $$
declare y text := to_char(now(), 'YYYY');
declare n bigint := nextval('public.movement_seq');
declare prefix text := case p_type
  when 'receipt' then 'RECV'
  when 'delivery' then 'DLVR'
  when 'transfer' then 'TRNF'
  when 'adjustment' then 'ADJ'
  else 'CORR' end;
begin
  return prefix || '-' || y || '-' || lpad(n::text, 6, '0');
end $$;

create or replace function public.next_asset_number()
returns text
language plpgsql
as $$
declare y text := to_char(now(), 'YYYY');
declare n bigint := nextval('public.movement_seq');
begin
  return 'AST-' || y || '-' || lpad(n::text, 6, '0');
end $$;
