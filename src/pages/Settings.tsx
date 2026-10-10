import { useCallback, useEffect, useState } from 'react'
import { Building2, Save, Truck, Users } from 'lucide-react'
import { api } from '../services/api'
import { BRAND } from '../config/brand'
import { useAuth } from '../context/AuthContext'
import type { Branch, Department, Person, Supplier } from '../types'
import { Badge, Button, Card, CardHeader, DataTable, Input, Modal, PageHeader } from '../components/ui'
import { formatDate } from '../utils'

type Tab = 'branches' | 'departments' | 'people' | 'suppliers'

export default function Settings() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('branches')

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'branches', label: 'الفروع والمواقع', icon: Building2 },
    { key: 'departments', label: 'الأقسام', icon: Users },
    { key: 'people', label: 'الأشخاص المستلمون', icon: Users },
    { key: 'suppliers', label: 'الجهات الموردة', icon: Truck },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="الإعدادات" description="بيانات الجهة والفروع والأقسام والجهات الموردة" />

      <Card>
        <CardHeader title="بيانات الجهة" description="تظهر في المستندات المطبوعة والتقارير الرسمية" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Input label="اسم الجهة" value={BRAND.organization} readOnly disabled />
          <Input label="إصدار النظام" value={BRAND.version} readOnly disabled dir="ltr" />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-2">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium',
                  tab === t.key ? 'border-[#428177] text-[#054239]' : 'border-transparent text-gray-500 hover:text-gray-800',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'branches' && <BranchesTab />}
        {tab === 'departments' && <DepartmentsTab />}
        {tab === 'people' && <PeopleTab />}
        {tab === 'suppliers' && <SuppliersTab />}
      </Card>

      {profile && (
        <Card>
          <CardHeader title="حسابي" description="بيانات حسابك وصلاحياتك في النظام" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Info label="الاسم" value={profile.full_name_ar ?? '—'} />
            <Info label="الدور" value={profile.role?.name_ar ?? '—'} />
            <Info label="الفرع" value={profile.branch?.name_ar ?? '—'} />
            <Info label="القسم" value={profile.department?.name_ar ?? '—'} />
          </div>
        </Card>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-gray-200 pb-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}

function BranchesTab() {
  const [items, setItems] = useState<Branch[]>([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await api.branches.list()
    setItems(res.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!name.trim()) return setError('اسم الفرع مطلوب')
    setError(null)
    setSaving(true)
    const res = await api.branches.create({ name_ar: name.trim(), location: location.trim() || undefined })
    setSaving(false)
    if (res.error) return setError(res.error)
    setName('')
    setLocation('')
    await load()
  }

  return (
    <div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="اسم الفرع" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: فرع صنعاء" error={error} disabled={saving} />
        <Input label="الموقع (اختياري)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="المدينة أو العنوان" disabled={saving} />
        <Button onClick={submit} loading={saving}>
          <Save className="h-4 w-4" aria-hidden />
          إضافة فرع
        </Button>
      </div>
      <DataTable<Branch>
        rows={items}
        keyOf={(r) => r.id}
        columns={[
          { key: 'name', label: 'اسم الفرع', render: (r) => r.name_ar },
          { key: 'location', label: 'الموقع', render: (r) => r.location ?? '—' },
          { key: 'is_active', label: 'الحالة', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge> },
          { key: 'created_at', label: 'تاريخ الإضافة', render: (r) => formatDate(r.created_at) },
        ]}
      />
    </div>
  )
}

function DepartmentsTab() {
  const [items, setItems] = useState<Department[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [name, setName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [d, b] = await Promise.all([api.departments.list(), api.branches.list()])
    setItems(d.data ?? [])
    setBranches(b.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!name.trim()) return setError('اسم القسم مطلوب')
    setError(null)
    setSaving(true)
    const res = await api.departments.create({ name_ar: name.trim(), branch_id: branchId || undefined })
    setSaving(false)
    if (res.error) return setError(res.error)
    setName('')
    await load()
  }

  return (
    <div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="اسم القسم / الشعبة" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: قسم الموارد" error={error} disabled={saving} />
        <Input label="الفرع" value={branches.find((b) => b.id === branchId)?.name_ar ?? 'غير محدد'} readOnly disabled />
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            aria-label="اختيار الفرع"
          >
            <option value="">بدون فرع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_ar}
              </option>
            ))}
          </select>
          <Button onClick={submit} loading={saving}>
            <Save className="h-4 w-4" aria-hidden />
            إضافة
          </Button>
        </div>
      </div>
      <DataTable<Department>
        rows={items}
        keyOf={(r) => r.id}
        columns={[
          { key: 'name', label: 'اسم القسم', render: (r) => r.name_ar },
          { key: 'branch', label: 'الفرع', render: (r) => branches.find((b) => b.id === r.branch_id)?.name_ar ?? '—' },
          { key: 'is_active', label: 'الحالة', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge> },
        ]}
      />
    </div>
  )
}

function PeopleTab() {
  const [items, setItems] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Person | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.people.list()
    setItems(res.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between p-4">
        <p className="text-sm text-gray-600">قائمة الأشخاص الذين يمكن لهم استلام الموارد</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          إضافة شخص
        </Button>
      </div>
      <DataTable<Person>
        loading={loading}
        rows={items}
        keyOf={(r) => r.id}
        columns={[
          { key: 'name', label: 'الاسم', render: (r) => r.name_ar },
          { key: 'phone', label: 'الهاتف', render: (r) => <span dir="ltr">{r.phone ?? '—'}</span> },
          { key: 'national_id', label: 'الرقم الوطني', render: (r) => <span dir="ltr">{r.national_id ?? '—'}</span> },
          { key: 'is_active', label: 'الحالة', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge> },
        ]}
      />
      {(creating || editing) && (
        <PersonModal
          person={editing}
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
    </div>
  )
}

function PersonModal({ person, onClose, onSaved }: { person: Person | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(person?.name_ar ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [nationalId, setNationalId] = useState(person?.national_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return setError('الاسم مطلوب')
    setError(null)
    setSaving(true)
    const res = await api.people.create({ name_ar: name.trim(), phone: phone.trim() || undefined, national_id: nationalId.trim() || undefined })
    setSaving(false)
    if (res.error) return setError(res.error)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={person ? 'تعديل شخص' : 'إضافة شخص مستلم'}>
      <div className="space-y-3">
        <Input label="الاسم الكامل *" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={saving} autoFocus />
        <Input label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={saving} />
        <Input label="الرقم الوطني (اختياري)" value={nationalId} onChange={(e) => setNationalId(e.target.value)} dir="ltr" disabled={saving} />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button onClick={submit} loading={saving}>حفظ</Button>
      </div>
    </Modal>
  )
}

function SuppliersTab() {
  const [items, setItems] = useState<Supplier[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await api.suppliers.list()
    setItems(res.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!name.trim()) return setError('اسم الجهة مطلوب')
    setError(null)
    setSaving(true)
    const res = await api.suppliers.create({ name_ar: name.trim(), phone: phone.trim() || undefined })
    setSaving(false)
    if (res.error) return setError(res.error)
    setName('')
    setPhone('')
    await load()
  }

  return (
    <div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="اسم الجهة الموردة" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: شركة التجهيزات" error={error} disabled={saving} />
        <Input label="رقم الهاتف (اختياري)" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={saving} />
        <Button onClick={submit} loading={saving}>
          <Save className="h-4 w-4" aria-hidden />
          إضافة جهة
        </Button>
      </div>
      <DataTable<Supplier>
        rows={items}
        keyOf={(r) => r.id}
        columns={[
          { key: 'name', label: 'اسم الجهة', render: (r) => r.name_ar },
          { key: 'phone', label: 'الهاتف', render: (r) => <span dir="ltr">{r.phone ?? '—'}</span> },
          { key: 'is_active', label: 'الحالة', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge> },
        ]}
      />
    </div>
  )
}