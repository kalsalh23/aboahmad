import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, BarChart3, ShieldAlert, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Card, CardHeader, PageHeader, Spinner } from '../components/ui'
import { formatDateTime, formatQuantity } from '../utils'
import type { DashboardStats, StockBalance, StockMovement } from '../types'

const ACTIONS = [
  {
    to: '/app/receive',
    title: 'استلام الموارد',
    description: 'تسجيل موارد جديدة داخل المستودع مع المستند والمصدر',
    icon: ArrowDownToLine,
    perm: 'receipt.create',
  },
  {
    to: '/app/deliver',
    title: 'تسليم الموارد',
    description: 'صرف موارد للأفراد أو الفروع مع تحديد المستلم والمستند',
    icon: ArrowUpFromLine,
    perm: 'delivery.create',
  },
  {
    to: '/app/stock',
    title: 'المخزون',
    description: 'عرض الأرصدة والمواقع وسجل الاستلام والتسليم',
    icon: Boxes,
    perm: 'stock.view',
  },
  {
    to: '/app/reports',
    title: 'التقارير',
    description: 'استخراج تقارير الاستلام والتسليم والجرد والفروقات',
    icon: BarChart3,
    perm: 'reports.view',
  },
] as const

export default function Dashboard() {
  const { profile, can } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({ total_resources: 0, total_categories: 0, low_stock_items: 0, total_assets: 0, recent_movements: 0 })
  const [recent, setRecent] = useState<StockMovement[]>([])
  const [lowStock, setLowStock] = useState<StockBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [resourcesRes, categoriesRes, balancesRes, movementsRes] = await Promise.all([
        api.resources.list({ is_active: true }),
        api.categories.list(),
        api.balances.list(),
        api.movements.recent(8),
      ])

      const balances = balancesRes.data ?? []
      setLowStock(balances.filter((b) => (b.quantity ?? 0) <= (b.min_quantity ?? 0)).slice(0, 5))
      setRecent(movementsRes.data ?? [])
      setStats({
        total_resources: resourcesRes.data?.length ?? 0,
        total_categories: categoriesRes.data?.length ?? 0,
        low_stock_items: balances.filter((b) => (b.quantity ?? 0) <= (b.min_quantity ?? 0)).length,
        total_assets: 0,
        recent_movements: movementsRes.data?.length ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'طاب يومك' : 'مساء الخير'
  const visibleActions = ACTIONS.filter((a) => !a.perm || can(a.perm))

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting}
        description={profile?.role?.name_ar ? `الدور: ${profile.role.name_ar}${profile.branch?.name_ar ? ` — ${profile.branch.name_ar}` : ''}` : undefined}
      />

      <section aria-label="العمليات الرئيسية">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">العمليات اليومية</h2>
        {visibleActions.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">لا توجد صلاحيات مُنوطة بحسابك حتى الآن.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex h-full min-h-[152px] flex-col justify-between rounded-xl border border-[#ded9c7] bg-white p-5 transition-colors hover:border-[#428177] hover:bg-[#f4f7f5] focus:outline-none focus:ring-2 focus:ring-[#428177] focus:ring-offset-2"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e9f1ed] text-[#054239] group-hover:bg-[#428177] group-hover:text-white" aria-hidden>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-lg font-bold leading-snug text-[#002623]">{action.title}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">{action.description}</p>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="آخر الحركات المسجلة"
            description="أحدث عمليات الاستلام والتسليم في النظام"
            action={
              can('stock.view') && (
                <Link to="/app/stock" className="text-xs font-medium text-[#054239] hover:underline">
                  عرض الكل
                </Link>
              )
            }
          />
          {loading ? (
            <Spinner />
          ) : recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">لا توجد حركات مسجلة بعد.</p>
          ) : (
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium">رقم الحركة</th>
                  <th className="px-3 py-2 font-medium">النوع</th>
                  <th className="px-3 py-2 font-medium">المورد</th>
                  <th className="px-3 py-2 font-medium">الكمية</th>
                  <th className="px-3 py-2 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => navigate(m.movement_type === 'receipt' ? '/app/receive' : '/app/deliver')}
                    className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-gray-600" dir="ltr">
                      {m.movement_number}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={m.movement_type === 'receipt' ? 'success' : 'warning'}>
                        {m.movement_type === 'receipt' ? 'استلام' : 'تسليم'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-800">{m.resource?.name_ar}</td>
                    <td className="px-3 py-2 text-gray-700">{formatQuantity(m.quantity, m.resource?.unit?.name_ar)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="تنبيهات المخزون" description="موارد وصلت إلى حد إعادة الطلب أو أقل" />
          <div className="space-y-2 p-3">
            {stats.low_stock_items > 0 ? (
              lowStock.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#e8c98f] bg-[#fdf9ee] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#8a6d2f]" aria-hidden />
                    <span className="text-xs text-gray-700">{b.resource?.name_ar}</span>
                  </div>
                  <Badge tone="warning">{formatQuantity(b.quantity ?? 0, b.resource?.unit?.name_ar)}</Badge>
                </div>
              ))
            ) : (
              <p className="flex items-center gap-2 px-1 py-4 text-sm text-gray-400">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                لا توجد تنبيهات حالياً
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-gray-200 bg-gray-100 text-center">
            <div className="bg-white p-3">
              <p className="text-lg font-bold text-[#054239]">{stats.total_resources}</p>
              <p className="text-[11px] text-gray-500">موارد مفعّلة</p>
            </div>
            <div className="bg-white p-3">
              <p className="text-lg font-bold text-[#054239]">{stats.total_categories}</p>
              <p className="text-[11px] text-gray-500">تصنيفات</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}