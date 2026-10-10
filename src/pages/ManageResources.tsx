import { useCallback, useEffect, useState } from 'react'
import { FolderTree, Pencil, Plus, Power, Ruler, Settings2, Tags } from 'lucide-react'
import { api } from '../services/api'
import { FIELD_TYPES } from '../constants'
import type { Resource, ResourceCategory, ResourceCustomField, UnitOfMeasure } from '../types'
import { Alert, Badge, Button, Card, CardHeader, DataTable, Input, Modal, PageHeader, Select, Textarea } from '../components/ui'
import { formatDateTime } from '../utils'

type Tab = 'categories' | 'resources' | 'units' | 'fields'

export default function ManageResources() {
  const [tab, setTab] = useState<Tab>('categories')

  const tabs: { key: Tab; label: string; icon: typeof FolderTree }[] = [
    { key: 'categories', label: 'أنواع الموارد', icon: FolderTree },
    { key: 'resources', label: 'الموارد والأسماء', icon: Tags },
    { key: 'units', label: 'وحدات القياس', icon: Ruler },
    { key: 'fields', label: 'الحقول الذكية', icon: Settings2 },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الموارد والتصنيفات"
        description="إضافة أنواع الموارد وأسمائها ووحدات قياسها والحقول الإضافية لكل نوع"
      />

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab === t.key ? 'border-[#428177] text-[#054239]' : 'border-transparent text-gray-500 hover:text-gray-800',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'resources' && <ResourcesTab />}
      {tab === 'units' && <UnitsTab />}
      {tab === 'fields' && <FieldsTab />}
    </div>
  )
}

function CategoriesTab() {
  const [items, setItems] = useState<ResourceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ResourceCategory | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.categories.list()
    setItems(res.data ?? [])
    if (res.error) setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (cat: ResourceCategory) => {
    const res = await api.categories.setActive(cat.id, !cat.is_active)
    if (res.error) return setError(res.error)
    await load()
  }

  return (
    <Card>
      <CardHeader
        title="أنواع الموارد (التصنيفات)"
        description="مثال: الملابس والتجهيزات، الأجهزة الكهربائية، المحروقات، السيارات"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            إضافة نوع جديد
          </Button>
        }
      />
      {error && (
        <div className="px-4 pt-3">
          <Alert tone="danger" title="خطأ">
            {error}
          </Alert>
        </div>
      )}
      <DataTable<ResourceCategory>
        loading={loading}
        rows={items}
        keyOf={(r) => r.id}
        columns={[
          { key: 'name', label: 'اسم النوع', render: (r) => <span className="font-medium text-gray-900">{r.name_ar}</span> },
          { key: 'name_en', label: 'الاسم اللاتيني', render: (r) => <span dir="ltr" className="text-gray-600">{r.name_en || '—'}</span> },
          { key: 'description', label: 'الوصف', render: (r) => <span className="text-gray-600">{r.description || '—'}</span> },
          {
            key: 'is_active',
            label: 'الحالة',
            render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge>,
          },
          { key: 'created_at', label: 'تاريخ الإضافة', render: (r) => formatDateTime(r.created_at) },
          {
            key: 'actions',
            label: 'إجراءات',
            render: (r) => (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  تعديل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {r.is_active ? 'إيقاف' : 'تفعيل'}
                </Button>
              </div>
            ),
          },
        ]}
      />

      {(creating || editing) && (
        <CategoryModal
          category={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await load()
          }}
        />
      )}
    </Card>
  )
}

function CategoryModal({ category, onClose, onSaved }: { category: ResourceCategory | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name_ar ?? '')
  const [nameEn, setNameEn] = useState(category?.name_en ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return setError('اسم النوع مطلوب')
    setError(null)
    setSaving(true)
    const res = category
      ? await api.categories.update(category.id, { name_ar: name.trim(), name_en: nameEn.trim(), description: description.trim() })
      : await api.categories.create({ name_ar: name.trim(), name_en: nameEn.trim(), description: description.trim() })
    setSaving(false)
    if (res.error) return setError(res.error)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={category ? 'تعديل نوع مورد' : 'إضافة نوع مورد جديد'}>
      <div className="space-y-3">
        <Input label="اسم النوع *" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={saving} autoFocus placeholder="مثال: أجهزة كهربائية" />
        <Input label="الاسم اللاتيني (اختياري)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" disabled={saving} />
        <Textarea label="الوصف (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button onClick={submit} loading={saving}>{category ? 'حفظ التعديلات' : 'حفظ النوع'}</Button>
      </div>
    </Modal>
  )
}

function ResourcesTab() {
  const [items, setItems] = useState<Resource[]>([])
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [units, setUnits] = useState<UnitOfMeasure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [res, cats, uns] = await Promise.all([api.resources.list(), api.categories.list(), api.units.list()])
    setItems(res.data ?? [])
    setCategories((cats.data ?? []).filter((c) => c.is_active))
    setUnits(uns.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = filterCat ? items.filter((r) => r.category_id === filterCat) : items

  const toggleActive = async (r: Resource) => {
    const res = await api.resources.setActive(r.id, !r.is_active)
    if (res.error) return setError(res.error)
    await load()
  }

  return (
    <Card>
      <CardHeader
        title="أسماء الموارد"
        description="الموارد التابعة لكل نوع — تظهر تلقائياً في واجهات الاستلام والتسليم"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            إضافة مورد
          </Button>
        }
      />
      <div className="p-4 pb-0">
        <Select
          placeholder="كل الأنواع"
          options={categories.map((c) => ({ value: c.id, label: c.name_ar }))}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        />
      </div>
      {error && (
        <div className="px-4 pt-3">
          <Alert tone="danger" title="خطأ">{error}</Alert>
        </div>
      )}
      <DataTable<Resource>
        loading={loading}
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="لا توجد موارد"
        emptyDescription="أضف مورداً جديداً ليظهر في قوائم الاستلام والتسليم."
        columns={[
          { key: 'name', label: 'اسم المورد', render: (r) => <span className="font-medium text-gray-900">{r.name_ar}</span> },
          { key: 'category', label: 'النوع', render: (r) => r.category?.name_ar ?? '—' },
          { key: 'unit', label: 'الوحدة', render: (r) => r.unit?.name_ar ?? '—' },
          { key: 'kind', label: 'طبيعة المورد', render: (r) => <Badge tone={r.is_asset ? 'info' : 'neutral'}>{r.is_asset ? 'أصل فردي' : 'استهلاكي'}</Badge> },
          { key: 'is_active', label: 'الحالة', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge> },
          {
            key: 'actions',
            label: 'إجراءات',
            render: (r) => (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  تعديل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {r.is_active ? 'إيقاف' : 'تفعيل'}
                </Button>
              </div>
            ),
          },
        ]}
      />

      {(creating || editing) && (
        <ResourceModal
          resource={editing}
          categories={categories}
          units={units}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await load()
          }}
        />
      )}
    </Card>
  )
}

function ResourceModal({
  resource,
  categories,
  units,
  onClose,
  onSaved,
}: {
  resource: Resource | null
  categories: ResourceCategory[]
  units: UnitOfMeasure[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(resource?.name_ar ?? '')
  const [categoryId, setCategoryId] = useState(resource?.category_id ?? categories[0]?.id ?? '')
  const [unitId, setUnitId] = useState(resource?.unit_id ?? units[0]?.id ?? '')
  const [isAsset, setIsAsset] = useState(resource?.is_asset ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return setError('اسم المورد مطلوب')
    if (!categoryId) return setError('اختر نوع المورد')
    setError(null)
    setSaving(true)
    const res = resource
      ? await api.resources.update(resource.id, { name_ar: name.trim(), category_id: categoryId, unit_id: unitId, is_asset: isAsset })
      : await api.resources.create({ category_id: categoryId, name_ar: name.trim(), unit_id: unitId, is_asset: isAsset })
    setSaving(false)
    if (res.error) return setError(res.error)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={resource ? 'تعديل مورد' : 'إضافة مورد جديد'}>
      <div className="space-y-3">
        <Input label="اسم المورد *" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={saving} autoFocus placeholder="مثال: براد، غسالة، مكيف" />
        <Select
          label="نوع المورد *"
          placeholder="اختر النوع"
          options={categories.map((c) => ({ value: c.id, label: c.name_ar }))}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={saving}
        />
        <Select
          label="وحدة القياس"
          placeholder="اختر الوحدة"
          options={units.map((u) => ({ value: u.id, label: u.name_ar }))}
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          disabled={saving}
        />
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-[#fbfaf6] px-3 py-2">
          <input
            type="checkbox"
            checked={isAsset}
            onChange={(e) => setIsAsset(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#428177] focus:ring-[#428177]"
            disabled={saving}
          />
          <span className="text-sm text-gray-700">
            هذا مورد فردي قابل للتتبع (مثل سيارة أو جهاز برقم تسلسلي)
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button onClick={submit} loading={saving}>{resource ? 'حفظ التعديلات' : 'حفظ المورد'}</Button>
      </div>
    </Modal>
  )
}

function UnitsTab() {
  const [items, setItems] = useState<UnitOfMeasure[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await api.units.list()
    setItems(res.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!name.trim()) return setError('اسم الوحدة مطلوب')
    setError(null)
    setSaving(true)
    const res = await api.units.create({ name_ar: name.trim(), symbol_ar: symbol.trim() || undefined })
    setSaving(false)
    if (res.error) return setError(res.error)
    setName('')
    setSymbol('')
    await load()
  }

  return (
    <Card>
      <CardHeader title="وحدات القياس" description="الوحدات المستخدمة في تحديد الكميات (حبة، لتر، متر...)" />
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="اسم الوحدة" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: لتر" disabled={saving} error={error} />
        <Input label="الرمز (اختياري)" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="L" dir="ltr" disabled={saving} />
        <Button onClick={submit} loading={saving}>
          <Plus className="h-4 w-4" aria-hidden />
          إضافة وحدة
        </Button>
      </div>
      <DataTable<UnitOfMeasure>
        loading={loading}
        rows={items}
        keyOf={(r) => r.id}
        columns={[
          { key: 'name', label: 'الاسم', render: (r) => r.name_ar },
          { key: 'name_en', label: 'الاسم اللاتيني', render: (r) => <span dir="ltr">{r.name_en || '—'}</span> },
          { key: 'symbol', label: 'الرمز', render: (r) => <span dir="ltr">{r.symbol_ar || '—'}</span> },
        ]}
      />
    </Card>
  )
}

function FieldsTab() {
  const [items, setItems] = useState<ResourceCustomField[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resourceId, setResourceId] = useState('')
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<ResourceCustomField['field_type']>('text')
  const [required, setRequired] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await api.resources.list()
    setResources(res.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!resourceId) {
      setItems([])
      return
    }
    api.fields.listByResource(resourceId).then((res) => setItems(res.data ?? []))
  }, [resourceId])

  const submit = async () => {
    if (!resourceId || !label.trim()) {
      setError('اختر المورد وأدخل اسم الحقل')
      return
    }
    setError(null)
    setSaving(true)
    const res = await api.fields.create({
      resource_id: resourceId,
      field_name: label.trim(),
      field_name_ar: label.trim(),
      field_type: fieldType,
      is_required: required,
    })
    setSaving(false)
    if (res.error) return setError(res.error)
    setLabel('')
    setRequired(false)
    const refreshed = await api.fields.listByResource(resourceId)
    setItems(refreshed.data ?? [])
  }

  const remove = async (id: string) => {
    await api.fields.remove(id)
    const refreshed = await api.fields.listByResource(resourceId)
    setItems(refreshed.data ?? [])
  }

  return (
    <Card>
      <CardHeader
        title="الحقول الذكية حسب نوع المورد"
        description="حدد لكل مورد حقوله الخاصة التي تظهر تلقائياً في الاستلام والتسليم — دون تعديل الكود"
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="المورد"
          placeholder="اختر المورد"
          options={resources.map((r) => ({ value: r.id, label: r.name_ar }))}
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
        />
        <Input
          label="اسم الحقل"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="مثال: الرقم التسلسلي، رقم اللوحة"
          error={error}
          disabled={saving || !resourceId}
        />
        <Select
          label="نوع الحقل"
          options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as ResourceCustomField['field_type'])}
          disabled={saving}
        />
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#428177] focus:ring-[#428177]"
              disabled={saving || !resourceId}
            />
            مطلوب
          </label>
          <Button onClick={submit} loading={saving} disabled={!resourceId}>
            <Plus className="h-4 w-4" aria-hidden />
            إضافة حقل
          </Button>
        </div>
      </div>

      {!resourceId ? (
        <p className="px-4 pb-6 pt-2 text-center text-sm text-gray-400">اختر مورداً لعرض الحقول الإضافية الخاصة به.</p>
      ) : (
        <DataTable<ResourceCustomField>
          rows={items}
          keyOf={(r) => r.id}
          emptyTitle="لا توجد حقول إضافية"
          emptyDescription="أضف حقولاً مثل الرقم التسلسلي أو رقم اللوحة لتظهر في نموذج الاستلام والتسليم."
          columns={[
            { key: 'label', label: 'اسم الحقل', render: (r) => r.field_name_ar },
            {
              key: 'type',
              label: 'نوع الحقل',
              render: (r) => <Badge tone="neutral">{FIELD_TYPES.find((t) => t.value === r.field_type)?.label ?? r.field_type}</Badge>,
            },
            { key: 'required', label: 'مطلوب', render: (r) => (r.is_required ? 'نعم' : 'لا') },
            {
              key: 'actions',
              label: 'إجراءات',
              render: (r) => (
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                  حذف
                </Button>
              ),
            },
          ]}
        />
      )}
    </Card>
  )
}