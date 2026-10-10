import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, UserCog, Users } from 'lucide-react'
import { api } from '../services/api'
import { PERMISSION_LABELS, ROLES } from '../context/AuthContext'
import type { Branch, Department, Profile, Role } from '../types'
import { Alert, Badge, Button, Card, CardHeader, DataTable, Input, Modal, PageHeader, Select } from '../components/ui'
import { formatDate } from '../utils'

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [u, r, b, d] = await Promise.all([
      api.users.list(),
      api.roles.list(),
      api.branches.list(),
      api.departments.list(),
    ])
    setUsers(u.data ?? [])
    setRoles(r.data ?? [])
    setBranches(b.data ?? [])
    setDepartments(d.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (u: Profile) => {
    const res = await api.users.update(u.id, { is_active: !u.is_active })
    if (res.error) return setError(res.error)
    await load()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="المستخدمون والصلاحيات"
        description="إدارة حسابات الموظفين وأدوارهم في النظام"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              مستخدم جديد
            </Button>
          </div>
        }
      />

      {error && (
        <Alert tone="danger" title="خطأ">
          {error}
        </Alert>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9f1ed] text-[#054239]" aria-hidden>
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold text-[#002623]">{users.length}</p>
              <p className="text-[11px] text-gray-500">إجمالي المستخدمين</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4efe1] text-[#6d5836]" aria-hidden>
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold text-[#002623]">{users.filter((u) => u.is_active).length}</p>
              <p className="text-[11px] text-gray-500">حسابات مفعّلة</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef3f1] text-[#054239]" aria-hidden>
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p className="text-lg font-bold text-[#002623]">{roles.length}</p>
              <p className="text-[11px] text-gray-500">الأدوار المعرّفة</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="قائمة المستخدمين" description="حدّد دور كل مستخدم وفعّله أو أوقفه" />
        <DataTable<Profile>
          loading={loading}
          rows={users}
          keyOf={(r) => r.id}
          columns={[
            {
              key: 'name',
              label: 'الاسم',
              render: (r) => (
                <div>
                  <p className="font-medium text-gray-900">{r.full_name_ar ?? '—'}</p>
                  <p className="text-[11px] text-gray-400" dir="ltr">
                    {r.email ?? r.phone ?? ''}
                  </p>
                </div>
              ),
            },
            { key: 'role', label: 'الدور', render: (r) => <Badge tone="info">{r.role?.name_ar ?? 'بدون دور'}</Badge> },
            { key: 'branch', label: 'الفرع', render: (r) => r.branch?.name_ar ?? '—' },
            { key: 'department', label: 'القسم', render: (r) => r.department?.name_ar ?? '—' },
            {
              key: 'scope',
              label: 'نطاق الصلاحيات',
              render: (r) => (
                <div className="flex max-w-[240px] flex-wrap gap-1">
                  {((r.role?.permissions ?? []) as string[]).slice(0, 3).map((p) => (
                    <span key={p} className="rounded bg-[#eef3f1] px-1.5 py-0.5 text-[10px] text-[#054239]">
                      {PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] ?? p}
                    </span>
                  ))}
                  {((r.role?.permissions ?? []) as string[]).length > 3 && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      +{((r.role?.permissions ?? []) as string[]).length - 3}
                    </span>
                  )}
                </div>
              ),
            },
            { key: 'is_active', label: 'الحالة', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'مفعّل' : 'موقوف'}</Badge> },
            { key: 'created_at', label: 'تاريخ الإنشاء', render: (r) => formatDate(r.created_at) },
            {
              key: 'actions',
              label: 'إجراءات',
              render: (r) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                    <UserCog className="h-3.5 w-3.5" aria-hidden />
                    تعديل
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                    {r.is_active ? 'إيقاف' : 'تفعيل'}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="الأدوار المتاحة في النظام" description="الصلاحيات تُطبَّق على قاعدة البيانات عبر Supabase RLS" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => {
            const dbRole = roles.find((r) => r.name_ar === role.label)
            return (
              <div key={role.key} className="rounded-lg border border-gray-200 bg-[#fbfaf6] p-3">
                <p className="text-sm font-semibold text-gray-900">{role.label}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {((dbRole?.permissions ?? []) as string[]).map((p) => (
                    <span key={p} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-600">
                      {PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] ?? p}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {(creating || editing) && (
        <UserModal
          user={editing}
          roles={roles}
          branches={branches}
          departments={departments}
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

function UserModal({
  user,
  roles,
  branches,
  departments,
  onClose,
  onSaved,
}: {
  user: Profile | null
  roles: Role[]
  branches: Branch[]
  departments: Department[]
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(user?.full_name_ar ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [username, setUsername] = useState(user?.phone ?? '')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState(user?.role_id ?? roles[0]?.id ?? '')
  const [branchId, setBranchId] = useState(user?.branch_id ?? '')
  const [departmentId, setDepartmentId] = useState(user?.department_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!fullName.trim()) return setError('الاسم مطلوب')
    if (!roleId) return setError('اختر الدور')
    setSaving(true)

    if (user) {
      const res = await api.users.update(user.id, {
        role_id: roleId,
        branch_id: branchId || undefined,
        department_id: departmentId || undefined,
      })
      setSaving(false)
      if (res.error) return setError(res.error)
      onSaved()
      return
    }

    if (!email.trim()) return setError('البريد الإلكتروني مطلوب لإنشاء الحساب')
    if (password.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')

    const res = await api.users.create({
      full_name_ar: fullName.trim(),
      email: email.trim(),
      username: username.trim() || undefined,
      password,
      role_id: roleId,
      branch_id: branchId || undefined,
      department_id: departmentId || undefined,
    })
    setSaving(false)
    if (res.error) return setError(res.error)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={user ? `تعديل: ${user.full_name_ar}` : 'إضافة مستخدم جديد'} size="lg">
      <div className="space-y-3">
        {!user && (
          <>
            <Alert tone="warning" title="إنشاء حساب جديد">
              ينشئ هذا الإجراء حساب مصادقة في Supabase Auth وملف موظف مرتبطاً به. تأكد من تسليم بيانات الدخول للموظف بشكل آمن.
            </Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="البريد الإلكتروني *" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
              <Input label="كلمة المرور *" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={saving} />
            </div>
          </>
        )}
        <Input label="الاسم الكامل *" value={fullName} onChange={(e) => setFullName(e.target.value)} error={error} disabled={saving} autoFocus />
        {!user && <Input label="رقم الهاتف (يُستخدم لتسجيل الدخول)" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} disabled={saving} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="الدور *"
            placeholder="اختر الدور"
            options={roles.map((r) => ({ value: r.id, label: r.name_ar }))}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={saving}
          />
          <Select
            label="الفرع"
            placeholder="بدون فرع محدد"
            options={branches.map((b) => ({ value: b.id, label: b.name_ar }))}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={saving}
          />
        </div>
        <Select
          label="القسم / الشعبة"
          placeholder="بدون قسم محدد"
          options={departments.filter((d) => !branchId || d.branch_id === branchId).map((d) => ({ value: d.id, label: d.name_ar }))}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={saving}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button onClick={submit} loading={saving}>{user ? 'حفظ التعديلات' : 'إنشاء المستخدم'}</Button>
      </div>
    </Modal>
  )
}