import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

/**
 * اختبارات العمليات الحرجة مقابل قاعدة بيانات Supabase الفعلية.
 * تُنشئ بيانات اختبار مؤقتة وتنظّفها بعد الانتهاء.
 *
 * المتغيرات المطلوبة في .env.local:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   TEST_USER_EMAIL       (حساب بصلاحية delivery.create على الأقل)
 *   TEST_USER_PASSWORD
 */

const env = import.meta.env as Record<string, string | undefined>
const hasEnv = !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
const hasTestCreds = !!(env.TEST_USER_EMAIL && env.TEST_USER_PASSWORD)

describe.skipIf(!hasEnv || !hasTestCreds)('العمليات الحرجة على قاعدة البيانات الفعلية', () => {
  let resourceId: string | null = null
  const adminEmail = env.TEST_USER_EMAIL ?? ''
  const adminPassword = env.TEST_USER_PASSWORD ?? ''

  beforeAll(async () => {
    const login = await api.auth.login(adminEmail, adminPassword)
    if (login.error) throw new Error('تعذر تسجيل الدخول للاختبارات: ' + login.error)

    const cats = await api.categories.list()
    const catId = cats.data?.[0]?.id
    expect(catId).toBeTruthy()

    const created = await api.resources.create({
      category_id: catId!,
      name_ar: 'مورد اختبار ' + Date.now(),
      unit_id: (await api.units.list()).data?.[0]?.id,
      is_asset: false,
      is_consumable: true,
    })
    expect(created.error).toBeNull()
    resourceId = created.data?.id ?? null
    expect(resourceId).toBeTruthy()
  })

  it('استلام مورد يزيد الرصيد بنفس الكمية', async () => {
    const before = await api.balances.quantity(resourceId!)
    const res = await api.movements.receive({
      resource_id: resourceId!,
      quantity: 10,
      document_number: 'TEST-RECV-' + Date.now(),
      notes: 'اختبار آلي',
    })
    expect(res.error).toBeNull()
    expect(res.data?.new_balance).toBe(before + 10)

    const after = await api.balances.quantity(resourceId!)
    expect(after).toBe(before + 10)
  })

  it('تسليم مورد يخصم الرصيد بنفس الكمية', async () => {
    const before = await api.balances.quantity(resourceId!)
    const res = await api.movements.deliver({
      resource_id: resourceId!,
      quantity: 4,
      recipient_name: 'مستخدم اختبار آلي',
      document_number: 'TEST-DLVR-' + Date.now(),
    })
    expect(res.error).toBeNull()
    expect(res.data?.new_balance).toBe(before - 4)

    const after = await api.balances.quantity(resourceId!)
    expect(after).toBe(before - 4)
  })

  it('يمنع صرف كمية أكبر من الرصيد المتاح', async () => {
    const available = await api.balances.quantity(resourceId!)
    const res = await api.movements.deliver({
      resource_id: resourceId!,
      quantity: available + 1000,
      recipient_name: 'مستخدم اختبار آلي',
    })
    expect(res.error).toBeTruthy()
    expect(res.error).toContain('الرصيد')
  })

  it('يمنع تكرار العملية عند الضغط المتعدد على الحفظ (مفتاح عدم التكرار)', async () => {
    const key = 'TEST-IDEM-' + Date.now()
    const first = await api.movements.receive({ resource_id: resourceId!, quantity: 3, idempotency_key: key })
    const second = await api.movements.receive({ resource_id: resourceId!, quantity: 3, idempotency_key: key })
    expect(first.data?.movement_id).toBe(second.data?.movement_id)
    expect(first.data?.new_balance).toBe(second.data?.new_balance)
  })

  it('يسجل بيانات المستلم والمنفذ والتاريخ في عملية التسليم', async () => {
    const res = await api.movements.deliver({
      resource_id: resourceId!,
      quantity: 1,
      recipient_name: 'مستلم الاختبار الميداني',
      document_number: 'TEST-DOC-META-' + Date.now(),
    })
    expect(res.error).toBeNull()

    const movement = await api.movements.get(res.data!.movement_id)
    expect(movement.data?.recipient_name).toBe('مستلم الاختبار الميداني')
    expect(movement.data?.performed_by).toBeTruthy()
    expect(movement.data?.movement_date).toBeTruthy()
    expect(movement.data?.created_at).toBeTruthy()
  })

  it('التعامل مع حركتي صرف متزامنتين دون خرق الرصيد', async () => {
    const available = await api.balances.quantity(resourceId!)
    if (available < 2) {
      await api.movements.receive({ resource_id: resourceId!, quantity: 5 })
    }
    const current = await api.balances.quantity(resourceId!)

    const results = await Promise.all([
      api.movements.deliver({ resource_id: resourceId!, quantity: current, recipient_name: 'متزامن أ' }),
      api.movements.deliver({ resource_id: resourceId!, quantity: current, recipient_name: 'متزامن ب' }),
    ])

    const succeeded = results.filter((r) => !r.error)
    expect(succeeded.length).toBe(1)

    const final = await api.balances.quantity(resourceId!)
    expect(final).toBeGreaterThanOrEqual(0)
  })

  it('التقارير متوافقة مع حركات المخزون', async () => {
    const balances = await api.balances.forResource(resourceId!)
    const movements = await api.movements.history(resourceId!)

    const calculated = (movements.data ?? []).reduce((sum, m) => {
      if (m.status !== 'completed') return sum
      if (m.movement_type === 'receipt') return sum + Number(m.quantity)
      if (m.movement_type === 'delivery') return sum - Number(m.quantity)
      return sum
    }, 0)

    expect(Number(balances.data?.[0]?.quantity ?? 0)).toBe(calculated)
  })

  it('إضافة نوع مورد جديد يُحفظ ويظهر في القوائم', async () => {
    const stamp = Date.now()
    const created = await api.categories.create({
      name_ar: 'نوع اختبار آلي ' + stamp,
      name_en: 'test cat ' + stamp,
    })
    expect(created.error).toBeNull()

    const list = await api.categories.list()
    expect(list.data?.some((c) => c.id === created.data?.id)).toBe(true)

    const res = await api.resources.create({
      category_id: created.data!.id,
      name_ar: 'مورد ضمن نوع اختباري ' + stamp,
    })
    expect(res.error).toBeNull()

    const byCat = await api.resources.listByCategory(created.data!.id)
    expect(byCat.data?.some((r) => r.id === res.data?.id)).toBe(true)
  })

  afterAll(async () => {
    if (resourceId) {
      await supabase.from('resource_custom_field_values').delete().eq('movement_id', resourceId)
      await supabase.from('stock_movements').delete().eq('resource_id', resourceId)
      await supabase.from('stock_balances').delete().eq('resource_id', resourceId)
      await supabase.from('resources').delete().eq('id', resourceId)
    }
  })
})