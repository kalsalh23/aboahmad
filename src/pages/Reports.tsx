import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText, Filter, Printer } from 'lucide-react'
import { api } from '../services/api'
import { MOVEMENT_TYPE_LABELS } from '../constants'
import { Alert, Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, Spinner } from '../components/ui'
import { formatDate, formatDateTime, formatNumber } from '../utils'
import { exportTableToPdf, exportToExcel } from '../utils/excel'
import { printElement } from '../utils/print'

type ReportKey =
  | 'balance'
  | 'received'
  | 'delivered'
  | 'by_category'
  | 'by_branch'
  | 'by_person'
  | 'by_performer'
  | 'movement_log'
  | 'inventory_audit'

interface ReportDef {
  key: ReportKey
  title: string
  description: string
  needsPeriod: boolean
  needsResource: boolean
  columns: string[]
}

const REPORTS: ReportDef[] = [
  { key: 'balance', title: 'تقرير الرصيد الحالي', description: 'أرصدة جميع الموارد حتى اللحظة', needsPeriod: false, needsResource: false, columns: ['النوع', 'المورد', 'الوحدة', 'الرصيد', 'الحد الأدنى', 'آخر تحديث'] },
  { key: 'received', title: 'المواد المستلمة خلال فترة', description: 'كل عمليات الاستلام ضمن الفترة المحددة', needsPeriod: true, needsResource: false, columns: ['رقم الحركة', 'التاريخ', 'المورد', 'النوع', 'الكمية', 'الجهة الموردة', 'رقم المستند', 'الموظف'] },
  { key: 'delivered', title: 'المواد المسلّمة خلال فترة', description: 'كل عمليات التسليم ضمن الفترة المحددة', needsPeriod: true, needsResource: false, columns: ['رقم الحركة', 'التاريخ', 'المورد', 'النوع', 'الكمية', 'المستلم', 'الفرع', 'رقم المستند', 'الموظف'] },
  { key: 'by_category', title: 'تقرير حسب نوع المورد', description: 'ملخص الحركات مجمّعة حسب التصنيف', needsPeriod: true, needsResource: false, columns: ['نوع المورد', 'عدد الحركات', 'إجمالي الاستلام', 'إجمالي التسليم'] },
  { key: 'by_branch', title: 'تقرير حسب الفرع أو الجهة', description: 'الحركات مصنّفة حسب الفرع المستلم', needsPeriod: true, needsResource: false, columns: ['الفرع', 'عدد التسليمات', 'إجمالي الكمية'] },
  { key: 'by_person', title: 'تقرير حسب الشخص المستلم', description: 'ما تم تسليمه لكل شخص', needsPeriod: true, needsResource: false, columns: ['الشخص المستلم', 'عدد العمليات', 'إجمالي الكمية'] },
  { key: 'by_performer', title: 'تقرير حسب الموظف المنفذ', description: 'العمليات التي نفّذها كل موظف', needsPeriod: true, needsResource: false, columns: ['الموظف', 'عدد العمليات', 'استلام', 'تسليم'] },
  { key: 'movement_log', title: 'سجل حركة مورد معين', description: 'كل حركات مورد محدد بالتفصيل', needsPeriod: true, needsResource: true, columns: ['رقم الحركة', 'النوع', 'الكمية', 'التفاصيل', 'التاريخ', 'الموظف'] },
  { key: 'inventory_audit', title: 'تقرير الجرد والفروقات', description: 'مقارنة الرصيد الدفتري بسجل الحركات', needsPeriod: false, needsResource: false, columns: ['المورد', 'الرصيد الدفتري', 'إجمالي الاستلام', 'إجمالي التسليم', 'الفرق'] },
]

export default function Reports() {
  const [reportKey, setReportKey] = useState<ReportKey>('balance')
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [resources, setResources] = useState<{ value: string; label: string }[]>([])
  const [resourceId, setResourceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<(string | number)[][]>([])

  const current = REPORTS.find((r) => r.key === reportKey)!

  useEffect(() => {
    api.resources.list().then((res) => setResources((res.data ?? []).map((r) => ({ value: r.id, label: r.name_ar }))))
  }, [])

  const runReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const range = { from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59` : undefined }

      if (reportKey === 'balance') {
        const res = await api.balances.list()
        const data = res.data ?? []
        setHeaders(['النوع', 'المورد', 'الوحدة', 'الرصيد', 'الحد الأدنى', 'آخر تحديث'])
        setRows(
          data.map((b) => [
            b.resource?.category?.name_ar ?? '',
            b.resource?.name_ar ?? '',
            b.resource?.unit?.name_ar ?? '',
            b.quantity ?? 0,
            b.min_quantity ?? 0,
            b.updated_at ? formatDate(b.updated_at) : '',
          ])
        )
      } else if (reportKey === 'received' || reportKey === 'delivered') {
        const type = reportKey === 'received' ? 'receipt' : 'delivery'
        const res = await api.movements.list({ type, from: range.from, to: range.to, limit: 500 })
        const data = res.data ?? []
        setHeaders(REPORTS.find((r) => r.key === reportKey)!.columns)
        setRows(
          data.map((m) =>
            reportKey === 'received'
              ? [m.movement_number, m.movement_date ? formatDateTime(m.movement_date) : '', m.resource?.name_ar ?? '', m.resource?.category?.name_ar ?? '', m.quantity, m.supplier_name ?? m.from_branch?.name_ar ?? '', m.document_number ?? '', m.performer?.full_name_ar ?? '']
              : [m.movement_number, m.movement_date ? formatDateTime(m.movement_date) : '', m.resource?.name_ar ?? '', m.resource?.category?.name_ar ?? '', m.quantity, m.recipient_name ?? '', m.to_branch?.name_ar ?? '', m.document_number ?? '', m.performer?.full_name_ar ?? '']
          )
        )
      } else if (reportKey === 'by_category' || reportKey === 'by_branch' || reportKey === 'by_person' || reportKey === 'by_performer') {
        const res = await api.movements.list({ from: range.from, to: range.to, limit: 500 })
        const data = res.data ?? []
        if (reportKey === 'by_category') {
          const map = new Map<string, { receipt: number; delivery: number; count: number }>()
          data.forEach((m) => {
            const key = m.resource?.category?.name_ar ?? 'غير محدد'
            const cur = map.get(key) ?? { receipt: 0, delivery: 0, count: 0 }
            if (m.movement_type === 'receipt') cur.receipt += m.quantity
            if (m.movement_type === 'delivery') cur.delivery += m.quantity
            cur.count += 1
            map.set(key, cur)
          })
          setHeaders(['نوع المورد', 'عدد الحركات', 'إجمالي الاستلام', 'إجمالي التسليم'])
          setRows([...map.entries()].map(([k, v]) => [k, v.count, v.receipt, v.delivery]))
        } else if (reportKey === 'by_branch') {
          const map = new Map<string, { count: number; qty: number }>()
          data.filter((m) => m.movement_type === 'delivery').forEach((m) => {
            const key = m.to_branch?.name_ar ?? 'غير محدد'
            const cur = map.get(key) ?? { count: 0, qty: 0 }
            cur.count += 1
            cur.qty += m.quantity
            map.set(key, cur)
          })
          setHeaders(['الفرع', 'عدد التسليمات', 'إجمالي الكمية'])
          setRows([...map.entries()].map(([k, v]) => [k, v.count, v.qty]))
        } else if (reportKey === 'by_person') {
          const map = new Map<string, { count: number; qty: number }>()
          data.filter((m) => m.movement_type === 'delivery').forEach((m) => {
            const key = m.recipient_name ?? 'غير محدد'
            const cur = map.get(key) ?? { count: 0, qty: 0 }
            cur.count += 1
            cur.qty += m.quantity
            map.set(key, cur)
          })
          setHeaders(['الشخص المستلم', 'عدد العمليات', 'إجمالي الكمية'])
          setRows([...map.entries()].map(([k, v]) => [k, v.count, v.qty]))
        } else {
          const map = new Map<string, { count: number; receipt: number; delivery: number }>()
          data.forEach((m) => {
            const key = m.performer?.full_name_ar ?? 'غير محدد'
            const cur = map.get(key) ?? { count: 0, receipt: 0, delivery: 0 }
            cur.count += 1
            if (m.movement_type === 'receipt') cur.receipt += m.quantity
            if (m.movement_type === 'delivery') cur.delivery += m.quantity
            map.set(key, cur)
          })
          setHeaders(['الموظف', 'عدد العمليات', 'استلام', 'تسليم'])
          setRows([...map.entries()].map(([k, v]) => [k, v.count, v.receipt, v.delivery]))
        }
      } else if (reportKey === 'movement_log') {
        if (!resourceId) {
          setError('اختر المورد المطلوب استخراج سجل حركته')
          setLoading(false)
          return
        }
        const res = await api.movements.list({ resource_id: resourceId, from: range.from, to: range.to, limit: 500 })
        const data = res.data ?? []
        setHeaders(['رقم الحركة', 'النوع', 'الكمية', 'التفاصيل', 'التاريخ', 'الموظف'])
        setRows(
          data.map((m) => [
            m.movement_number,
            MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type,
            m.quantity,
            m.recipient_name ?? m.supplier_name ?? m.to_branch?.name_ar ?? m.from_branch?.name_ar ?? '',
            m.movement_date ? formatDateTime(m.movement_date) : '',
            m.performer?.full_name_ar ?? '',
          ])
        )
      } else if (reportKey === 'inventory_audit') {
        const [balRes, movRes] = await Promise.all([
          api.balances.list(),
          api.movements.list({ from: range.from, to: range.to, limit: 500 }),
        ])
        const balances = balRes.data ?? []
        const movements = movRes.data ?? []
        setHeaders(['المورد', 'الرصيد الدفتري', 'إجمالي الاستلام', 'إجمالي التسليم', 'الفرق'])
        setRows(
          balances.map((b) => {
            const resId = b.resource_id
            const received = movements.filter((m) => m.resource_id === resId && m.movement_type === 'receipt').reduce((s, m) => s + m.quantity, 0)
            const delivered = movements.filter((m) => m.resource_id === resId && m.movement_type === 'delivery').reduce((s, m) => s + m.quantity, 0)
            const calculated = received - delivered
            const diff = (b.quantity ?? 0) - calculated
            return [b.resource?.name_ar ?? '', b.quantity ?? 0, received, delivered, diff]
          })
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء استخراج التقرير')
    } finally {
      setLoading(false)
    }
  }, [from, to, reportKey, resourceId])

  useEffect(() => {
    runReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = useMemo(() => {
    if (!rows.length) return null
    const numericCols = headers
      .map((_, i) => ({ index: i, isNumeric: rows.every((r) => typeof r[i] === 'number') }))
      .filter((c) => c.isNumeric)
    return numericCols.map((c) => ({ index: c.index, label: headers[c.index], value: rows.reduce((s, r) => s + (Number(r[c.index]) || 0), 0) }))
  }, [rows, headers])

  return (
    <div className="space-y-5">
      <PageHeader title="التقارير" description="استخراج التقارير الرسمية من بيانات النظام مع الطباعة والتصدير" />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader title="خيارات التقرير" description="اختر نوع التقرير والفترة الزمنية" />
          <div className="space-y-3 p-4">
            <Select
              label="نوع التقرير"
              options={REPORTS.map((r) => ({ value: r.key, label: r.title }))}
              value={reportKey}
              onChange={(e) => {
                setReportKey(e.target.value as ReportKey)
                setError(null)
              }}
            />
            {current.needsPeriod && (
              <div className="grid grid-cols-2 gap-2">
                <Input label="من تاريخ" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
                <Input label="إلى تاريخ" type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
              </div>
            )}
            {current.needsResource && (
              <Select
                label="المورد"
                placeholder="اختر المورد"
                options={resources}
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              />
            )}
            <Button block onClick={runReport} loading={loading}>
              <Filter className="h-4 w-4" aria-hidden />
              استخراج التقرير
            </Button>
            {error && (
              <Alert tone="danger" title="تنبيه">
                {error}
              </Alert>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={current.title}
            description={`${current.description} — عدد السجلات: ${formatNumber(rows.length)}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => exportToExcel(current.title, headers, rows)}
                  disabled={!rows.length}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => exportTableToPdf(current.title, `الفترة: ${from} إلى ${to}`, headers, rows)}
                  disabled={!rows.length}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  PDF
                </Button>
                <Button
                  size="sm"
                  onClick={() => printElement(`report-${reportKey}`, current.title)}
                  disabled={!rows.length}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  طباعة
                </Button>
              </div>
            }
          />
          <div id={`report-${reportKey}`} className="p-4">
            {loading ? (
              <Spinner label="جارٍ استخراج التقرير..." />
            ) : rows.length === 0 ? (
              <EmptyState title="لا توجد بيانات" description="لا توجد سجلات مطابقة لخيارات الاستخراج الحالية." />
            ) : (
              <div className="overflow-x-auto">
                <div className="mb-3 hidden print:block">
                  <h2 className="text-lg font-bold">{current.title}</h2>
                  <p className="text-xs text-gray-500">
                    الفترة: {from} — {to}
                  </p>
                </div>
                <table className="w-full min-w-[720px] border-collapse text-right text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#f7f6f1]">
                      {headers.map((h, i) => (
                        <th key={i} className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-gray-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-100 last:border-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2.5 text-gray-800">
                            {typeof cell === 'number' ? formatNumber(cell) : cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {totals && totals.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-[#f7f6f1] font-semibold">
                        {headers.map((_, i) => {
                          const t = totals.find((x) => x.index === i)
                          return (
                            <td key={i} className="px-3 py-2.5 text-gray-900">
                              {t ? formatNumber(t.value) : i === 0 ? 'الإجمالي' : ''}
                            </td>
                          )
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

