-- ============================================================
-- 004_seed_data.sql
-- بيانات تهيئة أساسية للنظام (ليست بيانات تشغيل وهمية).
-- لا تُنشئ هذه البيانات أي حركات مخزنية أو أرصدة مفتعلة.
-- ============================================================

-- فرع رئيسي افتراضي (يمكن تعديله من الإعدادات)
insert into public.branches (name_ar, name_en, location) values
  ('المستودع الرئيسي', 'main warehouse', 'غير محدد')
on conflict do nothing;

-- أقسام عامة
insert into public.departments (name_ar)
select d.name_ar
from (values ('الإدارة'), ('المشتريات'), ('الصيانة'), ('الشؤون الإدارية')) as d(name_ar)
where not exists (select 1 from public.departments where departments.name_ar = d.name_ar);

-- تصنيفات الموارد الأساسية
insert into public.resource_categories (name_ar, name_en, description, sort_order) values
  ('الملابس والتجهيزات والجعب', 'clothing and gear', 'مصائر النوع: جعبة، لباس، حذاء', 1),
  ('الأجهزة الكهربائية', 'electrical appliances', 'برادات، غسالات، مكيفات', 2),
  ('المحروقات والزيوت', 'fuels and oils', 'الديزل، البنزين، الزيوت', 3),
  ('السيارات والآليات', 'vehicles and machinery', 'سيارات وآليات وقطعها', 4),
  ('الأثاث والمعدات', 'furniture and equipment', 'طاولات، كراسي، مكاتب', 5),
  ('مواد غذائية', 'food supplies', 'مواد غذائية مختلفة', 6),
  ('قرطاسية ومكتبية', 'stationery', 'مواد مكتبية وقرطاسية', 7),
  ('قطع الغيار', 'spare parts', 'قطع غيار السيارات والمعدات', 8)
on conflict do nothing;

-- موارد أساسية لكل تصنيف
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

  -- ملابس وتجهيزات
  if c_cloth is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_cloth, 'جعبة قتالية', u_set, false, true),
      (c_cloth, 'لباس رسمي', u_set, false, true),
      (c_cloth, 'لباس ميداني', u_set, false, true),
      (c_cloth, 'حذاء جلد', u_single, false, true),
      (c_cloth, 'خوذة', u_piece, false, true),
      (c_cloth, 'ساعة يد', u_piece, false, true),
      (c_cloth, 'حزام جلد', u_piece, false, true),
      (c_cloth, 'قبعة', u_piece, false, true)
    on conflict do nothing;
  end if;

  -- أجهزة كهربائية (أصول فردية)
  if c_elec is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_elec, 'براد', u_piece, true, false),
      (c_elec, 'غسالة', u_piece, true, false),
      (c_elec, 'مكيف سبليت', u_piece, true, false),
      (c_elec, 'مكيف صحراوي', u_piece, true, false),
      (c_elec, 'ثلاجة عرض', u_piece, true, false),
      (c_elec, 'مدفأة', u_piece, true, false),
      (c_elec, 'غلاية كهربائية', u_piece, false, true)
    on conflict do nothing;
  end if;

  if c_fuel is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_fuel, 'ديزل', u_liter, false, true),
      (c_fuel, 'بنزين 80', u_liter, false, true),
      (c_fuel, 'بنزين 92', u_liter, false, true),
      (c_fuel, 'زيت محرك 20-50', u_liter, false, true),
      (c_fuel, 'ديزل (جالون)', u_gal, false, true),
      (c_fuel, 'ديزل (برميل 200 لتر)', u_barrel, false, true)
    on conflict do nothing;
  end if;

  if c_veh is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_veh, 'سيارة صالون', u_piece, true, false),
      (c_veh, 'سيارة دفع رباعي', u_piece, true, false),
      (c_veh, 'شاحنة نقل', u_piece, true, false),
      (c_veh, 'باص ركاب', u_piece, true, false),
      (c_veh, 'لودر', u_piece, true, false),
      (c_veh, 'شيول', u_piece, true, false),
      (c_veh, 'دراجة نارية', u_piece, true, false)
    on conflict do nothing;
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
      (c_furn, 'مرتبة', u_piece, false, true)
    on conflict do nothing;
  end if;

  if c_food is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_food, 'أرز', u_kg, false, true),
      (c_food, 'سكر', u_kg, false, true),
      (c_food, 'زيت طهي', u_liter, false, true),
      (c_food, 'دقيق', u_kg, false, true),
      (c_food, 'حليب مجفف', u_carton, false, true),
      (c_food, 'بقوليات مشكّلة', u_kg, false, true)
    on conflict do nothing;
  end if;

  if c_stat is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_stat, 'ورق تصوير A4', u_carton, false, true),
      (c_stat, 'قلم جاف', u_piece, false, true),
      (c_stat, 'ملف حفظ', u_piece, false, true),
      (c_stat, 'حبر طابعة', u_piece, false, true),
      (c_stat, 'دفتر ملاحظات', u_piece, false, true)
    on conflict do nothing;
  end if;

  if c_parts is not null then
    insert into public.resources (category_id, name_ar, unit_id, is_asset, is_consumable) values
      (c_parts, 'إطار سيارة', u_piece, false, true),
      (c_parts, 'بطارية', u_piece, false, true),
      (c_parts, 'فلتر زيت', u_piece, false, true),
      (c_parts, 'قرص فرامل', u_piece, false, true),
      (c_parts, 'شمعة إشعال', u_piece, false, true),
      (c_parts, 'سير مروحة', u_piece, false, true)
    on conflict do nothing;
  end if;
end $$;

-- ---------- الحقول الذكية حسب نوع المورد ----------
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
      (c_elec, 'technical_condition', 'الحالة الفنية', 'select', true, 4)
    on conflict do nothing;
  end if;

  if c_veh is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_veh, 'plate_number', 'رقم اللوحة', 'text', true, 1),
      (c_veh, 'chassis_number', 'رقم الهيكل', 'text', false, 2),
      (c_veh, 'manufacturer', 'الشركة المصنعة', 'text', false, 3),
      (c_veh, 'model', 'الطراز / الموديل', 'text', false, 4),
      (c_veh, 'vehicle_type', 'نوع السيارة', 'select', true, 5),
      (c_veh, 'technical_condition', 'حالة السيارة', 'select', false, 6)
    on conflict do nothing;
  end if;

  if c_cloth is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_cloth, 'size', 'المقاس / الصنف', 'text', true, 1),
      (c_cloth, 'color', 'اللون', 'text', false, 2)
    on conflict do nothing;
  end if;

  if c_fuel is not null then
    insert into public.resource_custom_fields (category_id, field_name, field_name_ar, field_type, is_required, sort_order) values
      (c_fuel, 'vehicle_number', 'رقم المركبة / اللوحة', 'text', false, 1),
      (c_fuel, 'odometer', 'قراءة العداد', 'number', false, 2)
    on conflict do nothing;
  end if;
end $$;

-- ---------- أرصدة صفرية للتهيئة (بدون كميات) ----------
insert into public.stock_balances (resource_id, quantity, min_quantity)
select r.id, 0, 0 from public.resources r
on conflict (resource_id) do nothing;
