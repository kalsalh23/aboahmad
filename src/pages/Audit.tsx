import { useCallback, useEffect, useState } from 'react'
import { Download, History, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import { MOVEMENT_TYPE_LABELS } from '../constants'
import type { AuditLog } from '../types'
import { Button, Card, CardHeader, DataTable, Input, PageHeader, Select } from '../components/ui'
import { formatDateTime } from '../utils'
import { exportToExcel } from '../utils/excel'

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  receive: 'استلام',
  deliver: 'تسليم',
  cancel: 'إلغاء',
  correction: 'تصحيح',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  permission_change: 'تغيير صلاحيات',
}

const ENTITY_LABELS: Record<string, string> = {
  resource: 'مورد',
  resource_category: 'تصنيف مورد',
  unit: 'وحدة قياس',
  stock_movement: 'حركة مخزنية',
  individual_asset: 'أصل فردي',
  profile: 'مستخدم',
  role: 'دور',
  branch: 'فرع',
  department: 'قسم',
  person: 'شخص',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.audit.list({
      action: action || undefined,
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T23:59:59` : undefined,
    })
    setLogs(res.data ?? [])
    setLoading(false)
  }, [action, from, to])

  useEffect(() => {
    load()
  }, [load])

  const rows = entity ? logs.filter((l) => l.entity_type === entity) : logs

  return (
    <div className="space-y-5">
      <PageHeader
        title="سجل التدقيق"
        description="توثيق كل العمليات المهمة على النظام — الإنشاء والتعديل والاستلام والتسليم والإلغاء"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              تحديث
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                exportToExcel(
                  'سجل التدقيق',
                  ['التاريخ', 'الإجراء', 'الكيان', 'المعرف', 'المستخدم'],
                  rows.map((l) => [formatDateTime(l.created_at), ACTION_LABELS[l.action] ?? l.action, ENTITY_LABELS[l.entity_type] ?? l.entity_type, l.entity_id ?? '', l.user_id ?? ''])
                )
              }
              disabled={!rows.length}
            >
              <Download className="h-4 w-4" aria-hidden />
              تصدير
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="تصفية السجل" description="اختر نوع الإجراء والكيان والفترة الزمنية" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="من تاريخ" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
          <Input label="إلى تاريخ" type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
          <Select
            label="نوع الإجراء"
            placeholder="كل الإجراءات"
            options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <Select
            label="الكيان"
            placeholder="كل الكيانات"
            options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))}
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={`سجل الأحداث (${rows.length})`} description="الأحدث أولاً" />
        <DataTable<AuditLog>
          loading={loading}
          rows={rows}
          keyOf={(r) => r.id}
          emptyTitle="لا توجد أحداث"
          emptyDescription="لم تُسجَّل أي أحداث مطابقة للفلاتر المحددة."
          columns={[
            { key: 'created_at', label: 'التاريخ والوقت', render: (r) => <span className="whitespace-nowrap text-gray-600">{formatDateTime(r.created_at)}</span> },
            {
              key: 'action',
              label: 'الإجراء',
              render: (r) => <span className="font-medium text-[#054239]">{ACTION_LABELS[r.action] ?? r.action}</span>,
            },
            { key: 'entity_type', label: 'الكيان', render: (r) => ENTITY_LABELS[r.entity_type] ?? r.entity_type },
            {
              key: 'entity_id',
              label: 'المعرف',
              render: (r) =>
                r.entity_id ? (
                  <span className="font-mono text-[11px] text-gray-500" dir="ltr">
                    {r.entity_id.slice(0, 8)}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'changes',
              label: 'التفاصيل',
              render: (r) => {
                const old = r.old_values ? Object.keys(r.old_values).length : 0
                const next = r.new_values ? Object.keys(r.new_values).length : 0
                if (!old && !next) return '—'
                return (
                  <span className="text-xs text-gray-600">
                    {old > 0 && `${old} قيمة سابقة`} {next > 0 && `${next} قيمة جديدة`}
                  </span>
                )
              },
            },
            {
              key: 'user',
              label: 'المستخدم',
              render: (r) =>
                r.user_id ? (
                  <span className="font-mono text-[11px] text-gray-500" dir="ltr">
                    {r.user_id.slice(0, 8)}
                  </span>
                ) : (
                  'النظام'
                ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

export { MOVEMENT_TYPE_LABELS }
export type { History }