import { useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  Calendar,
  Warehouse,
} from 'lucide-react'
import { BRAND } from '../config/brand'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils'

const NAV = [
  { to: '/app', label: 'الرئيسية', icon: Warehouse, end: true, perm: null },
  { to: '/app/receive', label: 'استلام الموارد', icon: ArrowDownToLine, perm: 'receipt.create' },
  { to: '/app/deliver', label: 'تسليم الموارد', icon: ArrowUpFromLine, perm: 'delivery.create' },
  { to: '/app/stock', label: 'المخزون', icon: Boxes, perm: 'stock.view' },
  { to: '/app/reports', label: 'التقارير', icon: BarChart3, perm: 'reports.view' },
  { to: '/app/manage', label: 'إدارة الموارد', icon: Settings, perm: 'resources.manage' },
]

const EXTRA = [
  { to: '/app/settings', label: 'الإعدادات', perm: null },
  { to: '/app/audit', label: 'سجل التدقيق', perm: 'audit.view' },
  { to: '/app/users', label: 'المستخدمون والصلاحيات', perm: 'users.manage' },
]

export default function Layout({ children }: { children?: ReactNode } = {}) {
  const { signOut, can } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  const go = (to: string) => {
    setMenuOpen(false)
    navigate(to)
  }

  return (
    <div className="min-h-screen bg-[#f7f6f1] text-gray-900">
      <header className="sticky top-0 z-40 border-b border-[#ded9c7] bg-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <img
              src={BRAND.logoPath}
              alt={BRAND.logoAlt ?? ''}
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg border border-[#ded9c7] bg-white object-contain p-0.5"
            />
            <span className="text-sm font-bold tracking-tight text-[#002623]">{BRAND.appNameShort}</span>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
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

          <div className="hidden items-center gap-1.5 text-xs text-gray-500 md:flex" title="التاريخ">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            <span>{formatDate(new Date())}</span>
          </div>

          <div className="relative ms-auto lg:ms-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="القائمة"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <span aria-hidden className="text-base leading-none">☰</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
                <div className="absolute end-0 top-full z-50 mt-1 w-60 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="lg:hidden">
                    {NAV.map((item) => {
                      if (item.perm && !can(item.perm)) return null
                      const Icon = item.icon
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => go(item.to)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                          {item.label}
                        </button>
                      )
                    })}
                    <div className="my-1 border-t border-gray-100" />
                  </div>

                  {EXTRA.map((item) => {
                    if (item.perm && !can(item.perm)) return null
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => go(item.to)}
                        className="block w-full px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {item.label}
                      </button>
                    )
                  })}

                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-[#6b1f2a] hover:bg-[#faf2f3]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    تسجيل الخروج
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
