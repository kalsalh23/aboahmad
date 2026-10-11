import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, FileText, Package, Plus, Printer } from 'lucide-react'
import { api } from '../services/api'
import type { Resource, ResourceCategory, ResourceCustomField, UnitOfMeasure } from '../types'
import { Alert, Badge, Button, Card, CardHeader, Input, PageHeader, Select } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { formatNumber } from '../utils'
import { printDocument } from '../utils/print'

type Step = 0 | 1 | 2 | 3

interface CustomFieldValues {
  [field_id: string]: string
}

function ReceiveResources() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [units, setUnits] = useState<UnitOfMeasure[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [fields, setFields] = useState<ResourceCustomField[]>([])

  const [categoryId, setCategoryId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [resource, setResource] = useState<Resource | null>(null)
  const [quantity, setQuantity] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [customValues, setCustomValues] = useState<CustomFieldValues>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [doneResult, setDoneResult] = useState<{ movement_id: string; movement_number: string; new_balance: number } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const quantityRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const [cats, uns] = await Promise.all([
        api.categories.list(),
        api.units.list(),
      ])
      setCategories((cats.data ?? []).filter((c) => c.is_active))
      setUnits(uns.data ?? [])
    }
    load()
  }, [])

  const loadResources = useCallback(async (catId: string) => {
    const res = await api.resources.listByCategory(catId)
    setResources(res.data ?? [])
  }, [])

  const loadFields = useCallback(async (resId: string) => {
    const res = await api.fields.listByResource(resId)
    setFields(res.data ?? [])
  }, [])

  const onCategoryChange = (value: string) => {
    setCategoryId(value)
    setResourceId('')
    setResource(null)
    setCustomValues({})
    if (value) loadResources(value)
  }

  const onResourceChange = async (value: string) => {
    setResourceId(value)
    setCustomValues({})
    if (!value) {
      setResource(null)
      setFields([])
      return
    }
    const found = resources.find((r) => r.id === value) ?? null
    setResource(found)
    if (found) await loadFields(value)
    quantityRef.current?.focus()
  }

  const selectedUnit = resource?.unit ?? units.find((u) => u.id === resource?.unit_id)
  const parsedQuantity = Number(quantity.replace(/[Ù -Ù©]/g, (d) => String('Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©'.indexOf(d))))
  const quantityValid = Number.isFinite(parsedQuantity) && parsedQuantity > 0

  const stepOneValid = !!categoryId && !!resourceId
  const stepTwoValid = quantityValid

  const steps = [
    { label: 'Ø§Ù„Ù†ÙˆØ¹ Ùˆ Ø§Ù„Ø§Ø³Ù…', done: stepOneValid },
    { label: 'Ø§Ù„ÙƒÙ…ÙŠØ©', done: stepTwoValid },
    { label: 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…', done: true },
  ]

  const resetForm = () => {
    setStep(0)
    setCategoryId('')
    setResourceId('')
    setResource(null)
    setQuantity('')
    setSupplierName('')
    setDocumentNumber('')
    setNotes('')
    setCustomValues({})
    setFields([])
    setDoneResult(null)
    setSubmitError(null)
  }

  const confirmReceipt = async () => {
    if (submitting) return
    setSubmitError(null)
    if (!stepOneValid) return setSubmitError('Ø§Ø®ØªØ± Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆØ§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯ Ø£ÙˆÙ„Ø§Ù‹')
    if (!stepTwoValid) return setSubmitError('Ø£Ø¯Ø®Ù„ ÙƒÙ…ÙŠØ© ØµØ­ÙŠØ­Ø© Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±')

    setSubmitting(true)
    const flatFields: Record<string, string> = {}
    for (const f of fields) {
      const v = customValues[f.id]
      if (v !== undefined && v !== '') flatFields[f.field_name] = v
    }

    const res = await api.movements.receive({
      resource_id: resourceId,
      quantity: parsedQuantity,
      document_number: documentNumber || undefined,
      supplier_name: supplierName || undefined,
      notes: notes || undefined,
      custom_fields: flatFields,
    })
    setSubmitting(false)

    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…')
      return
    }
    setDoneResult(res.data)
    setStep(3)
  }

  const saveNewResourceInline = async (name: string, unitId: string) => {
    setSaving(true)
    const res = await api.resources.create({ category_id: categoryId, name_ar: name, unit_id: unitId })
    setSaving(false)
    if (res.error || !res.data) {
      setSubmitError(res.error ?? 'ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸ Ø§Ù„Ù…ÙˆØ±Ø¯ Ø§Ù„Ø¬Ø¯ÙŠØ¯')
      return
    }
    await loadResources(categoryId)
    setResourceId(res.data.id)
    setResource(res.data)
    setModalOpen(false)
    setSubmitError(null)
    quantityRef.current?.focus()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ù…ÙˆØ§Ø±Ø¯"
        description="Ø³Ø¬Ù‘Ù„ Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„ÙˆØ§Ø±Ø¯Ø© Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹ Ù…Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ØµØ¯Ø± ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯"
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
                i < step || s.done
                  ? 'border-[#428177] bg-[#428177] text-white'
                  : i === step
                  ? 'border-[#428177] bg-white text-[#054239]'
                  : 'border-gray-300 bg-white text-gray-400',
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
        <SuccessPanel
          movementNumber={doneResult.movement_number}
          newBalance={doneResult.new_balance}
          unit={selectedUnit?.name_ar}
          resourceName={resource?.name_ar}
          quantity={parsedQuantity}
          onPrint={() => printDocument('receipt', {
            documentNumber: doneResult.movement_number,
            resourceName: resource?.name_ar ?? '',
            quantity: parsedQuantity,
            unit: selectedUnit?.name_ar ?? '',
            supplierName,
            documentRef: documentNumber,
            notes,
            fields: fields.map((f) => ({ label: f.field_name_ar, value: customValues[f.id] ?? '' })),
          })}
          onNew={resetForm}
          onGoStock={() => navigate('/app/stock')}
        />
      ) : (
        <Card>
          <CardHeader
            title={
              step === 0
                ? 'Ø§Ù„Ø®Ø·ÙˆØ© 1: Ø§Ø®ØªÙŠØ§Ø± Ù†ÙˆØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆØ§Ø³Ù…Ù‡'
                : step === 1
                ? 'Ø§Ù„Ø®Ø·ÙˆØ© 2: Ø§Ù„ÙƒÙ…ÙŠØ©'
                : 'Ø§Ù„Ø®Ø·ÙˆØ© 3: Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…'
            }
            description={
              step === 0
                ? 'Ø§Ø®ØªØ± Ø§Ù„ØªØµÙ†ÙŠÙ Ø«Ù… Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯ Ù…Ù† Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©'
                : step === 1
                ? 'Ø­Ø¯Ø¯ Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙˆØ§Ø±Ø¯Ø©'
                : 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¬Ù‡Ø© Ø§Ù„Ù…ÙˆØ±Ø¯Ø© ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)'
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
                    <Button type="button" variant="secondary" onClick={() => setModalOpen(true)} disabled={!categoryId || submitting} title="Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ±Ø¯ Ø¬Ø¯ÙŠØ¯ Ø¶Ù…Ù† Ù‡Ø°Ø§ Ø§Ù„Ù†ÙˆØ¹">
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
                      {resource.code && (
                        <Badge tone="neutral">
                          <span dir="ltr">{resource.code}</span>
                        </Badge>
                      )}
                      <Badge tone="info">{resource.is_asset ? 'Ø£ØµÙ„ ÙØ±Ø¯ÙŠ' : 'Ù…ÙˆØ±Ø¯ Ø§Ø³ØªÙ‡Ù„Ø§ÙƒÙŠ'}</Badge>
                      <span className="text-xs text-gray-500">ÙˆØ­Ø¯Ø© Ø§Ù„Ù‚ÙŠØ§Ø³: {resource.unit?.name_ar ?? 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯Ø©'}</span>
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
                    label="Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙˆØ§Ø±Ø¯Ø©"
                    name="quantity"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={submitting}
                    error={quantity && !quantityValid ? 'Ø£Ø¯Ø®Ù„ ÙƒÙ…ÙŠØ© Ø±Ù‚Ù…ÙŠØ© Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±' : null}
                    hint={selectedUnit ? `Ø§Ù„ÙˆØ­Ø¯Ø©: ${selectedUnit.name_ar}` : undefined}
                  />
                  <Input
                    label="ÙˆØ­Ø¯Ø© Ø§Ù„Ù‚ÙŠØ§Ø³"
                    value={selectedUnit ? selectedUnit.name_ar : ''}
                    readOnly
                    disabled
                    placeholder="ØªÙØ­Ø¯Ø¯ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø­Ø³Ø¨ Ø§Ù„Ù…ÙˆØ±Ø¯"
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Ø§Ù„Ø¬Ù‡Ø© Ø§Ù„Ù…ÙˆØ±Ø¯Ø© / Ø§Ù„Ù…ØµØ¯Ø±"
                    name="supplierName"
                    placeholder="Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„Ø¬Ù‡Ø© Ø§Ù„Ù…ÙˆØ±Ø¯Ø©"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    disabled={submitting}
                    hint="ÙŠÙØ¯Ø®Ù„ ÙƒØªØ§Ø¨Ø©Ù‹ â€” ÙŠÙ…ÙƒÙ† ØªØ±ÙƒÙ‡ ÙØ§Ø±ØºØ§Ù‹ Ø¥Ø°Ø§ Ù„Ù… ÙŠÙƒÙ† Ø§Ù„Ù…ØµØ¯Ø± Ù…Ø¹Ø±ÙˆÙØ§Ù‹"
                  />
                  <Input
                    label="Ø±Ù‚Ù… Ø§Ù„Ù…Ø³ØªÙ†Ø¯ / Ù…Ø­Ø¶Ø± Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…"
                    name="documentNumber"
                    placeholder="Ù…Ø«Ø§Ù„: Ù…Ø­Ø¶Ø± 1456"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <Input
                  label="Ù…Ù„Ø§Ø­Ø¸Ø§Øª (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)"
                  name="notes"
                  placeholder="Ø£ÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù…Ù„ÙŠØ© Ø£Ùˆ Ø­Ø§Ù„Ø© Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ù…Ø³ØªÙ„Ù…Ø©"
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
                    if (step === 1 && !stepTwoValid) return setSubmitError('Ø£Ø¯Ø®Ù„ ÙƒÙ…ÙŠØ© ØµØ­ÙŠØ­Ø© Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±')
                    setSubmitError(null)
                    setStep((s) => Math.min(3, s + 1) as Step)
                  }}
                  disabled={submitting}
                >
                  Ø§Ù„ØªØ§Ù„ÙŠ
                  <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
                </Button>
              ) : (
                <Button onClick={confirmReceipt} loading={submitting} size="lg">
                  <Check className="h-4 w-4" aria-hidden />
                  ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… ÙˆØ­ÙØ¸ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {modalOpen && (
        <NewResourceModal
          units={units}
          saving={saving}
          onCancel={() => setModalOpen(false)}
          onSave={saveNewResourceInline}
        />
      )}
    </div>
  )
}

function SuccessPanel({
  movementNumber,
  newBalance,
  unit,
  resourceName,
  quantity,
  onPrint,
  onNew,
  onGoStock,
}: {
  movementNumber: string
  newBalance: number
  unit?: string
  resourceName?: string
  quantity: number
  onPrint: () => void
  onNew: () => void
  onGoStock: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 bg-[#eaf4ef] px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#428177] text-white" aria-hidden>
            <Check className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#054239]">ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­</h2>
            <p className="mt-0.5 text-xs text-gray-600">
              Ø±Ù‚Ù… Ø­Ø±ÙƒØ© Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…:{' '}
              <span className="font-mono font-semibold" dir="ltr">
                {movementNumber}
              </span>
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm text-gray-700">
          ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© <span className="font-semibold">{formatNumber(quantity)}</span> {unit ?? ''} Ù…Ù† Â«{resourceName}Â» Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†. Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø­Ø§Ù„ÙŠ Ø¨Ø¹Ø¯ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©:{' '}
          <span className="font-semibold text-[#054239]">
            {formatNumber(newBalance)} {unit ?? ''}
          </span>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onPrint} variant="secondary">
            <Printer className="h-4 w-4" aria-hidden />
            Ø·Ø¨Ø§Ø¹Ø© Ù…Ø³ØªÙ†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…
          </Button>
          <Button onClick={onNew}>
            <Plus className="h-4 w-4" aria-hidden />
            Ø¹Ù…Ù„ÙŠØ© Ø§Ø³ØªÙ„Ø§Ù… Ø¬Ø¯ÙŠØ¯Ø©
          </Button>
          <Button onClick={onGoStock} variant="ghost">
            <FileText className="h-4 w-4" aria-hidden />
            Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
          </Button>
        </div>
      </div>
    </Card>
  )
}

function NewResourceModal({
  units,
  saving,
  onCancel,
  onSave,
}: {
  units: UnitOfMeasure[]
  saving: boolean
  onCancel: () => void
  onSave: (name: string, unitId: string) => Promise<void> | void
}) {
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) return setError('Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯')
    setError(null)
    onSave(name.trim(), unitId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ±Ø¯ Ø¬Ø¯ÙŠØ¯">
      <div className="absolute inset-0" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-bold text-gray-900">Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ±Ø¯ Ø¬Ø¯ÙŠØ¯</h2>
        <p className="mb-4 text-xs text-gray-500">Ø³ÙŠÙØ¶Ø§Ù Ø§Ù„Ù…ÙˆØ±Ø¯ Ø¥Ù„Ù‰ Ø§Ù„Ù†ÙˆØ¹ Ø§Ù„Ù…Ø­Ø¯Ø¯ ÙˆØ³ÙŠØ¸Ù‡Ø± ÙÙˆØ±Ø§Ù‹ ÙÙŠ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù….</p>
        <div className="space-y-3">
          <Input label="Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="Ù…Ø«Ø§Ù„: Ø¨Ø±Ø§Ø¯ØŒ ØºØ³Ø§Ù„Ø©ØŒ Ù…ÙƒÙŠÙ" disabled={saving} />
          <Select label="ÙˆØ­Ø¯Ø© Ø§Ù„Ù‚ÙŠØ§Ø³" placeholder="Ø§Ø®ØªØ± Ø§Ù„ÙˆØ­Ø¯Ø©" options={units.map((u) => ({ value: u.id, label: u.name_ar }))} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={saving} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Ø¥Ù„ØºØ§Ø¡</Button>
          <Button onClick={submit} loading={saving}>Ø­ÙØ¸ Ø§Ù„Ù…ÙˆØ±Ø¯</Button>
        </div>
      </div>
    </div>
  )
}

export default ReceiveResources