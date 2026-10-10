import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Package, Search, SlidersHorizontal, TrendingDown, X } from 'lucide-react'
import { api } from '../services/api'
import type { Branch, ResourceCategory, ResourceCustomField, StockBalance, StockMovement } from '../types'
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { formatDateTime, formatNumber, formatQuantity } from '../utils'
import { exportToExcel } from '../utils/excel'

type SortKey = 'name' | 'quantity' | 'category' | 'updated_at'

export default function Inventory() {
  const [balances, setBalances] = useState<StockBalance[]>([])
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'low' | 'zero'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<StockBalance | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [balRes, catRes, brRes] = await Promise.all([
      api.balances.list(),
      api.categories.list(),
      api.branches.list(),
    ])
    setBalances(balRes.data ?? [])
    setCategories((catRes.data ?? []).filter((c) => c.is_active))
    setBranches(brRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    let list = [...balances]

    if (search.trim()) {
      const term = search.trim()
      list = list.filter((b) => (b.resource?.name_ar ?? '').includes(term) || (b.resource?.code ?? '').toLowerCase().includes(term.toLowerCase()))
    }
    if (categoryId) list = list.filter((b) => b.resource?.category_id === categoryId)
    if (branchId) list = list.filter((b) => b.branch_id === branchId)
    if (balanceFilter === 'low') list = list.filter((b) => (b.quantity ?? 0) <= (b.min_quantity ?? 0))
    if (balanceFilter === 'zero') list = list.filter((b) => (b.quantity ?? 0) <= 0)

    const getValue = (b: StockBalance): string | number => {
      if (sortKey === 'name') return b.resource?.name_ar ?? ''
      if (sortKey === 'category') return b.resource?.category?.name_ar ?? ''
      if (sortKey === 'quantity') return b.quantity ?? 0
      return b.updated_at ?? ''
    }

    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va = getValue(a)
      const vb = getValue(b)
      if (typeof va === 'number' || typeof vb === 'number') return ((va as number) - (vb as number)) * dir
      return String(va).localeCompare(String(vb), 'ar') * dir
    })
    return list
  }, [balances, search, categoryId, branchId, balanceFilter, sortKey, sortDir])

  const stats = useMemo(() => {
    const total = balances.reduce((s, b) => s + (b.quantity ?? 0), 0)
    const low = balances.filter((b) => (b.quantity ?? 0) <= (b.min_quantity ?? 0)).length
    return { items: balances.length, total, low }
  }, [balances])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setCategoryId('')
    setBranchId('')
    setBalanceFilter('all')
  }

  const hasFilters = search.trim() || categoryId || branchId || balanceFilter !== 'all'

  return (
    <div className="space-y-5">
      <PageHeader
        title="المخزون"
        description="عرض أرصدة جميع الموارد مع البحث والتصفية وسجل الحركات"
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              exportToExcel(
                'المخزون',
                ['النوع', 'اسم المورد', 'الرمز', 'الوحدة', 'الرصيد', 'الحد الأدنى', 'آخر تحديث'],
                rows.map((b) => [
                  b.resource?.category?.name_ar ?? '',
                  b.resource?.name_ar ?? '',
                  b.resource?.code ?? '',
                  b.resource?.unit?.name_ar ?? '',
                  b.quantity ?? 0,
                  b.min_quantity ?? 0,
                  b.updated_at ? formatDateTime(b.updated_at) : '',
                ])
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden />
            تصدير Excel
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="إجمالي الموارد" value={formatNumber(stats.items)} hint="عدد الموارد المخزنة" />
        <StatCard title="إجمالي الكميات" value={formatNumber(stats.total)} hint="مجموع الأرصدة الحالية" />
        <StatCard title="تحت حد إعادة الطلب" value={formatNumber(stats.low)} hint="تحتاج متابعة" tone="warning" />
      </div>

      <Card>
        <CardHeader title="تصفية وبحث في المخزون" description="ابحث بالاسم أو رمز المورد واعرض النتائج حسب الحاجة" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 h-4 w-4" aria-hidden />
            <Input
              name="search"
              placeholder="بحث باسم المورد أو رمزه..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
              aria-label="بحث"
            />
          </div>
          <Select
            placeholder="كل الأنواع"
            options={categories.map((c) => ({ value: c.id, label: c.name_ar }))}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
          <Select
            placeholder="كل الفروع"
            options={branches.map((b) => ({ value: b.id, label: b.name_ar }))}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
          <Select
            placeholder="كل الأرصدة"
            options={[
              { value: 'all', label: 'كل الأرصدة' },
              { value: 'low', label: 'تحت حد إعادة الطلب' },
              { value: 'zero', label: 'الرصيد صفر' },
            ]}
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as typeof balanceFilter)}
          />
        </div>
        {hasFilters && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" aria-hidden />
              مسح الفلاتر
            </Button>
            <span className="text-xs text-gray-500">{formatNumber(rows.length)} نتيجة</span>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="قائمة الموارد"
          description={`عدد النتائج: ${formatNumber(rows.length)} — اضغط على أي مورد لعرض سجل حركته`}
          action={
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              اضغط على رأس العمود للترتيب
            </div>
          }
        />
        <DataTable<StockBalance>
          loading={loading}
          rows={rows}
          keyOf={(r) => r.id}
          onRowClick={setSelected}
          emptyTitle="لا توجد نتائج"
          emptyDescription="جرّب تعديل البحث أو الفلاتر المستخدمة."
          columns={[
            {
              key: 'category',
              label: 'النوع',
              sortable: true,
              onSort: () => toggleSort('category'),
              sortDir: sortKey === 'category' ? sortDir : undefined,
              render: (r) => <span className="text-gray-700">{r.resource?.category?.name_ar ?? '—'}</span>,
            },
            {
              key: 'name',
              label: 'اسم المورد',
              sortable: true,
              onSort: () => toggleSort('name'),
              sortDir: sortKey === 'name' ? sortDir : undefined,
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#e9f1ed] text-[#054239]" aria-hidden>
                    <Package className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{r.resource?.name_ar}</p>
                    {r.resource?.code && (
                      <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                        {r.resource.code}
                      </p>
                    )}
                  </div>
                </div>
              ),
            },
            { key: 'unit', label: 'الوحدة', render: (r) => r.resource?.unit?.name_ar ?? '—' },
            {
              key: 'quantity',
              label: 'الرصيد',
              sortable: true,
              onSort: () => toggleSort('quantity'),
              sortDir: sortKey === 'quantity' ? sortDir : undefined,
              render: (r) => {
                const low = (r.quantity ?? 0) <= (r.min_quantity ?? 0)
                return (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{formatNumber(r.quantity ?? 0)}</span>
                    {low && (
                      <Badge tone="warning">
                        <TrendingDown className="h-3 w-3" aria-hidden />
                        تحت الحد
                      </Badge>
                    )}
                  </div>
                )
              },
            },
            {
              key: 'min_quantity',
              label: 'الحد الأدنى',
              render: (r) => formatNumber(r.min_quantity ?? 0),
            },
            {
              key: 'branch',
              label: 'الفرع',
              render: (r) => r.branch?.name_ar ?? '—',
            },
            {
              key: 'updated_at',
              label: 'آخر حركة',
              sortable: true,
              onSort: () => toggleSort('updated_at'),
              sortDir: sortKey === 'updated_at' ? sortDir : undefined,
              render: (r) => (r.updated_at ? formatDateTime(r.updated_at) : '—'),
            },
          ]}
        />
      </Card>

      {selected && <ResourceDetailModal balance={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function StatCard({ title, value, hint, tone = 'neutral' }: { title: string; value: string; hint?: string; tone?: 'neutral' | 'warning' }) {
  return (
    <Card className={tone === 'warning' ? 'border-[#e8c98f] bg-[#fdf9ee]' : undefined}>
      <div className="p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-[#002623]">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
      </div>
    </Card>
  )
}

function ResourceDetailModal({ balance, onClose }: { balance: StockBalance; onClose: () => void }) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [fields, setFields] = useState<ResourceCustomField[]>([])
  const [loading, setLoading] = useState(true)
  const resourceId = balance.resource_id

  useEffect(() => {
    if (!resourceId) return
    Promise.all([api.movements.history(resourceId), api.fields.listByResource(resourceId)]).then(([m, f]) => {
      setMovements(m.data ?? [])
      setFields(f.data ?? [])
      setLoading(false)
    })
  }, [resourceId])

  const totalReceived = movements.filter((m) => m.movement_type === 'receipt').reduce((s, m) => s + m.quantity, 0)
  const totalDelivered = movements.filter((m) => m.movement_type === 'delivery').reduce((s, m) => s + m.quantity, 0)

  return (
    <Modal open onClose={onClose} title={balance.resource?.name_ar ?? 'تفاصيل المورد'} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="نوع المورد" value={balance.resource?.category?.name_ar} />
          <InfoRow label="رمز المورد" value={balance.resource?.code} />
          <InfoRow label="الوحدة" value={balance.resource?.unit?.name_ar} />
          <InfoRow label="الرصيد الحالي" value={formatQuantity(balance.quantity ?? 0, balance.resource?.unit?.name_ar)} />
          <InfoRow label="الحد الأدنى" value={formatNumber(balance.min_quantity ?? 0)} />
          <InfoRow label="الفرع" value={balance.branch?.name_ar} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#bcd9d1] bg-[#eaf4ef] p-3">
            <p className="text-[11px] text-gray-500">إجمالي المستلم</p>
            <p className="text-lg font-bold text-[#054239]">{formatNumber(totalReceived)}</p>
          </div>
          <div className="rounded-lg border border-[#e0d3b2] bg-[#fdf6e7] p-3">
            <p className="text-[11px] text-gray-500">إجمالي المسلّم</p>
            <p className="text-lg font-bold text-[#6d5836]">{formatNumber(totalDelivered)}</p>
          </div>
        </div>

        {fields.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">الحقول الإضافية المعرّفة</h3>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <Badge key={f.id} tone="neutral">
                  {f.field_name_ar}
                  {f.is_required && <span aria-hidden className="text-[#6b1f2a]">*</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">سجل حركات المورد</h3>
          {loading ? (
            <Spinner />
          ) : movements.length === 0 ? (
            <EmptyState title="لا توجد حركات" description="لم تُسجَّل أي عمليات استلام أو تسليم لهذا المورد بعد." />
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-[#f7f6f1]">
                  <tr>
                    <th className="px-3 py-2 font-medium">النوع</th>
                    <th className="px-3 py-2 font-medium">الكمية</th>
                    <th className="px-3 py-2 font-medium">التفاصيل</th>
                    <th className="px-3 py-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <Badge tone={m.movement_type === 'receipt' ? 'success' : 'warning'}>
                          {m.movement_type === 'receipt' ? 'استلام' : 'تسليم'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{formatNumber(m.quantity)}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {m.recipient_name ?? m.from_branch?.name_ar ?? m.to_branch?.name_ar ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{formatDateTime(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </Modal>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-gray-200 pb-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}
