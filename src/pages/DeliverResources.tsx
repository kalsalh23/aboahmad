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
  const [departmentId, setDepartmentId] = useState('')
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

  const parsedQuantity = Number(quantity.replace(/[Ù -Ù©]/g, (d) => String('Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©'.indexOf(d))))
  const quantityValid = Number.isFinite(parsedQuantity) && parsedQuantity > 0
  const exceedsBalance = available !== null && quantityValid && parsedQuantity > available
  const remainingAfter = available !== null && quantityValid ? Math.max(0, available - parsedQuantity) : null
  const requiredMissing = fields.filter((f) => f.is_required && !(customValues[f.id] ?? '').trim()).length > 0

  const stepOneValid = !!categoryId && !!resourceId
  const stepTwoValid = quantityValid && !exceedsBalance
  const stepThreeValid = recipientName.trim().length > 0 && !requiredMissing

  const steps = useMemo(
    () => [
      { label: 'Ø§Ù„Ù†ÙˆØ¹ Ùˆ Ø§Ù„Ø§Ø³Ù…', done: stepOneValid },
      { label: 'Ø§Ù„ÙƒÙ…ÙŠØ© Ùˆ Ø§Ù„Ø¬Ù‡Ø©', done: stepTwoValid },
      { label: 'Ø§Ù„Ù…Ø³ØªÙ„Ù…', done: stepThreeValid },
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
    setDepartmentId('')
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
    if (!stepOneValid) return setSubmitError('Ø§Ø®ØªØ± Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆØ§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯')
    if (!quantityValid) return setSubmitError('Ø£Ø¯Ø®Ù„ ÙƒÙ…ÙŠØ© ØµØ­ÙŠØ­Ø© Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±')
    if (exceedsBalance) return setSubmitError('Ù„Ø§ ÙŠÙ…ÙƒÙ† ØµØ±Ù ÙƒÙ…ÙŠØ© Ø£ÙƒØ¨Ø± Ù…Ù† Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ§Ø­')
    if (!recipientName.trim()) return setSubmitError('Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ø´Ø®Øµ Ø§Ù„Ù…Ø³ØªÙ„Ù…')

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
      department_id: departmentId || undefined,
      document_number: documentNumber || undefined,
      notes: notes || undefined,
      custom_fields: flat,
    })
    setSubmitting(false)

    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸ Ø§Ù„ØªØ³Ù„ÙŠÙ…')
      return
    }
    setDoneResult(res.data)
    setStep(3)
  }

  const saveNewResourceInline = async (name: string, unitId: string) => {
    const res = await api.resources.create({ category_id: categoryId, name_ar: name, unit_id: unitId })
    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸ Ø§Ù„Ù…ÙˆØ±Ø¯ Ø§Ù„Ø¬Ø¯ÙŠØ¯')
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
    const res = await api.people.create({ name_ar: name, phone, department_id: departmentId || undefined })
    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸ Ø§Ù„Ø´Ø®Øµ Ø§Ù„Ù…Ø³ØªÙ„Ù…')
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
        title="ØªØ³Ù„ÙŠÙ… Ø§Ù„Ù…ÙˆØ§Ø±Ø¯"
        description="Ø³Ø¬Ù‘Ù„ ØµØ±Ù Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ù„Ù„Ø£ÙØ±Ø§Ø¯ Ø£Ùˆ Ø§Ù„ÙØ±ÙˆØ¹ Ù…Ø¹ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ ÙˆØ¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³ØªÙ„Ù…"
        actions={
          <Button variant="secondary" onClick={resetForm} disabled={submitting}>
            Ø¹Ù…Ù„ÙŠØ© Ø¬Ø¯ÙŠØ¯Ø©
          </Button>
        }
      />

      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Ø®Ø·ÙˆØ§Øª Ø§Ù„Ø¹Ù…Ù„ÙŠØ©">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                i < step || s.done ? 'border-[#428177] bg-[#428177] text-white' : i === step ? 'border-[#428177] bg-white text-[#054239]' : 'border-gray-300 bg-white text-gray-400',
              ].join(' ')}
              aria-hidden
            >
              {i < step || s.done ? 'âœ“' : i + 1}
            </span>
            <span className={i === step ? 'font-semibold text-[#054239]' : 'text-gray-500'}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-gray-300" aria-hidden />}
          </li>
        ))}
      </ol>

      {submitError && (
        <Alert tone="danger" title="Ø®Ø·Ø£">
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
                <h2 className="text-base font-bold text-[#054239]">ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø¨Ù†Ø¬Ø§Ø­</h2>
                <p className="mt-0.5 text-xs text-gray-600">
                  Ø±Ù‚Ù… Ø­Ø±ÙƒØ© Ø§Ù„ØªØ³Ù„ÙŠÙ…:{' '}
                  <span className="font-mono font-semibold" dir="ltr">
                    {doneResult.movement_number}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm text-gray-700">
              ØªÙ… ØªØ³Ù„ÙŠÙ… <span className="font-semibold">{formatNumber(parsedQuantity)}</span> {resource?.unit?.name_ar ?? ''} Ù…Ù† Â«{resource?.name_ar}Â» Ø¥Ù„Ù‰{' '}
              <span className="font-semibold">{recipientName}</span>
              {branchName.trim() ? ` — فرع ${branchName.trim()}` : ''}. الرصيد المتبقي:{' '}
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
                    recipientName,
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
                Ø·Ø¨Ø§Ø¹Ø© Ù…Ø³ØªÙ†Ø¯ Ø§Ù„ØªØ³Ù„ÙŠÙ…
              </Button>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4" aria-hidden />
                Ø¹Ù…Ù„ÙŠØ© ØªØ³Ù„ÙŠÙ… Ø¬Ø¯ÙŠØ¯Ø©
              </Button>
              <Button variant="ghost" onClick={() => navigate('/app/stock')}>
                Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={
              step === 0
                ? 'Ø§Ù„Ø®Ø·ÙˆØ© 1: Ø§Ø®ØªÙŠØ§Ø± Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆØ§Ø³Ù…Ù‡'
                : step === 1
                ? 'Ø§Ù„Ø®Ø·ÙˆØ© 2: Ø§Ù„ÙƒÙ…ÙŠØ© ÙˆØ§Ù„Ø¬Ù‡Ø© Ø§Ù„Ù…Ø³ØªÙ„Ù…Ø©'
                : 'Ø§Ù„Ø®Ø·ÙˆØ© 3: Ø§Ù„Ù…Ø³ØªÙ„Ù…'
            }
            description={
              step === 0
                ? 'Ø§Ø®ØªØ± Ø§Ù„ØªØµÙ†ÙŠÙ Ø«Ù… Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ ØªØ³Ù„ÙŠÙ…Ù‡'
                : step === 1
                ? 'Ø­Ø¯Ø¯ Ø§Ù„ÙƒÙ…ÙŠØ© ÙˆØ§Ù„ÙØ±Ø¹ Ø£Ùˆ Ø§Ù„Ø¬Ù‡Ø© Ø§Ù„Ù…Ø³ØªÙ„Ù…Ø©'
                : 'Ø§Ø³Ù… Ø§Ù„Ø´Ø®Øµ Ø§Ù„Ù…Ø³ØªÙ„Ù… (Ù…Ø·Ù„ÙˆØ¨)'
            }
          />

          <div className="space-y-5 p-4">
            {step === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯"
                    placeholder="Ø§Ø®ØªØ± Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯"
                    options={categories.map((c) => ({ value: c.id, label: c.name_ar }))}
                    value={categoryId}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    disabled={submitting}
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        label="Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯"
                        placeholder="Ø§Ø®ØªØ± Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯"
                        options={resources.map((r) => ({ value: r.id, label: `${r.name_ar}${r.code ? ` â€” ${r.code}` : ''}` }))}
                        value={resourceId}
                        onChange={onResourceChange}
                        disabled={!categoryId || submitting}
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setNewResourceOpen(true)} disabled={!categoryId || submitting}>
                      <Plus className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ±Ø¯ Ø¬Ø¯ÙŠØ¯</span>
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
                      <Badge tone="info">{resource.is_asset ? 'Ø£ØµÙ„ ÙØ±Ø¯ÙŠ' : 'Ù…ÙˆØ±Ø¯ Ø§Ø³ØªÙ‡Ù„Ø§ÙƒÙŠ'}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ§Ø­ Ø­Ø§Ù„ÙŠØ§Ù‹:{' '}
                      {loadingBalance ? (
                        <Spinner className="py-0" label="" />
                      ) : available === null ? (
                        'â€”'
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
                    label="Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ù…Ø³Ù„Ù‘Ù…Ø©"
                    name="quantity"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={submitting}
                    error={exceedsBalance ? `Ø§Ù„ÙƒÙ…ÙŠØ© ØªØªØ¬Ø§ÙˆØ² Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ§Ø­ (${formatNumber(available ?? 0)})` : undefined}
                    hint={resource ? `Ø§Ù„ÙˆØ­Ø¯Ø©: ${resource.unit?.name_ar ?? 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯Ø©'} â€” Ø§Ù„Ù…ØªØ§Ø­: ${formatNumber(available ?? 0)}` : undefined}
                  />
                  <Input
                    label="Ø§Ù„ÙØ±Ø¹ Ø£Ùˆ Ø§Ù„Ø¬Ù‡Ø© Ø§Ù„Ù…Ø³ØªÙ„Ù…Ø©"
                    name="branchName"
                    placeholder="Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„ÙØ±Ø¹ Ø£Ùˆ Ø§Ù„Ø¬Ù‡Ø©"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    disabled={submitting}
                    hint="ÙŠÙØ¯Ø®Ù„ ÙƒØªØ§Ø¨Ø©Ù‹ â€” Ù…Ø«Ø§Ù„: ÙØ±Ø¹ Ø­Ù…Ø§Ù‡ØŒ Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø±Ø¯"
                  />                </div>
                <Input
                  label="Ø±Ù‚Ù… Ù…Ø³ØªÙ†Ø¯ Ø§Ù„ØªØ³Ù„ÙŠÙ… / Ø§Ù„Ø¹Ù‡Ø¯Ø©"
                  name="documentNumber"
                  placeholder="Ù…Ø«Ø§Ù„: Ø¹Ù‡Ø¯Ø© Ø±Ù‚Ù… 88"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={submitting}
                />

                {quantityValid && !exceedsBalance && remainingAfter !== null && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#c9dcd5] bg-[#f4f7f5] px-3 py-2 text-xs text-[#054239]">
                    <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                    Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø¨Ø¹Ø¯ Ù‡Ø°Ù‡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©: <span className="font-semibold">{formatNumber(remainingAfter)}</span> {resource?.unit?.name_ar ?? ''}
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
                        label="Ø§Ù„Ø´Ø®Øµ Ø§Ù„Ù…Ø³ØªÙ„Ù…"
                        placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø´Ø®Øµ Ù…Ø³Ø¬Ù„"
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
                      <span className="hidden sm:inline">Ø´Ø®Øµ Ø¬Ø¯ÙŠØ¯</span>
                    </Button>
                  </div>
                  <Input
                    label="Ø§Ø³Ù… Ø§Ù„Ø´Ø®Øµ Ø§Ù„Ù…Ø³ØªÙ„Ù…"
                    name="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={submitting}
                    error={!recipientName.trim() ? 'Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªÙ„Ù… Ù…Ø·Ù„ÙˆØ¨' : null}
                    hint="ÙŠÙØ³Ø¬Ù‘Ù„ ÙÙŠ Ø­Ù‚Ù„ Ù…Ù†ÙØµÙ„ Ø¹Ù† Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù…Ù†ÙØ° Ù„Ù„ØªØ³Ù„ÙŠÙ…"
                  />
                </div>

                <Input
                  label="Ù…Ù„Ø§Ø­Ø¸Ø§Øª (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)"
                  name="notes"
                  placeholder="Ø­Ø§Ù„Ø© Ø§Ù„Ù…ÙˆØ±Ø¯ Ø£Ùˆ Ø£ÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§Øª"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                />
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0 || submitting}>
                <ChevronLeft className="h-4 w-4 rotate-180" aria-hidden />
                Ø§Ù„Ø³Ø§Ø¨Ù‚
              </Button>

              {step < 3 ? (
                <Button
                  onClick={() => {
                    if (step === 0 && !stepOneValid) return setSubmitError('Ø§Ø®ØªØ± Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆØ§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯')
                    if (step === 1 && !quantityValid) return setSubmitError('Ø£Ø¯Ø®Ù„ ÙƒÙ…ÙŠØ© ØµØ­ÙŠØ­Ø© Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±')
                    if (step === 1 && exceedsBalance) return setSubmitError('Ø§Ù„ÙƒÙ…ÙŠØ© ØªØªØ¬Ø§ÙˆØ² Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ§Ø­')
                    setSubmitError(null)
                    setStep((s) => Math.min(3, s + 1) as Step)
                  }}
                  disabled={submitting}
                >
                  Ø§Ù„ØªØ§Ù„ÙŠ
                  <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
                </Button>
              ) : (
                <Button onClick={confirmDelivery} loading={submitting} size="lg">
                  <Check className="h-4 w-4" aria-hidden />
                  ØªØ£ÙƒÙŠØ¯ Ø§Ù„ØªØ³Ù„ÙŠÙ… ÙˆØ­ÙØ¸ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©
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
    if (!name.trim()) return setError('Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯')
    if (!unitId) return setError('Ø§Ø®ØªØ± ÙˆØ­Ø¯Ø© Ø§Ù„Ù‚ÙŠØ§Ø³')
    setError(null)
    setSaving(true)
    await onSave(name.trim(), unitId)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ±Ø¯ Ø¬Ø¯ÙŠØ¯">
      <div className="absolute inset-0" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-bold text-gray-900">Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ±Ø¯ Ø¬Ø¯ÙŠØ¯</h2>
        <p className="mb-4 text-xs text-gray-500">Ø³ÙŠÙØ¶Ø§Ù Ø§Ù„Ù…ÙˆØ±Ø¯ Ø¥Ù„Ù‰ Ø§Ù„Ù†ÙˆØ¹ Ø§Ù„Ù…Ø­Ø¯Ø¯ ÙˆØ³ÙŠØ¸Ù‡Ø± ÙÙˆØ±Ø§Ù‹ ÙÙŠ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù….</p>
        <div className="space-y-3">
          <Input label="Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="Ù…Ø«Ø§Ù„: Ø¬Ø¹Ø¨Ø© Ù‚ØªØ§Ù„ÙŠØ©" disabled={saving} />
          <Select label="ÙˆØ­Ø¯Ø© Ø§Ù„Ù‚ÙŠØ§Ø³" placeholder="Ø§Ø®ØªØ± Ø§Ù„ÙˆØ­Ø¯Ø©" options={units} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={saving} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Ø¥Ù„ØºØ§Ø¡</Button>
          <Button onClick={submit} loading={saving}>Ø­ÙØ¸ Ø§Ù„Ù…ÙˆØ±Ø¯</Button>
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
    if (!name.trim()) return setError('Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ø´Ø®Øµ')
    setError(null)
    await onSave(name.trim(), phone.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Ø¥Ø¶Ø§ÙØ© Ø´Ø®Øµ Ù…Ø³ØªÙ„Ù… Ø¬Ø¯ÙŠØ¯">
      <div className="absolute inset-0" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-bold text-gray-900">Ø¥Ø¶Ø§ÙØ© Ø´Ø®Øµ Ù…Ø³ØªÙ„Ù… Ø¬Ø¯ÙŠØ¯</h2>
        <p className="mb-4 text-xs text-gray-500">Ø³ÙŠØªÙ… Ø­ÙØ¸ Ø§Ù„Ø´Ø®Øµ ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ³ÙŠØ¨Ù‚Ù‰ Ù…ØªØ§Ø­Ø§Ù‹ ÙÙŠ ÙƒÙ„ Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©.</p>
        <div className="space-y-3">
          <Input label="Ø§Ù„Ø§Ø³Ù… Ø§Ù„Ø±Ø¨Ø§Ø¹ÙŠ" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={saving} />
          <Input label="Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={saving} />
        </div>
        <p className="mt-3 text-xs text-gray-500">Ø³ÙŠØªÙ… Ø­ÙØ¸ Ø§Ù„Ø´Ø®Øµ ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ³ÙŠØ¨Ù‚Ù‰ Ù…ØªØ§Ø­Ø§Ù‹ ÙÙŠ ÙƒÙ„ Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Ø¥Ù„ØºØ§Ø¡</Button>
          <Button onClick={submit} loading={saving}>Ø­ÙØ¸ Ø§Ù„Ø´Ø®Øµ</Button>
        </div>
      </div>
    </div>
  )
}

export default DeliverResources
