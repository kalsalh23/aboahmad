import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, CircleAlert, Package, Plus, Printer, UserRound } from 'lucide-react'
import { api } from '../services/api'
import type { Person, Resource, ResourceCategory, ResourceCustomField, CustomValues } from '../types'
import { Alert, Badge, Button, Card, CardHeader, Input, PageHeader, Select, Spinner } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { formatNumber, formatQuantity } from '../utils'
import { printDocument } from '../utils/print'

type Step = 0 | 1 | 2 | 3

function DeliverResources() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [fields, setFields] = useState<ResourceCustomField[]>([])
  const [people, setPeople] = useState<Person[]>([])

  const [categoryId, setCategoryId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [resource, setResource] = useState<Resource | null>(null)
  const [quantity, setQuantity] = useState('')
  const [branchName, setBranchName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPersonId, setRecipientPersonId] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [customValues, setCustomValues] = useState<CustomValues>({})
  const [available, setAvailable] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [doneResult, setDoneResult] = useState<{ movement_id: string; movement_number: string; new_balance: number } | null>(null)
  const [newResourceOpen, setNewResourceOpen] = useState(false)
  const [newPersonOpen, setNewPersonOpen] = useState(false)

  const quantityRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const [cats, ppl] = await Promise.all([
        api.categories.list(),
        api.people.list(),
      ])
      setCategories((cats.data ?? []).filter((c) => c.is_active))
      setPeople(ppl.data ?? [])
    }
    load()
  }, [])

  const loadResources = useCallback(async (catId: string) => {
    const res = await api.resources.listByCategory(catId)
    setResources(res.data ?? [])
  }, [])

  const refreshBalance = useCallback(async (resId: string) => {
    setLoadingBalance(true)
    const q = await api.balances.quantity(resId)
    setAvailable(q)
    setLoadingBalance(false)
  }, [])

  const onCategoryChange = async (value: string) => {
    setCategoryId(value)
    setResourceId('')
    setResource(null)
    setFields([])
    setCustomValues({})
    setAvailable(null)
    if (!value) return
    setResources([])
    await loadResources(value)
  }

  const onResourceChange = async (value: string) => {
    setResourceId(value)
    setCustomValues({})
    if (!value) {
      setResource(null)
      setFields([])
      setAvailable(null)
      return
    }
    const found = resources.find((r) => r.id === value) ?? null
    setResource(found)
    if (found) {
      const [fieldsRes] = await Promise.all([api.fields.listByResource(value), refreshBalance(value)])
      setFields(fieldsRes.data ?? [])
    }
    quantityRef.current?.focus()
  }

  const parsedQuantity = Number(quantity.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  const quantityValid = Number.isFinite(parsedQuantity) && parsedQuantity > 0
  const exceedsBalance = available !== null && quantityValid && parsedQuantity > available
  const remainingAfter = available !== null && quantityValid ? Math.max(0, available - parsedQuantity) : null

  const stepOneValid = !!categoryId && !!resourceId
  const stepTwoValid = quantityValid && !exceedsBalance
  const stepThreeValid = recipientName.trim().length > 0

  const steps = useMemo(
    () => [
      { label: 'النوع والاسم', done: stepOneValid },
      { label: 'الكمية والجهة', done: stepTwoValid },
      { label: 'المستلم', done: stepThreeValid },
    ],
    [stepOneValid, stepTwoValid, stepThreeValid]
  )

  const resetForm = () => {
    setStep(0)
    setCategoryId('')
    setResourceId('')
    setResource(null)
    setQuantity('')
    setBranchName('')
    setRecipientName('')
    setRecipientPersonId('')
    setDocumentNumber('')
    setNotes('')
    setCustomValues({})
    setFields([])
    setAvailable(null)
    setDoneResult(null)
    setSubmitError(null)
  }

  const confirmDelivery = async () => {
    if (submitting) return
    setSubmitError(null)
    if (!stepOneValid) return setSubmitError('اختر نوع المورد واسم المورد')
    if (!quantityValid) return setSubmitError('أدخل كمية صحيحة أكبر من صفر')
    if (exceedsBalance) return setSubmitError('لا يمكن صرف كمية أكبر من الرصيد المتاح')
    if (!recipientName.trim()) return setSubmitError('أدخل اسم الشخص المستلم')

    setSubmitting(true)
    const flat: Record<string, string> = {}
    for (const f of fields) {
      const v = customValues[f.id]
      if (v !== undefined && v !== '') flat[f.field_name] = v
    }

    const res = await api.movements.deliver({
      resource_id: resourceId,
      quantity: parsedQuantity,
      recipient_name: recipientName.trim(),
      recipient_person_id: recipientPersonId || undefined,
      branch_name: branchName.trim() || undefined,
      document_number: documentNumber || undefined,
      notes: notes || undefined,
      custom_fields: flat,
    })
    setSubmitting(false)

    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'تعذّر حفظ التسليم')
      return
    }
    setDoneResult(res.data)
    setStep(3)
  }

  const saveNewResourceInline = async (name: string, unitId: string) => {
    const res = await api.resources.create({ category_id: categoryId, name_ar: name, unit_id: unitId })
    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'تعذّر حفظ المورد الجديد')
      return
    }
    await loadResources(categoryId)
    setResourceId(res.data.id)
    setResource(res.data)
    await api.fields.listByResource(res.data.id).then((f) => setFields(f.data ?? []))
    await refreshBalance(res.data.id)
    setNewResourceOpen(false)
    setSubmitError(null)
  }

  const saveNewPersonInline = async (name: string, phone: string) => {
    const res = await api.people.create({ name_ar: name, phone })
    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'تعذّر حفظ الشخص المستلم')
      return
    }
    setPeople((p) => [...p, res.data as Person])
    setRecipientPersonId(res.data.id)
    setRecipientName(name)
    setNewPersonOpen(false)
    setSubmitError(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="تسليم الموارد"
        description="سجّل صرف الموارد للأفراد أو الفروع مع المستند وبيانات المستلم"
        actions={
          <Button variant="secondary" onClick={resetForm} disabled={submitting}>
            عملية جديدة
          </Button>
        }
      />

      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="خطوات العملية">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                i < step || s.done ? 'border-[#428177] bg-[#428177] text-white' : i === step ? 'border-[#428177] bg-white text-[#054239]' : 'border-gray-300 bg-white text-gray-400',
              ].join(' ')}
              aria-hidden
            >
              {i < step || s.done ? '✓' : i + 1}
            </span>
            <span className={i === step ? 'font-semibold text-[#054239]' : 'text-gray-500'}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-gray-300" aria-hidden />}
          </li>
        ))}
      </ol>

      {submitError && (
        <Alert tone="danger" title="خطأ">
          {submitError}
        </Alert>
      )}

      {step === 3 && doneResult ? (
        <Card className="overflow-hidden">
          <div className="border-b border-gray-200 bg-[#eaf4ef] px-5 py-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#428177] text-white" aria-hidden>
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#054239]">تم تأكيد التسليم بنجاح</h2>
                <p className="mt-0.5 text-xs text-gray-600">
                  رقم حركة التسليم:{' '}
                  <span className="font-mono font-semibold" dir="ltr">
                    {doneResult.movement_number}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm text-gray-700">
              تم تسليم <span className="font-semibold">{formatNumber(parsedQuantity)}</span> {resource?.unit?.name_ar ?? ''} من «{resource?.name_ar}» إلى{' '}
              <span className="font-semibold">{recipientName}</span>
              {branchName.trim() ? ` — ${branchName.trim()}` : ''}. الرصيد المتبقي:{' '}
              <span className="font-semibold text-[#054239]">
                {formatNumber(doneResult.new_balance)} {resource?.unit?.name_ar ?? ''}
              </span>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  printDocument('delivery', {
                    documentNumber: doneResult.movement_number,
                    resourceName: resource?.name_ar ?? '',
                    quantity: parsedQuantity,
                    unit: resource?.unit?.name_ar,
                    recipientName: recipientName.trim(),
                    branchName: branchName.trim() || undefined,
                    documentRef: documentNumber,
                    notes,
                    remainingBalance: doneResult.new_balance,
                    fields: fields.map((f) => ({ label: f.field_name_ar, value: customValues[f.id] ?? '' })),
                  })
                }
                variant="secondary"
              >
                <Printer className="h-4 w-4" aria-hidden />
                طباعة مستند التسليم
              </Button>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4" aria-hidden />
                عملية تسليم جديدة
              </Button>
              <Button variant="ghost" onClick={() => navigate('/app/stock')}>
                عرض المخزون
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={
              step === 0
                ? 'الخطوة 1: اختيار نوع المورد واسمه'
                : step === 1
                ? 'الخطوة 2: الكمية والجهة المستلمة'
                : 'الخطوة 3: المستلم'
            }
            description={
              step === 0
                ? 'اختر التصنيف ثم اسم المورد المطلوب تسليمه'
                : step === 1
                ? 'حدد الكمية والفرع أو الجهة المستلمة'
                : 'اسم الشخص المستلم (مطلوب)'
            }
          />

          <div className="space-y-5 p-4">
            {step === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="نوع المورد"
                    placeholder="اختر نوع المورد"
                    options={categories.map((c) => ({ value: c.id, label: c.name_ar }))}
                    value={categoryId}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    disabled={submitting}
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        label="اسم المورد"
                        placeholder="اختر اسم المورد"
                        options={resources.map((r) => ({ value: r.id, label: `${r.name_ar}${r.code ? ` — ${r.code}` : ''}` }))}
                        value={resourceId}
                        onChange={onResourceChange}
                        disabled={!categoryId || submitting}
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setNewResourceOpen(true)} disabled={!categoryId || submitting}>
                      <Plus className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">مورد جديد</span>
                    </Button>
                  </div>
                </div>

                {resource && (
                  <div className="rounded-lg border border-gray-200 bg-[#fbfaf6] p-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-gray-800">
                        <Package className="h-4 w-4 text-[#428177]" aria-hidden />
                        {resource.name_ar}
                      </span>
                      {resource.code && <Badge tone="neutral"><span dir="ltr">{resource.code}</span></Badge>}
                      <Badge tone="info">{resource.is_asset ? 'أصل فردي' : 'مورد استهلاكي'}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      الرصيد المتاح حالياً:{' '}
                      {loadingBalance ? (
                        <Spinner className="py-0" label="" />
                      ) : available === null ? (
                        '—'
                      ) : (
                        <span className="font-semibold text-[#054239]">{formatQuantity(available, resource.unit?.name_ar)}</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    ref={quantityRef}
                    label="الكمية المسلّمة"
                    name="quantity"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={submitting}
                    error={exceedsBalance ? `الكمية تتجاوز الرصيد المتاح (${formatNumber(available ?? 0)})` : undefined}
                    hint={resource ? `الوحدة: ${resource.unit?.name_ar ?? 'غير محددة'} — المتاح: ${formatNumber(available ?? 0)}` : undefined}
                  />
                  <Input
                    label="الفرع أو الجهة المستلمة"
                    name="branchName"
                    placeholder="اكتب اسم الفرع أو الجهة"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    disabled={submitting}
                    hint="يُدخل كتابةً — مثال: فرع الصناعة، قسم الموارد"
                  />
                </div>
                <Input
                  label="رقم مستند التسليم / العهدة"
                  name="documentNumber"
                  placeholder="مثال: عهدة رقم 88"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={submitting}
                />

                {quantityValid && !exceedsBalance && remainingAfter !== null && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#c9dcd5] bg-[#f4f7f5] px-3 py-2 text-xs text-[#054239]">
                    <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                    الرصيد المتبقي بعد هذه العملية: <span className="font-semibold">{formatNumber(remainingAfter)}</span> {resource?.unit?.name_ar ?? ''}
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        label="الشخص المستلم"
                        placeholder="ابحث عن شخص مسجل"
                        options={people.map((p) => ({ value: p.id, label: p.name_ar }))}
                        value={recipientPersonId}
                        onChange={(id) => {
                          setRecipientPersonId(id)
                          const p = people.find((x) => x.id === id)
                          if (p) setRecipientName(p.name_ar)
                        }}
                        disabled={submitting}
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setNewPersonOpen(true)} disabled={submitting}>
                      <UserRound className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">شخص جديد</span>
                    </Button>
                  </div>
                  <Input
                    label="اسم الشخص المستلم"
                    name="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={submitting}
                    error={!recipientName.trim() ? 'اسم المستلم مطلوب' : null}
                    hint="يُسجّل في حقل منفصل عن الموظف المنفذ للتسليم"
                  />
                </div>

                <Input
                  label="ملاحظات (اختياري)"
                  name="notes"
                  placeholder="حالة المورد أو أي ملاحظات"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                />
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0 || submitting}>
                <ChevronLeft className="h-4 w-4 rotate-180" aria-hidden />
                السابق
              </Button>

              {step < 3 ? (
                <Button
                  onClick={() => {
                    if (step === 0 && !stepOneValid) return setSubmitError('اختر نوع المورد واسم المورد')
                    if (step === 1 && !quantityValid) return setSubmitError('أدخل كمية صحيحة أكبر من صفر')
                    if (step === 1 && exceedsBalance) return setSubmitError('الكمية تتجاوز الرصيد المتاح')
                    setSubmitError(null)
                    setStep((s) => Math.min(3, s + 1) as Step)
                  }}
                  disabled={submitting}
                >
                  التالي
                  <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
                </Button>
              ) : (
                <Button onClick={confirmDelivery} loading={submitting} size="lg">
                  <Check className="h-4 w-4" aria-hidden />
                  تأكيد التسليم وحفظ العملية
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {newResourceOpen && (
        <NewResourceModal
          onCancel={() => setNewResourceOpen(false)}
          onSave={saveNewResourceInline}
        />
      )}
      {newPersonOpen && (
        <NewPersonModal onCancel={() => setNewPersonOpen(false)} onSave={saveNewPersonInline} saving={false} />
      )}
    </div>
  )
}

function NewResourceModal({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, unitId: string) => Promise<void> | void }) {
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [units, setUnits] = useState<{ value: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.units.list().then((res) => {
      const u = (res.data ?? []).map((x) => ({ value: x.id, label: x.name_ar }))
      setUnits(u)
      if (u[0]) setUnitId(u[0].value)
    })
  }, [])

  const submit = async () => {
    if (!name.trim()) return setError('أدخل اسم المورد')
    if (!unitId) return setError('اختر وحدة القياس')
    setError(null)
    setSaving(true)
    await onSave(name.trim(), unitId)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="إضافة مورد جديد">
      <div className="absolute inset-0" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-bold text-gray-900">إضافة مورد جديد</h2>
        <p className="mb-4 text-xs text-gray-500">سيُضاف المورد إلى النوع المحدد وسيظهر فوراً في القوائم.</p>
        <div className="space-y-3">
          <Input label="اسم المورد" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="مثال: جعبة قتالية" disabled={saving} />
          <Select label="وحدة القياس" placeholder="اختر الوحدة" options={units} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={saving} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} loading={saving}>حفظ المورد</Button>
        </div>
      </div>
    </div>
  )
}

function NewPersonModal({ onCancel, onSave, saving }: { onCancel: () => void; onSave: (name: string, phone: string) => Promise<void> | void; saving: boolean }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return setError('أدخل اسم الشخص')
    setError(null)
    await onSave(name.trim(), phone.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="إضافة شخص مستلم جديد">
      <div className="absolute inset-0" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-bold text-gray-900">إضافة شخص مستلم جديد</h2>
        <p className="mb-4 text-xs text-gray-500">سيُحفظ الشخص ويظهر في قوائم التسليم القادمة.</p>
        <div className="space-y-3">
          <Input label="الاسم الرباعي" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={saving} />
          <Input label="رقم الهاتف (اختياري)" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={saving} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} loading={saving}>حفظ الشخص</Button>
        </div>
      </div>
    </div>
  )
}

export default DeliverResources
