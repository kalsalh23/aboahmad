import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Package, Search, TrendingDown } from 'lucide-react'
import { api } from '../services/api'
import type { ResourceCategory, StockBalance, StockMovement } from '../types'
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Spinner } from '../components/ui'
import { formatDateTime, formatNumber } from '../utils'
import { exportToExcel } from '../utils/excel'

interface CategoryStats {
  category: ResourceCategory
  resourceCount: number
  available: number
  delivered: number
  received: number
  lastMovement?: StockMovement
  lowCount: number
  rows: StockBalance[]
}

export default function Inventory() {
  const [balances, setBalances] = useState<StockBalance[]>([])
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CategoryStats | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [balRes, catRes, movRes] = await Promise.all([
      api.balances.list(),
      api.categories.list(),
      api.movements.list({ limit: 500 }),
    ])
    setBalances(balRes.data ?? [])
    setCategories((catRes.data ?? []).filter((c) => c.is_active))
    setMovements(movRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo<CategoryStats[]>(() => {
    const byCat = new Map<string, StockBalance[]>()
    balances.forEach((b) => {
      const key = b.resource?.category_id ?? 'uncategorized'
      const list = byCat.get(key) ?? []
      list.push(b)
      byCat.set(key, list)
    })

    const result: CategoryStats[] = []

    categories.forEach((cat) => {
      const rows = byCat.get(cat.id) ?? []
      if (rows.length === 0) return

      const available = rows.reduce((s, b) => s + Number(b.quantity ?? 0), 0)
      const lowCount = rows.filter((b) => Number(b.quantity ?? 0) <= Number(b.min_quantity ?? 0)).length
      const catMoves = movements.filter((m) => m.resource?.category_id === cat.id && m.status === 'completed')
      const received = catMoves.filter((m) => m.movement_type === 'receipt').reduce((s, m) => s + Number(m.quantity ?? 0), 0)
      const delivered = catMoves.filter((m) => m.movement_type === 'delivery').reduce((s, m) => s + Number(m.quantity ?? 0), 0)
      const lastMovement = catMoves[0]

      result.push({ category: cat, resourceCount: rows.length, available, delivered, received, lastMovement, lowCount, rows })
    })

    return result.sort((a, b) => b.available - a.available)
  }, [balances, categories, movements])

  const visible = useMemo(() => {
    const term = search.trim()
    if (!term) return stats
    return stats.filter((s) => s.category.name_ar.includes(term) || s.category.name_en.includes(term))
  }, [stats, search])

  const totals = useMemo(() => {
    return {
      available: stats.reduce((s, x) => s + x.available, 0),
      delivered: stats.reduce((s, x) => s + x.delivered, 0),
      received: stats.reduce((s, x) => s + x.received, 0),
      resources: stats.reduce((s, x) => s + x.resourceCount, 0),
    }
  }, [stats])

  return (
    <div className="space-y-5">
      <PageHeader
        title="المخزون"
        description="اختر صنفاً لعرض تفاصيله من المتاح والمسلّم والإجمالي"
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              exportToExcel(
                'المخزون',
                ['نوع المورد', 'عدد الموارد', 'المتاح', 'إجمالي المستلم', 'إجمالي المسلّم'],
                stats.map((s) => [s.category.name_ar, s.resourceCount, s.available, s.received, s.delivered])
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden />
            تصدير Excel
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="إجمالي المتاح" value={formatNumber(totals.available)} />
        <SummaryCard label="إجمالي المسلّم" value={formatNumber(totals.delivered)} tone="warning" />
        <SummaryCard label="إجمالي المستلم" value={formatNumber(totals.received)} tone="success" />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 h-4 w-4" aria-hidden />
        <Input
          name="search"
          placeholder="ابحث عن صنف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
          aria-label="بحث"
        />
      </div>

      {loading ? (
        <Spinner label="جارٍ تحميل المخزون..." />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState title="لا توجد أصناف" description="أضف أنواع الموارد من صفحة إدارة الموارد لتظهر هنا." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((s) => (
            <button
              key={s.category.id}
              type="button"
              onClick={() => setSelected(s)}
              className="flex flex-col gap-3 rounded-xl border border-[#ded9c7] bg-white p-4 text-center transition-colors hover:border-[#428177] hover:bg-[#f4f7f5] focus:outline-none focus:ring-2 focus:ring-[#428177] focus:ring-offset-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#002623]">
                  <Package className="h-4 w-4 text-[#428177]" aria-hidden />
                  {s.category.name_ar}
                </span>
                {s.lowCount > 0 && (
                  <Badge tone="warning">
                    <TrendingDown className="h-3 w-3" aria-hidden />
                    {formatNumber(s.lowCount)}
                  </Badge>
                )}
              </div>

              <div className="py-1">
                <p className="text-4xl font-bold leading-none tracking-tight text-[#054239]">{formatNumber(s.available)}</p>
                <p className="mt-1.5 text-xs text-gray-500">متاح</p>
              </div>

              <div className="grid grid-cols-2 gap-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                <span>موارد: {formatNumber(s.resourceCount)}</span>
                <span>مسلّم: {formatNumber(s.delivered)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <CategoryDetail stats={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const border = tone === 'success' ? 'border-[#bcd9d1]' : tone === 'warning' ? 'border-[#e8c98f]' : 'border-[#ded9c7]'
  return (
    <Card className={`${border} p-3`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#002623]">{value}</p>
    </Card>
  )
}

function CategoryDetail({ stats, onClose }: { stats: CategoryStats; onClose: () => void }) {
  const lowRows = stats.rows.filter((b) => Number(b.quantity ?? 0) <= Number(b.min_quantity ?? 0))

  return (
    <Modal open onClose={onClose} title={stats.category.name_ar} size="xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-[#c9dcd5] bg-[#f4f7f5] px-4 py-6 text-center">
          <p className="text-5xl font-bold leading-none tracking-tight text-[#054239]">{formatNumber(stats.available)}</p>
          <p className="mt-2 text-sm font-medium text-gray-600">الكمية المتاحة حالياً</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatBox label="إجمالي المسلّم" value={formatNumber(stats.delivered)} tone="warning" />
          <StatBox label="إجمالي المستلم" value={formatNumber(stats.received)} tone="success" />
          <StatBox label="عدد الموارد" value={formatNumber(stats.resourceCount)} />
        </div>

        {lowRows.length > 0 && (
          <div className="rounded-lg border border-[#e8c98f] bg-[#fdf9ee] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#6d5836]">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              {formatNumber(lowRows.length)} مورد تحت حد إعادة الطلب
            </p>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">الموارد ضمن هذا الصنف</h3>
          {stats.rows.length === 0 ? (
            <EmptyState title="لا توجد موارد" description="لم تُضف موارد لهذا الصنف بعد." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[560px] border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-[#f7f6f1] text-xs text-gray-600">
                    <th className="px-3 py-2 font-medium">المورد</th>
                    <th className="px-3 py-2 font-medium">الوحدة</th>
                    <th className="px-3 py-2 font-medium">المتاح</th>
                    <th className="px-3 py-2 font-medium">الحد الأدنى</th>
                    <th className="px-3 py-2 font-medium">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rows.map((b) => {
                    const low = Number(b.quantity ?? 0) <= Number(b.min_quantity ?? 0)
                    return (
                      <tr key={b.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-gray-900">{b.resource?.name_ar}</span>
                          {b.resource?.code && (
                            <span className="ms-2 font-mono text-[10px] text-gray-400" dir="ltr">
                              {b.resource.code}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{b.resource?.unit?.name_ar ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-gray-900">{formatNumber(Number(b.quantity ?? 0))}</span>
                          {low && (
                            <Badge tone="warning" className="ms-2">
                              <TrendingDown className="h-3 w-3" aria-hidden />
                              منخفض
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{formatNumber(Number(b.min_quantity ?? 0))}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{b.updated_at ? formatDateTime(b.updated_at) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {stats.lastMovement && (
          <p className="text-xs text-gray-500">
            آخر حركة مسجّلة: {formatDateTime(stats.lastMovement.created_at)} — {stats.lastMovement.movement_type === 'receipt' ? 'استلام' : 'تسليم'}
          </p>
        )}

        <div className="flex justify-end border-t border-gray-200 pt-3">
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function StatBox({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const border = tone === 'success' ? 'border-[#bcd9d1] bg-[#eaf4ef]' : tone === 'warning' ? 'border-[#e0d3b2] bg-[#fdf6e7]' : 'border-gray-200 bg-white'
  return (
    <div className={`rounded-lg border p-3 ${border}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-[#002623]">{value}</p>
    </div>
  )
}
