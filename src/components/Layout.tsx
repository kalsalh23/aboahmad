import { useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, BarChart3, Settings, LogOut, User as UserIcon, Calendar, Warehouse } from 'lucide-react'
import { BRAND, COLORS } from '../config/brand'
import { useAuth, PERMISSION_LABELS } from '../context/AuthContext'
import { formatDate } from '../utils'
import { Button } from './ui'

const NAV = [
  { to: '/app', label: 'الرئيسية', icon: Warehouse, end: true, perm: null },
  { to: '/app/receive', label: 'استلام الموارد', icon: ArrowDownToLine, perm: 'receipt.create' },
  { to: '/app/deliver', label: 'تسليم الموارد', icon: ArrowUpFromLine, perm: 'delivery.create' },
  { to: '/app/stock', label: 'المخزون', icon: Boxes, perm: 'stock.view' },
  { to: '/app/reports', label: 'التقارير', icon: BarChart3, perm: 'reports.view' },
  { to: '/app/manage', label: 'إدارة الموارد', icon: Settings, perm: 'resources.manage' },
]

export default function Layout({ children }: { children?: ReactNode } = {}) {
  const { profile, signOut, can } = useAuth()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f7f6f1] text-gray-900">
      <header className="sticky top-0 z-40 border-b border-[#ded9c7] bg-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: COLORS.primary }} aria-hidden>
              <Warehouse className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold tracking-tight text-[#002623]">{BRAND.appNameShort}</span>
          </div>

          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
            {NAV.map((item) => {
              if (item.perm && !can(item.perm)) return null
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-[#e9f1ed] text-[#054239]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mx-auto lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 lg:hidden"
              aria-label="القائمة"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 text-xs text-gray-500 md:flex" title="التاريخ">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              <span>{formatDate(new Date())}</span>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                aria-expanded={settingsOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <UserIcon className="h-3.5 w-3.5" aria-hidden />
                <span className="max-w-[120px] truncate">{profile?.full_name_ar ?? 'المستخدم'}</span>
                <span aria-hidden className="text-[10px] text-gray-400">▾</span>
              </button>
              {settingsOpen && (
                <div className="absolute end-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false)
                      navigate('/app/settings')
                    }}
                    className="block w-full px-3 py-2 text-right text-xs text-gray-700 hover:bg-gray-50"
                  >
                    الإعدادات
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false)
                      navigate('/app/audit')
                    }}
                    className="block w-full px-3 py-2 text-right text-xs text-gray-700 hover:bg-gray-50"
                  >
                    سجل التدقيق
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false)
                      navigate('/app/users')
                    }}
                    className="block w-full px-3 py-2 text-right text-xs text-gray-700 hover:bg-gray-50"
                  >
                    المستخدمون والصلاحيات
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false)
                      handleLogout()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-[#6b1f2a] hover:bg-[#faf2f3]"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 pb-3 pt-2 lg:hidden">
            <div className="grid grid-cols-2 gap-1">
              {NAV.map((item) => {
                if (item.perm && !can(item.perm)) return null
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      ['flex items-center gap-2 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-[#e9f1ed] text-[#054239]' : 'text-gray-600 hover:bg-gray-100'].join(' ')
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        {children ?? <Outlet />}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-6 text-[11px] text-gray-400">
        {BRAND.appNameShort} — الإصدار {BRAND.version}
      </footer>
    </div>
  )
}

export function PermissionChips() {
  const { profile } = useAuth()
  const perms = (profile?.role?.permissions ?? []) as string[]
  if (!perms.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {perms.map((p) => (
        <span key={p} className="rounded-full bg-[#eef3f1] px-2 py-0.5 text-[11px] text-[#054239]">
          {PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] ?? p}
        </span>
      ))}
    </div>
  )
}

export function LogoutButton() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <Button
      variant="danger"
      size="sm"
      onClick={async () => {
        await signOut()
        navigate('/', { replace: true })
      }}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      تسجيل الخروج
    </Button>
  )
}