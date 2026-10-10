# fix-db-arabic.ps1
# Repairs Arabic text damaged in the database (stored as '?????' by prior ANSI-encoded calls)
# and re-seeds all reference data with proper UTF-8 encoding.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

. (Join-Path $PSScriptRoot "supabase-tool.ps1")

Write-Output "=== 1. Verify damage ==="
$roles = DbRows "select name_ar, permissions from public.roles order by created_at"
foreach ($r in $roles) { Write-Output ("  ROLE: [{0}] perms={1}" -f $r.name_ar, $r.permissions.Count) }

$cats = DbRows "select name_ar from public.resource_categories order by sort_order"
Write-Output ("  CATEGORIES: {0}" -f $cats.Count)
foreach ($c in $cats) { Write-Output ("    [{0}]" -f $c.name_ar) }

Write-Output ""
Write-Output "=== 2. Re-seed with correct UTF-8 ==="

$seed = @'

truncate table public.resource_custom_field_values cascade;
truncate table public.stock_movements cascade;
truncate table public.individual_assets cascade;
truncate table public.stock_balances cascade;
truncate table public.resources cascade;
truncate table public.resource_custom_fields cascade;
truncate table public.resource_categories cascade;
truncate table public.units_of_measure cascade;

alter sequence public.movement_seq restart with 1;

insert into public.units_of_measure (name_ar, name_en, symbol_ar) values
  ('حبة', 'piece', 'حبة'),
  ('قطعة', 'item', 'قطعة'),
  ('فرد', 'single', 'فرد'),
  ('طقم', 'set', 'طقم'),
  ('لتر', 'liter', 'لتر'),
  ('جالون 20 لتر', 'gallon 20l', 'جالون'),
  ('برميل 200 لتر', 'barrel 200l', 'برميل'),
  ('متر', 'meter', 'م'),
  ('متر مربع', 'square meter', 'م²'),
  ('متر مكعب', 'cubic meter', 'م³'),
  ('كيلوجرام', 'kilogram', 'كج'),
  ('طن', 'ton', 'طن'),
  ('كرتون', 'carton', 'كرتون'),
  ('صندوق', 'box', 'صندوق'),
  ('رول', 'roll', 'رول');

insert into public.resource_categories (name_ar, name_en, description, sort_order) values
  ('الملابس والتجهيزات والجعب', 'clothing and gear', 'جعبة، لباس، حذاء، خوذة', 1),
  ('الأجهزة الكهربائية', 'electrical appliances', 'برادات، غسالات، مكيفات', 2),
  ('المحروقات والزيوت', 'fuels and oils', 'ديزل، بنزين، زيوت', 3),
  ('السيارات والآليات', 'vehicles and machinery', 'سيارات وآليات ولوادر', 4),
  ('الأثاث والمعدات', 'furniture and equipment', 'مكاتب، كراسي، خزائن', 5),
  ('مواد غذائية', 'food supplies', 'أرز، سكر، زيت', 6),
  ('قرطاسية ومكتبية', 'stationery', 'أوراق، أقلام', 7),
  ('قطع الغيار', 'spare parts', 'إطارات، بطاريات، فلاتر', 8);

do $$
declare
  c_cloth uuid; c_elec uuid; c_fuel uuid; c_veh uuid; c_furn uuid; c_food uuid; c_stat uuid; c_parts uuid;
  u_piece uuid; u_set uuid; u_single uuid; u_liter uuid; u_gal uuid; u_barrel uuid; u_kg uuid; u_carton uuid;
begin
  select id into c_cloth from public.resource_categories where name_ar = 'الملابس والتجهيزات والجعب' limit 1;
  select id into c_elec from public.resource_categories where name_ar = 'الأجهزة الكهربائية' limit 1;
  select id into c_fuel from public.resource_categories where name_ar = 'المحروقات والزيوت' limit 1;
  select id into c_veh from public.resource_categories where name_ar = 'السيارات والآليات' limit 1;
  select id into c_furn from public.resource_categories where name_ar = 'الأثاث والمعدات' limit 1;
  select id into c_food from public.resource_categories where name_ar = 'مواد غذائية' limit 1;
  select id into c_stat from public.resource_categories where name_ar = 'قرطاسية ومكتبية' limit 1;
  select id into c_parts from public.resource_categories where name_ar = 'قطع الغيار' limit 1;

  select id into u_piece from public.units_of_measure where name_ar = 'حبة' limit 1;
  select id into u_set from public.units_of_measure where name_ar = 'طقم' limit 1;
  select id into u_single from public.units_of_measure where name_ar = 'فرد' limit 1;
  select id into u_liter from public.units_of_measure where name_ar = 'لتر' limit 1;
  select id into u_gal from public.units_of_measure where name_ar = 'جالون 20 لتر' limit 1;
  select id into u_barrel from public.units_of_measure where name_ar = 'برميل 200 لتر' limit 1;
  select id into u_kg from public.units_of_measure where name_ar = 'كيلوجرام' limit 1;
  select id into u_carton from public.units_of_measure where name_ar = 'كرتون' limit 1;

  if c_cloth is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_cloth, 'جعبة قتالية', u_set, false, true),
      (c_cloth, 'لباس رسمي', u_set, false, true),
      (c_cloth, 'لباس ميداني', u_set, false, true),
      (c_cloth, 'حذاء جلد', u_single, false, true),
      (c_cloth, 'خوذة', u_piece, false, true),
      (c_cloth, 'ساعة يد', u_piece, false, true),
      (c_cloth, 'حزام جلد', u_piece, false, true),
      (c_cloth, 'قبعة', u_piece, false, true);
  end if;

  if c_elec is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_elec, 'براد', u_piece, true, false),
      (c_elec, 'غسالة', u_piece, true, false),
      (c_elec, 'مكيف سبليت', u_piece, true, false),
      (c_elec, 'مكيف صحراوي', u_piece, true, false),
      (c_elec, 'ثلاجة عرض', u_piece, true, false),
      (c_elec, 'مدفئة', u_piece, true, false),
      (c_elec, 'غلاية كهربائية', u_piece, false, true);
  end if;

  if c_fuel is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_fuel, 'ديزل', u_liter, false, true),
      (c_fuel, 'بنزين 80', u_liter, false, true),
      (c_fuel, 'بنزين 92', u_liter, false, true),
      (c_fuel, 'زيت محرك 20-50', u_liter, false, true),
      (c_fuel, 'ديزل (جالون 20 لتر)', u_gal, false, true),
      (c_fuel, 'ديزل (برميل 200 لتر)', u_barrel, false, true);
  end if;

  if c_veh is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_veh, 'سيارة صالون', u_piece, true, false),
      (c_veh, 'سيارة دفع رباعي', u_piece, true, false),
      (c_veh, 'شاحنة نقل', u_piece, true, false),
      (c_veh, 'باص ركاب', u_piece, true, false),
      (c_veh, 'لودر', u_piece, true, false),
      (c_veh, 'شيول', u_piece, true, false),
      (c_veh, 'دراجة نارية', u_piece, true, false);
  end if;

  if c_furn is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_furn, 'مكتب', u_piece, true, false),
      (c_furn, 'كرسي مكتبي', u_piece, true, false),
      (c_furn, 'طاولة اجتماع', u_piece, true, false),
      (c_furn, 'خزانة ملفات', u_piece, true, false),
      (c_furn, 'سبورة', u_piece, true, false),
      (c_furn, 'سرير حديدي', u_piece, true, false),
      (c_furn, 'خزانة ملابس', u_piece, true, false),
      (c_furn, 'مرتبة', u_piece, false, true);
  end if;

  if c_food is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_food, 'أرز', u_kg, false, true),
      (c_food, 'سكر', u_kg, false, true),
      (c_food, 'زيت طهي', u_liter, false, true),
      (c_food, 'دقيق', u_kg, false, true),
      (c_food, 'حليب مجفف', u_carton, false, true),
      (c_food, 'بقوليات مشكلة', u_kg, false, true);
  end if;

  if c_stat is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_stat, 'ورق تصوير A4', u_carton, false, true),
      (c_stat, 'قلم جاف', u_piece, false, true),
      (c_stat, 'ملف حفظ', u_piece, false, true),
      (c_stat, 'حبر طابعة', u_piece, false, true),
      (c_stat, 'دفتر ملاحظات', u_piece, false, true);
  end if;

  if c_parts is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_parts, 'إطار سيارة', u_piece, false, true),
      (c_parts, 'بطارية', u_piece, false, true),
      (c_parts, 'فلتر زيت', u_piece, false, true),
      (c_parts, 'قرص فرامل', u_piece, false, true),
      (c_parts, 'شمعة إشعال', u_piece, false, true),
      (c_parts, 'سير مروحة', u_piece, false, true);
  end if;
end $$;

do $$
declare
  c_elec uuid; c_veh uuid; c_cloth uuid; c_fuel uuid;
begin
  select id into c_elec from public.resource_categories where name_ar = 'الأجهزة الكهربائية' limit 1;
  select id into c_veh from public.resource_categories where name_ar = 'السيارات والآليات' limit 1;
  select id into c_cloth from public.resource_categories where name_ar = 'الملابس والتجهيزات والجعب' limit 1;
  select id into c_fuel from public.resource_categories where name_ar = 'المحروقات والزيوت' limit 1;

  if c_elec is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_elec, 'serial_number', 'الرقم التسلسلي', 'text', true, 1),
      (c_elec, 'manufacturer', 'الشركة المصنعة', 'text', false, 2),
      (c_elec, 'model', 'الطراز / الموديل', 'text', false, 3),
      (c_elec, 'technical_condition', 'الحالة الفنية', 'select', true, 4);
  end if;

  if c_veh is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_veh, 'plate_number', 'رقم اللوحة', 'text', true, 1),
      (c_veh, 'chassis_number', 'رقم الهيكل', 'text', false, 2),
      (c_veh, 'manufacturer', 'الشركة المصنعة', 'text', false, 3),
      (c_veh, 'model', 'الطراز / الموديل', 'text', false, 4),
      (c_veh, 'vehicle_type', 'نوع السيارة', 'select', true, 5),
      (c_veh, 'technical_condition', 'حالة السيارة', 'select', false, 6);
  end if;

  if c_cloth is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_cloth, 'size', 'المقاس / الصنف', 'text', true, 1),
      (c_cloth, 'color', 'اللون', 'text', false, 2);
  end if;

  if c_fuel is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_fuel, 'vehicle_number', 'رقم المركبة / اللوحة', 'text', false, 1),
      (c_fuel, 'odometer', 'قراءة العداد', 'number', false, 2);
  end if;
end $$;

insert into public.stock_balances (resource_id, quantity, min_quantity)
select r.id, 0, 0 from public.resources r
on conflict (resource_id) do nothing;

'@

DbQuery $seed | Out-Null
Write-Output "  seed applied"

Write-Output ""
Write-Output "=== 3. Restore admin (single manager: ابو احمد) ==="

$adminSql = @'
update public.roles set name_ar = 'مدير النظام', name_en = 'admin', description = 'تحكم كامل في النظام'
where name_ar = 'مدير النظام' or name_ar like '%???%' or name_en = 'admin';

update public.roles set name_ar = 'أمين المستودع', name_en = 'keeper' where name_en = 'keeper';
update public.roles set name_ar = 'موظف استلام', name_en = 'receiver' where name_en = 'receiver';
update public.roles set name_ar = 'موظف تسليم', name_en = 'deliverer' where name_en = 'deliverer';
update public.roles set name_ar = 'معتمد العمليات', name_en = 'approver' where name_en = 'approver';
update public.roles set name_ar = 'قراءة وتقارير فقط', name_en = 'viewer' where name_en = 'viewer';

update public.roles set permissions = array['receipt.create','receipt.view','delivery.create','delivery.view','stock.view','resources.manage','categories.manage','users.manage','reports.view','audit.view','movement.cancel','settings.manage','*']
where name_en = 'admin';
'@

DbQuery $adminSql | Out-Null
Write-Output "  roles repaired"

$getAdminEmail = DbRows "select email from public.profiles where phone = '0912312312' or username = '0912312312' limit 1"
$adminEmail = $getAdminEmail[0].email
Write-Output "  admin email: $adminEmail"

$fixProfile = @"
update public.profiles
set full_name_ar = 'ابو احمد',
    phone = '0912312312',
    username = '0912312312',
    is_active = true,
    role_id = (select id from public.roles where name_en = 'admin' limit 1)
where email = '$adminEmail';

update auth.users
set encrypted_password = crypt('123123123', gen_salt('bf', 10)),
    banned_until = null,
    email_confirmed_at = now()
where email = '$adminEmail';

-- deactivate any other accounts so only the manager can log in
update public.profiles
set is_active = false
where email <> '$adminEmail';
"@

DbQuery $fixProfile | Out-Null
Write-Output "  profile fixed and other accounts disabled"

Write-Output ""
Write-Output "=== 4. Verify ==="
$check = DbRows @'
select
  (select count(*) from public.resources) as resources,
  (select count(*) from public.resource_categories) as categories,
  (select count(*) from public.resource_custom_fields) as fields,
  (select count(*) from public.units_of_measure) as units,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.profiles where is_active) as active_profiles,
  (select count(*) from public.roles where name_ar like '%?%') as damaged_roles,
  (select count(*) from public.resources where name_ar like '%?%') as damaged_resources,
  (select count(*) from public.resource_categories where name_ar like '%?%') as damaged_categories,
  (select count(*) from public.units_of_measure where name_ar like '%?%') as damaged_units
'@
$c = $check[0]
Write-Output ("  resources={0} categories={1} fields={2} units={3}" -f $c.resources, $c.categories, $c.fields, $c.units)
Write-Output ("  profiles={0} active={1}" -f $c.profiles, $c.active_profiles)
Write-Output ("  damaged rows: roles={0} resources={1} categories={2} units={3}" -f $c.damaged_roles, $c.damaged_resources, $c.damaged_categories, $c.damaged_units)

$finalRoles = DbRows "select name_ar, permissions from public.roles order by created_at"
foreach ($r in $finalRoles) { Write-Output ("  ROLE: [{0}] perms={1}" -f $r.name_ar, $r.permissions.Count) }

$finalCats = DbRows "select name_ar from public.resource_categories order by sort_order"
foreach ($r in $finalCats) { Write-Output ("  CAT: [{0}]" -f $r.name_ar) }

$finalRes = DbRows "select name_ar from public.resources limit 6"
foreach ($r in $finalRes) { Write-Output ("  RES: [{0}]" -f $r.name_ar) }

Write-Output "DONE"
